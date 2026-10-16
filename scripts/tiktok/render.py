#!/usr/bin/env python3
"""Render the daily 9:16 clip and (optionally) post it to Discord.

Usage: bun scripts/tiktok/data.ts | python3 scripts/tiktok/render.py out.mp4
Posts to Discord when the DISCORD_WEBHOOK_URL environment variable is set.
"""
import glob, json, os, subprocess, sys
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


def font(size, bold=True):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for n in names:
        hits = glob.glob(f"/usr/share/fonts/**/{n}", recursive=True) + glob.glob(f"/nix/store/*/share/fonts/**/{n}", recursive=True)
        if hits:
            return ImageFont.truetype(hits[0], size)
    return ImageFont.load_default(size)


F_BIG, F_MED, F_SMALL = font(96), font(60), font(42, False)


def center(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)


def draw_board(d, st, last=None, flash=False):
    size, x0, y0 = 960, 60, 520
    cell = size / 9
    d.rounded_rectangle([x0 - 16, y0 - 16, x0 + size + 16, y0 + size + 16], 28, fill=PANEL)
    for b in range(9):
        bx, by = x0 + (b % 3) * size / 3, y0 + (b // 3) * size / 3
        if st["target"] == b and not st["over"]:
            d.rectangle([bx + 4, by + 4, bx + size / 3 - 4, by + size / 3 - 4], fill=(40, 52, 82))
        for c in range(9):
            cx, cy = bx + (c % 3) * cell, by + (c // 3) * cell
            m = st["boards"][b][c]
            pad = cell * 0.24
            hot = last and last["b"] == b and last["c"] == c
            if hot:
                d.rectangle([cx + 3, cy + 3, cx + cell - 3, cy + cell - 3], fill=(RED if flash else (70, 84, 120)))
            if m == "X":
                d.line([cx + pad, cy + pad, cx + cell - pad, cy + cell - pad], fill=X, width=9)
                d.line([cx + cell - pad, cy + pad, cx + pad, cy + cell - pad], fill=X, width=9)
            elif m == "O":
                d.ellipse([cx + pad, cy + pad, cx + cell - pad, cy + cell - pad], outline=O, width=9)
            elif m == "+":
                d.text((cx + cell / 2, cy + cell / 2), "+", font=F_MED, fill=GOLD, anchor="mm")
        for i in (1, 2):
            d.line([bx + i * cell, by + 10, bx + i * cell, by + size / 3 - 10], fill=LINE, width=2)
            d.line([bx + 10, by + i * cell, bx + size / 3 - 10, by + i * cell], fill=LINE, width=2)
        w = st["completed"][b]
        if w in ("X", "O"):
            col = X if w == "X" else O
            ov = Image.new("RGBA", (int(size / 3), int(size / 3)), (*BG, 170))
            d._image.paste(ov, (int(bx), int(by)), ov)
            p = size / 3 * 0.2
            if w == "X":
                d.line([bx + p, by + p, bx + size / 3 - p, by + size / 3 - p], fill=col, width=20)
                d.line([bx + size / 3 - p, by + p, bx + p, by + size / 3 - p], fill=col, width=20)
            else:
                d.ellipse([bx + p, by + p, bx + size / 3 - p, by + size / 3 - p], outline=col, width=20)
    for i in (1, 2):
        d.line([x0 + i * size / 3, y0, x0 + i * size / 3, y0 + size], fill=FG, width=6)
        d.line([x0, y0 + i * size / 3, x0 + size, y0 + i * size / 3], fill=FG, width=6)


def frame(data, idx, title, sub, sub_col=FG, flash=False, banner=None):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    center(d, 110, "UTTT+", F_MED, GOLD)
    center(d, 230, title, F_BIG, FG)
    center(d, 360, sub, F_SMALL, sub_col)
    last = data["moves"][idx - 1] if idx > 0 else None
    draw_board(d, data["states"][idx], last, flash)
    if banner:
        d.rounded_rectangle([90, 1560, W - 90, 1800], 36, fill=banner[2])
        center(d, 1590, banner[0], F_BIG, FG)
        center(d, 1710, banner[1], F_SMALL, FG)
    else:
        center(d, 1640, f"{data['date']}  ·  Daily Puzzle", F_SMALL, MUTED)
    return img.tobytes()


def render(data, out):
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)
    def hold(buf, secs):
        for _ in range(int(secs * FPS)):
            ff.stdin.write(buf)
    you = "You" if data["attacker"] == "X" else "You"
    par = data["par"]
    hold(frame(data, 0, "Today's puzzle", f"Win in {par} moves (Par {par}). Can you?", GOLD), 2.2)
    b = data["blunderAt"]
    for i in range(1, b + 1):
        who = "Good move..." if i % 2 == 1 else "Bot defends"
        hold(frame(data, i, "Looking good", who), 0.9)
    hold(frame(data, b + 1, "Hmm...", "Is this the move?", GOLD), 1.0)
    end = len(data["moves"])
    msg = "Bot wins the game" if data["lost"] else "Bot takes a board"
    for k in range(6):
        hold(frame(data, end, "BLUNDER", msg, RED, flash=k % 2 == 0, banner=("FAILED", "Try again?", RED)), 0.18)
    hold(frame(data, end, "BLUNDER", msg, RED, flash=True, banner=("FAILED", "Try again?", RED)), 2.8)
    hold(frame(data, 0, "Can you beat it?", "New puzzle every day", GOLD, banner=("utttplus.com", "Link in bio", (170, 120, 20))), 3.0)
    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")


def post(out, data):
    import requests
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        print("DISCORD_WEBHOOK_URL not set; skipping post")
        return
    caption = (f"🧩 Daily puzzle {data['date']} — Par {data['par']}\n\n"
               "Caption:\nToday's puzzle is brutal 💀 Can you do better? Play free at utttplus.com "
               "#ultimatetictactoe #puzzle #dailygame #brainteaser #tictactoe #fyp")
    with open(out, "rb") as f:
        r = requests.post(url, data={"payload_json": json.dumps({"content": caption})},
                          files={"files[0]": (os.path.basename(out), f, "video/mp4")}, timeout=120)
    if not r.ok:
        sys.exit(f"Discord post failed [{r.status_code}]: {r.text}")
    print("Posted to Discord")


if __name__ == "__main__":
    data = json.load(sys.stdin)
    out = sys.argv[1] if len(sys.argv) > 1 else f"puzzle-{data['date']}.mp4"
    render(data, out)
    print("Rendered", out, os.path.getsize(out) // 1024, "KB")
    post(out, data)
