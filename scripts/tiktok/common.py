"""Shared drawing helpers for the TikTok clips (daily clip + explainers).

Boards arrive as JSON from the TypeScript engine (scripts/tiktok/serialize.ts),
so no game rules live here — only drawing.
"""
import glob
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
BG = (14, 20, 36)
PANEL = (24, 32, 52)
LINE = (60, 72, 100)
FG = (236, 240, 248)
MUTED = (140, 152, 178)
X = (239, 83, 80)
O = (52, 211, 153)
GOLD = (229, 184, 75)
RED = (220, 38, 38)
DARK_GOLD = (170, 120, 20)

BOARD_X, BOARD_Y, BOARD_SIZE = 60, 560, 960

_font_cache = {}


def font(size, bold=True):
    key = (size, bold)
    if key in _font_cache:
        return _font_cache[key]
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    hits = glob.glob(f"/usr/share/fonts/**/{name}", recursive=True) or glob.glob(
        f"/nix/store/*/share/fonts/**/{name}", recursive=True)
    f = ImageFont.truetype(hits[0], size) if hits else ImageFont.load_default(size)
    _font_cache[key] = f
    return f


def fit_lines(d, text, max_w, size, min_size=28, bold=True, max_lines=2):
    """Shrink and wrap text until it fits max_w in at most max_lines lines."""
    while True:
        f = font(size, bold)
        words, lines, cur = text.split(), [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if d.textlength(t, font=f) <= max_w or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        widest = max((d.textlength(l, font=f) for l in lines), default=0)
        if (len(lines) <= max_lines and widest <= max_w) or size <= min_size:
            return f, lines
        size -= 4


def text_block(d, cx, top, text, max_w, size, fill, bold=True, max_lines=2, min_size=28):
    """Draw centred wrapped text; returns the bottom y."""
    f, lines = fit_lines(d, text, max_w, size, min_size, bold, max_lines)
    lh = f.size * 1.18
    for i, l in enumerate(lines):
        d.text((cx, top + i * lh), l, font=f, fill=fill, anchor="ma")
    return top + len(lines) * lh


def banner(d, text, sub=None, fill=RED, y=1580):
    """Rounded banner with text guaranteed to fit inside."""
    x0, x1 = 80, W - 80
    h = 230 if sub else 160
    d.rounded_rectangle([x0, y, x1, y + h], 36, fill=fill)
    inner = x1 - x0 - 80
    if sub:
        text_block(d, W / 2, y + 30, text, inner, 88, FG, max_lines=1)
        text_block(d, W / 2, y + 150, sub, inner, 42, FG, bold=False, max_lines=1)
    else:
        f, lines = fit_lines(d, text, inner, 80, max_lines=1)
        d.text((W / 2, y + h / 2), lines[0], font=f, fill=FG, anchor="mm")


def new_frame():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img, "RGBA")


