from PIL import Image, ImageDraw, ImageFont
import os

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SRC, "DUPR_Feature_Report.jpg")

COL_W = 1900
GUTTER = 90
MARGIN = 70
CANVAS_W = MARGIN * 2 + COL_W * 2 + GUTTER
TITLE_H = 190

FONT_DIR = "C:/Windows/Fonts"


def load_font(name, size):
    try:
        return ImageFont.truetype(f"{FONT_DIR}/{name}", size)
    except Exception:
        return ImageFont.load_default()


font_title = load_font("arialbd.ttf", 80)
font_sub = load_font("ariali.ttf", 34)
font_section = load_font("arialbd.ttf", 46)
font_body = load_font("arial.ttf", 34)

accent = (79, 133, 22)
text_color = (40, 40, 40)

sections = [
    {
        "num": 1,
        "title": "Premium Event (DUPR+ gating) for Hosted Play",
        "images": ["01-premium-event-toggle.png"],
        "caption": "Admins can mark a Hosted Play session as a Premium Event (DUPR+ only). Only players whose linked DUPR account has an active DUPR+ subscription can register or participate.",
    },
    {
        "num": 2,
        "title": "Delete function for Recorded Games",
        "images": ["02-delete-recorded-game.png"],
        "caption": "Admins can delete a recorded game (trash icon). If it was already submitted to DUPR, deleting it also retracts it there so ratings recalculate correctly.",
    },
    {
        "num": 3,
        "title": "DUPR rating on player dashboard",
        "images": ["03-dupr-rating-pill.png"],
        "caption": "Linked players see their DUPR rating right on their dashboard, under the greeting.",
    },
    {
        "num": 4,
        "title": "DUPR \u201clink your account\u201d prompt",
        "images": ["04-dupr-link-prompt.png"],
        "caption": "Players who haven't linked DUPR yet see a prompt in the same spot, guiding them to link their account.",
    },
    {
        "num": 5,
        "title": "DUPR rating in Attendance Check-In roster",
        "images": ["02-delete-recorded-game.png"],
        "caption": "Admins checking players in can see each player's DUPR rating right in the roster list.",
    },
    {
        "num": 6,
        "title": "Self-service DUPR Club ID for club admins",
        "images": ["05-dupr-club-id-selfservice.png"],
        "caption": "Club admins can enter their own DUPR Club ID directly from their dashboard, with a hint linking to dupr.com/clubs.",
    },
    {
        "num": 7,
        "title": "Premium Event gating \u2014 blocked vs. allowed join",
        "images": ["06-premium-blocked-join.png", "07-premium-join-success.png"],
        "caption": "A player without DUPR+ is blocked from joining a Premium session with a clear message. A player with an active DUPR+ subscription (after relinking) joins successfully.",
    },
]


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


tmp_draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))

# Render each section into its own self-contained block image.
blocks = []
for sec in sections:
    imgs = []
    for fname in sec["images"]:
        im = Image.open(os.path.join(SRC, fname)).convert("RGB")
        w, h = im.size
        new_h = int(COL_W * h / w)
        imgs.append(im.resize((COL_W, new_h), Image.LANCZOS))
    caption_lines = wrap_text(tmp_draw, sec["caption"], font_body, COL_W)

    block_h = 68 + sum(im.height + 22 for im in imgs) + len(caption_lines) * 44 + 44
    block = Image.new("RGB", (COL_W, block_h), "white")
    bd = ImageDraw.Draw(block)
    y = 0
    bd.text((0, y), f"{sec['num']}. {sec['title']}", font=font_section, fill=accent)
    y += 68
    for im in imgs:
        block.paste(im, (0, y))
        y += im.height + 22
    for line in caption_lines:
        bd.text((0, y), line, font=font_body, fill=text_color)
        y += 44
    blocks.append(block)

# Greedy 2-column packing, balancing column heights.
col_heights = [0, 0]
col_blocks = [[], []]
for block in blocks:
    col = 0 if col_heights[0] <= col_heights[1] else 1
    col_blocks[col].append(block)
    col_heights[col] += block.height + 72

total_h = TITLE_H + MARGIN + max(col_heights) + MARGIN

canvas = Image.new("RGB", (CANVAS_W, total_h), "white")
draw = ImageDraw.Draw(canvas)

draw.text((MARGIN, MARGIN), "DUPR Feature Report", font=font_title, fill=(20, 20, 20))
draw.text(
    (MARGIN, MARGIN + 96),
    "SheServes Tennis Club \u2014 Premium Event tests use \u201c3 Test Open Play\u201d; others use \u201cTest 2 Open Play\u201d",
    font=font_sub,
    fill=(90, 90, 90),
)

col_x = [MARGIN, MARGIN + COL_W + GUTTER]
for col in range(2):
    y = TITLE_H + MARGIN
    for block in col_blocks[col]:
        canvas.paste(block, (col_x[col], y))
        y += block.height + 72

canvas.save(OUT, "JPEG", quality=92)
print("Saved:", OUT, canvas.size)
