// Turns raw pasted/OCR'd text from a Reclub participant list into a clean
// list of likely player names, dropping ratings/labels/status text along the
// way. Shared by both the paste and screenshot (OCR) import paths — and, per
// the feature's forward-compat goal, a future real Reclub API integration
// could skip this entirely and hand `rawNames` straight to the backend.
//
// Real screenshots carry a lot more surrounding app chrome than a clean
// paste does — ads, tab labels ("Details | Participants | Matches"), sort
// controls, event titles, attendee counts — so this errs aggressive: a line
// only survives if it BOTH avoids known noise words AND has the shape of a
// person's name (1-4 title-cased words, letters only). Precision matters
// more than recall here since the review screen only shows what got through.

// Only letters (incl. accented), spaces, and the punctuation real names use.
// Excludes digits and all UI-chrome punctuation (@ + = ¥ § « » | / : etc.).
const ALLOWED_CHARS = /^[A-Za-zÀ-ſ'.\- ]+$/;

// Words that show up in app chrome but essentially never in a person's name.
// A single hit anywhere in the line disqualifies the whole line.
const STOPWORDS = new Set([
  'confirmed', 'pending', 'waitlist', 'waitlisted', 'registered', 'checked',
  'open', 'play', 'session', 'event', 'details', 'participant', 'participants',
  'match', 'matches', 'sort', 'show', 'filter', 'search', 'download', 'install',
  'app', 'apps', 'store', 'ad', 'ads', 'login', 'signup', 'sign', 'share', 'invite',
  'result', 'results', 'score', 'scores', 'court', 'courts', 'level', 'location',
  'venue', 'organizer', 'host', 'hosted', 'by', 'sunday', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'guest', 'member', 'members',
  'players', 'player', 'spot', 'spots', 'more', 'back', 'next', 'home', 'menu',
  'settings', 'profile', 'notification', 'notifications', 'message', 'messages',
  'chat', 'loan', 'quick', 'cash', 'ntrp', 'dupr', 'rating',
  'you', 'your', 'you\'ve', 'declined', 'decline', 'join', 'joined', 'request',
  'requested', 'maybe', 'tap', 'click', 'view', 'see', 'all', 'friends', 'tags',
]);

function isNameWord(word: string): boolean {
  // Trailing period allowed for initials/abbreviations ("S.", "Jr.").
  if (!/^[A-Za-zÀ-ſ'-]+\.?$/.test(word)) return false;
  if (word.length > 20) return false;
  if (STOPWORDS.has(word.toLowerCase().replace(/\.$/, ''))) return false;
  // Reject "shouted" words (headers/labels are frequently ALL CAPS); allow
  // short all-caps like "JR", "III" that legitimately appear in names.
  if (word.length > 3 && word === word.toUpperCase()) return false;
  return true;
}

function looksLikeName(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false;
  if (!ALLOWED_CHARS.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (!words.every(isNameWord)) return false;
  // Two tiny fragments together ("he ag", "fe To") are a classic garbled-OCR
  // shape — a real name has at least one word long enough to be a name on
  // its own.
  if (words.length > 1 && words.every((w) => w.replace('.', '').length <= 2)) return false;
  // A lone 1-2 letter fragment ("LJ", "AL") is almost always OCR noise from
  // an icon, status bar, or avatar-initial badge, not a real single-word
  // name/nickname — those run 3+ characters in practice (e.g. "Rad", "Jau").
  if (words.length === 1 && words[0].replace('.', '').length <= 2) return false;
  return true;
}

// Strips a leading list marker ("1.", "-", "•") and trailing rating/status
// fragments some Reclub exports append after a name on the same line
// (e.g. "Juan Dela Cruz - 4.5", "Pedro Santos (Confirmed)").
function cleanLine(line: string): string {
  return line
    .replace(/^[\s#•\-–*]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/[-–|]\s*(NTRP|DUPR)?\s*\d+(\.\d+)?\s*$/i, '')
    .replace(/\((confirmed|waitlist|waitlisted|pending|checked in)\)\s*$/i, '')
    .trim();
}

// "Sundiam, Roel" → "Roel Sundiam" — run before the shape check so the
// comma doesn't need to be in ALLOWED_CHARS.
function flipLastFirst(line: string): string {
  const parts = line.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : line;
}

export function extractNameCandidates(rawText: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const raw of rawText.split(/\r?\n/)) {
    const cleaned = flipLastFirst(cleanLine(raw.trim()));
    if (!cleaned || !looksLikeName(cleaned)) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
  }

  return names;
}

// ── Screenshot-specific reconstruction ──────────────────────────────────────
// A plain text list is easy: one name per line. But real Reclub screenshots
// are often a photo-grid roster — avatars in columns, names below each one,
// long names wrapping to a second line. OCR reads that roughly left-to-right
// per visual row, so `data.text` jumbles multiple people's names into one
// line, and a wrapped name's second line ("Castillo") ends up glued to a
// stranger's name from the same row instead of its own first name ("Gio").
//
// Fix: ignore Tesseract's own line/paragraph grouping (it already made the
// same mistake) and re-cluster individual words purely by position — words
// close together horizontally on the same visual line, or stacked tightly
// enough to be a wrapped continuation of the same short line, belong to one
// name; anything farther apart (the gap between grid columns, or between
// separate rows) does not.

export interface OcrBox { text: string; x0: number; y0: number; x1: number; y1: number; }

// Minimal shape of Tesseract.js's recognize() result we rely on — avoids a
// hard dependency on the library's types here.
interface OcrLine {
  words?: { text: string; confidence?: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
}
interface OcrParagraph { lines?: OcrLine[] }
interface OcrBlock { paragraphs?: OcrParagraph[] }
interface OcrPage { blocks?: OcrBlock[] | null }

// Below this, a word is more likely a misread of small/blurry text (common
// right next to avatar edges in a grid roster) than real text — e.g. the
// "he ag" / "fe" / "rN" fragments Tesseract produces on tight crops. These
// don't fail the shape filter on their own (short lowercase fragments can
// look word-shaped), so they have to be caught here, before clustering.
const MIN_WORD_CONFIDENCE = 60;

function flattenWords(page: OcrPage | null | undefined): OcrBox[] {
  const words: OcrBox[] = [];
  for (const block of page?.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const w of line.words || []) {
          const text = (w.text || '').trim();
          if (!text) continue;
          if (w.confidence != null && w.confidence < MIN_WORD_CONFIDENCE) continue;
          words.push({ text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
        }
      }
    }
  }
  return words;
}

// Union-find over word indices — each resulting set is one reconstructed name.
class WordGroups {
  private parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

function groupWordsByProximity(words: OcrBox[]): OcrBox[][] {
  const n = words.length;
  if (!n) return [];
  const uf = new WordGroups(n);
  const heights = words.map((w) => Math.max(1, w.y1 - w.y0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = words[i], b = words[j];
      const h = (heights[i] + heights[j]) / 2;

      // Same visual line, close enough horizontally to be one multi-word
      // name ("Ak Vinluan") rather than a neighboring grid column.
      const sameLine = Math.abs(a.y0 - b.y0) < h * 0.6;
      const horizGap = a.x1 <= b.x0 ? b.x0 - a.x1 : b.x1 <= a.x0 ? a.x0 - b.x1 : 0;
      if (sameLine && horizGap < h * 1.8) { uf.union(i, j); continue; }

      // Wrapped continuation ("Gio" above "Castillo"): stacked tightly,
      // roughly aligned horizontally, same-ish font size. A caption line
      // underneath in a smaller/lighter font (e.g. "Almar's +1") fails the
      // size-ratio check and stays its own group.
      //
      // Calibrated against real Tesseract output, not assumption: word-level
      // bbox height is noisy even within one line/font (observed h=15 to
      // h=29 on the SAME row) because it tracks actual glyph ascenders/
      // descenders, not font-size. A true wrapped second line measured
      // ~0.56 against its first line's inflated bbox; a real smaller-font
      // caption measured ~0.37. 0.45 is the calibrated split point —
      // this is a soft signal, not a hard font-size measurement.
      const top = a.y0 <= b.y0 ? a : b;
      const bottom = a.y0 <= b.y0 ? b : a;
      const vertGap = bottom.y0 - top.y1;
      const sizeRatio = Math.min(heights[i], heights[j]) / Math.max(heights[i], heights[j]);

      // Alignment check tolerant of either center- or left-aligned wrapping:
      // matching centers (common when text is centered under an avatar) OR
      // meaningful x-range overlap (covers left-aligned wraps, where a short
      // first line and a longer second line share a left edge, not a center).
      const centerA = (a.x0 + a.x1) / 2, centerB = (b.x0 + b.x1) / 2;
      const centersClose = Math.abs(centerA - centerB) < h * 1.2;
      const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const narrowerWidth = Math.min(a.x1 - a.x0, b.x1 - b.x0);
      const overlapsEnough = narrowerWidth > 0 && overlap / narrowerWidth > 0.3;
      const horizAligned = centersClose || overlapsEnough;

      // Bounding boxes for tightly stacked lines routinely touch or overlap
      // slightly (descenders, tight line-height) — a strict vertGap >= 0
      // rejected exactly the tight-wrap case this branch exists to catch.
      if (vertGap > -h * 0.4 && vertGap < h * 0.9 && sizeRatio > 0.45 && horizAligned) {
        uf.union(i, j);
      }
    }
  }

  const groups = new Map<number, OcrBox[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(words[i]);
  }
  return [...groups.values()];
}

// Reading order within a reconstructed name: top line first, then left to
// right within each line. Sorting by raw (y0, x0) isn't enough — two words
// on the SAME visual line can have a few pixels of y0 noise from OCR, which
// silently overrides the x0 tiebreak and reverses word order (observed:
// "Ak Vinluan" coming out as "Vinluan Ak"). Cluster into lines first, THEN
// sort left-to-right within each line, so line membership — not raw y0 —
// decides order.
function orderGroupText(group: OcrBox[]): string {
  const sorted = [...group].sort((a, b) => a.y0 - b.y0);
  const lines: OcrBox[][] = [];
  for (const w of sorted) {
    const h = Math.max(1, w.y1 - w.y0);
    const current = lines[lines.length - 1];
    if (current && Math.abs(w.y0 - current[0].y0) < h * 0.6) {
      current.push(w);
    } else {
      lines.push([w]);
    }
  }
  return lines
    .map((line) => [...line].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accepts Tesseract.js's RecognizeResult.data directly.
export function extractNamesFromOcrPage(page: OcrPage | null | undefined): string[] {
  const groups = groupWordsByProximity(flattenWords(page));

  const seen = new Set<string>();
  const names: string[] = [];
  for (const group of groups) {
    const text = orderGroupText(group);
    const cleaned = flipLastFirst(cleanLine(text));
    if (!cleaned || !looksLikeName(cleaned)) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
  }
  return names;
}
