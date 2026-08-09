"use strict";

const { compareTwoStrings } = require("string-similarity");

// "Sundiam, Roel" → "Roel Sundiam". Leaves names with no comma untouched.
function flipLastFirst(name) {
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

// Lowercase, un-comma, strip punctuation, collapse whitespace — puts two
// spellings of the same name ("Roel S. Sundiam" / "ROEL SUNDiam") on equal footing.
function normalizeName(raw) {
  return flipLastFirst(String(raw || "").trim())
    .toLowerCase()
    .replace(/[.,'’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 0..1 similarity between two raw names, via Dice's coefficient on normalized
// forms — tolerant of word reordering and dropped middle initials, unlike
// plain Levenshtein distance.
function scoreMatch(a, b) {
  return compareTwoStrings(normalizeName(a), normalizeName(b));
}

// Rank a club roster ({_id, name}[]) against one imported raw name. Only
// scores worth showing the organizer are returned (>= 0.5), sorted best-first.
function matchAgainstRoster(rawName, roster, { minScore = 0.5, limit = 5 } = {}) {
  return roster
    .map((u) => ({ userId: u._id, name: u.name, score: scoreMatch(rawName, u.name) }))
    .filter((m) => m.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

module.exports = { normalizeName, scoreMatch, matchAgainstRoster };