class Geo:
    """Pixel geometry for a board (single grid or ultimate grid of grids)."""

    def __init__(self, st, x0=BOARD_X, y0=BOARD_Y, size=BOARD_SIZE):
        self.st, self.x0, self.y0, self.size = st, x0, y0, size
        self.n = st["size"]
        self.ult = st["ultimate"]
        self.sub = size / self.n if self.ult else size  # mini-board pixel size
        self.cell = self.sub / self.n

    def board_rect(self, b):
        if not self.ult:
            return self.x0, self.y0, self.x0 + self.size, self.y0 + self.size
        bx = self.x0 + (b % self.n) * self.sub
        by = self.y0 + (b // self.n) * self.sub
        return bx, by, bx + self.sub, by + self.sub

    def board_center(self, b):
        x0, y0, x1, y1 = self.board_rect(b)
        return (x0 + x1) / 2, (y0 + y1) / 2

    def cell_rect(self, b, c):
        bx, by, _, _ = self.board_rect(b)
        cx = bx + (c % self.n) * self.cell
        cy = by + (c // self.n) * self.cell
        return cx, cy, cx + self.cell, cy + self.cell

    def cell_center(self, b, c):
        x0, y0, x1, y1 = self.cell_rect(b, c)
        return (x0 + x1) / 2, (y0 + y1) / 2


def draw_mark(d, m, rect, width):
    x0, y0, x1, y1 = rect
    pad = (x1 - x0) * 0.22
    if m == "X":
        d.line([x0 + pad, y0 + pad, x1 - pad, y1 - pad], fill=X, width=width)
        d.line([x1 - pad, y0 + pad, x0 + pad, y1 - pad], fill=X, width=width)
    elif m == "O":
        d.ellipse([x0 + pad, y0 + pad, x1 - pad, y1 - pad], outline=O, width=width)
    elif m == "+":
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        r = (x1 - x0) / 2 - pad
        d.line([cx - r, cy, cx + r, cy], fill=GOLD, width=width + 2)
        d.line([cx, cy - r, cx, cy + r], fill=GOLD, width=width + 2)


def glow_board(d, g, b, col=GOLD, alpha=70):
    x0, y0, x1, y1 = g.board_rect(b)
    d.rectangle([x0 + 5, y0 + 5, x1 - 5, y1 - 5], fill=(*col, alpha), outline=(*col, 255), width=6)


def draw_board(d, st, last=None, flash=False, glow=(), free=False, locked=None, t=1.0):
    """Draw the full board. t (0..1) animates win lines being drawn."""
    g = Geo(st)
    d.rounded_rectangle([g.x0 - 18, g.y0 - 18, g.x0 + g.size + 18, g.y0 + g.size + 18], 28, fill=PANEL)
    nb = len(st["boards"])
    mark_w = max(5, int(g.cell * 0.09))
    open_boards = [b for b in range(nb) if not st["ultimate"] or st["completed"][b] is None]

    # Board highlights
    if st["ultimate"] and not st["over"]:
        if free:
            for b in open_boards:
                glow_board(d, g, b, GOLD, 60)
        elif st["target"] is not None and not glow:
            glow_board(d, g, st["target"], (90, 110, 160), 70)
    for b in glow:
        glow_board(d, g, b)

    for b in range(nb):
        bx0, by0, bx1, by1 = g.board_rect(b)
        for c in range(len(st["boards"][b])):
            r = g.cell_rect(b, c)
            if last and last["b"] == b and last["c"] == c:
                d.rectangle([r[0] + 3, r[1] + 3, r[2] - 3, r[3] - 3], fill=(RED if flash else (70, 84, 120)))
            draw_mark(d, st["boards"][b][c], r, mark_w)
        for i in range(1, g.n):
            d.line([bx0 + i * g.cell, by0 + 10, bx0 + i * g.cell, by1 - 10], fill=LINE, width=2)
            d.line([bx0 + 10, by0 + i * g.cell, bx1 - 10, by0 + i * g.cell], fill=LINE, width=2)

        # Win line through the 3/4 winning cells
        line = st["boardLines"][b] if b < len(st["boardLines"]) else None
        w = st["completed"][b] if st["ultimate"] else st["winner"]
        if line and w in ("X", "O"):
            col = X if w == "X" else O
            p0 = g.cell_center(b, line[0])
            p1 = g.cell_center(b, line[-1])
            ex = (p1[0] - p0[0]) * 0.18, (p1[1] - p0[1]) * 0.18
            a = (p0[0] - ex[0], p0[1] - ex[1])
            z = (p1[0] + ex[0], p1[1] + ex[1])
            z = (a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t)
            d.line([a, z], fill=(*FG, 255), width=max(8, int(g.cell * 0.16)))
            d.line([a, z], fill=col, width=max(5, int(g.cell * 0.1)))

        # Claimed board stamp (ultimate only)
        if st["ultimate"] and st["completed"][b] in ("X", "O", "D"):
            meta = st["meta"][b]
            d.rectangle([bx0 + 4, by0 + 4, bx1 - 4, by1 - 4], fill=(*BG, 150))
            if meta in ("X", "O", "+"):
                draw_mark(d, meta, (bx0, by0, bx1, by1), max(12, int(g.sub * 0.07)))
        if locked == b:
            d.rectangle([bx0 + 4, by0 + 4, bx1 - 4, by1 - 4], outline=RED, width=8)
            d.text(g.board_center(b), "LOCKED", font=font(int(g.sub * 0.15)), fill=RED, anchor="mm")

    if st["ultimate"]:
        for i in range(1, g.n):
            d.line([g.x0 + i * g.sub, g.y0, g.x0 + i * g.sub, g.y0 + g.size], fill=FG, width=6)
            d.line([g.x0, g.y0 + i * g.sub, g.x0 + g.size, g.y0 + i * g.sub], fill=FG, width=6)

    # Big beam through the winning mini-boards
    if st["ultimate"] and st.get("metaLine"):
        ml = st["metaLine"]
        col = X if st["winner"] == "X" else O
        a = g.board_center(ml[0])
        z = g.board_center(ml[-1])
        z = (a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t)
        d.line([a, z], fill=(*GOLD, 255), width=44)
        d.line([a, z], fill=col, width=26)
    return g


def draw_arrow(d, g, b, c, to, col=GOLD, t=1.0):
    import math
    a = g.cell_center(b, c)
    z = g.board_center(to)
    if a == z:
        return
    z = (a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t)
    d.line([a, z], fill=(*BG, 255), width=26)
    d.line([a, z], fill=col, width=16)
    ang = math.atan2(z[1] - a[1], z[0] - a[0])
    s = 52
    pts = [z, (z[0] - s * math.cos(ang - 0.45), z[1] - s * math.sin(ang - 0.45)),
           (z[0] - s * math.cos(ang + 0.45), z[1] - s * math.sin(ang + 0.45))]
    d.polygon(pts, fill=col)
    d.ellipse([a[0] - 14, a[1] - 14, a[0] + 14, a[1] + 14], fill=col)


def turn_badge(d, player, is_you, y=440):
    """Pill like  ● YOUR TURN · X  — the dot is drawn, so no missing-glyph boxes."""
    col = X if player == "X" else O
    label = f"YOUR TURN  ·  {player}" if is_you else f"BOT'S TURN  ·  {player}"
    f = font(40)
    tw = d.textlength(label, font=f)
    w, h = tw + 120, 76
    x = (W - w) / 2
    d.rounded_rectangle([x, y, x + w, y + h], 38, fill=PANEL if not is_you else (*col, 60), outline=col, width=4)
    d.ellipse([x + 32, y + h / 2 - 14, x + 60, y + h / 2 + 14], fill=col)
    d.text((x + 80, y + h / 2), label, font=f, fill=FG if is_you else MUTED, anchor="lm")


def ffmpeg_writer(out, audio=None):
    import subprocess
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-"]
    cmd += ["-i", audio] if audio else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
    cmd += ["-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def post_to_discord(path, caption):
    import json, os, sys, requests
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        print("DISCORD_WEBHOOK_URL not set; skipping post")
        return
    with open(path, "rb") as f:
        r = requests.post(url, data={"payload_json": json.dumps({"content": caption})},
                          files={"files[0]": (os.path.basename(path), f, "video/mp4")}, timeout=180)
    if not r.ok:
        sys.exit(f"Discord post failed [{r.status_code}]: {r.text}")
    print("Posted", path, "to Discord")
