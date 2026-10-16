#!/usr/bin/env python3
"""Generate a 30s TikTok Explainer video for Ultimate Tic-Tac-Toe and post to Discord."""
import glob, json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
BG = (14, 20, 36)
PANEL = (24, 32, 52)
LINE = (60, 72, 100)
FG = (236, 240, 248)
MUTED = (140, 152, 178)
X_COL = (239, 83, 80)
O_COL = (52, 211, 153)
GOLD = (229, 184, 75)

def font(size, bold=True):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for n in names:
        hits = glob.glob(f"/usr/share/fonts/**/{n}", recursive=True) + glob.glob(f"/nix/store/*/share/fonts/**/{n}", recursive=True)
        if hits:
            return ImageFont.truetype(hits[0], size)
    return ImageFont.load_default(size)

F_BIG, F_MED, F_SMALL = font(90), font(56), font(40, False)

def center(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)

def render_explainer(out="explainer.mp4"):
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)

    def frame(headline, sub, board_state, highlight_arrow=None):
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        center(d, 120, "HOW TO PLAY", F_MED, GOLD)
        center(d, 230, headline, F_BIG, FG)
        center(d, 350, sub, F_SMALL, MUTED)

        # Draw 9x9 board representation
        size, x0, y0 = 960, 60, 520
        d.rounded_rectangle([x0 - 16, y0 - 16, x0 + size + 16, y0 + size + 16], 28, fill=PANEL)
        cell = size / 9
        for b in range(9):
            bx, by = x0 + (b % 3) * size / 3, y0 + (b // 3) * size / 3
            if board_state.get("target") == b:
                d.rectangle([bx + 4, by + 4, bx + size / 3 - 4, by + size / 3 - 4], fill=(45, 60, 95))
            for i in (1, 2):
                d.line([bx + i * cell, by + 10, bx + i * cell, by + size / 3 - 10], fill=LINE, width=2)
                d.line([bx + 10, by + i * cell, bx + size / 3 - 10, by + i * cell], fill=LINE, width=2)
            w = board_state.get("completed", {}).get(b)
            if w:
                col = X_COL if w == "X" else O_COL
                p = size / 3 * 0.2
                if w == "X":
                    d.line([bx + p, by + p, bx + size / 3 - p, by + size / 3 - p], fill=col, width=22)
                    d.line([bx + size / 3 - p, by + p, bx + p, by + size / 3 - p], fill=col, width=22)

        for i in (1, 2):
            d.line([x0 + i * size / 3, y0, x0 + i * size / 3, y0 + size], fill=FG, width=6)
            d.line([x0, y0 + i * size / 3, x0 + size, y0 + i * size / 3], fill=FG, width=6)

        if highlight_arrow:
            start_pt, end_pt = highlight_arrow
            d.line([start_pt, end_pt], fill=GOLD, width=10)

        center(d, 1620, "utttplus.com  ·  Link in bio", F_SMALL, GOLD)
        return img.tobytes()

    def hold(buf, secs):
        for _ in range(int(secs * FPS)):
            ff.stdin.write(buf)

    # 1. Hook
    hold(frame("Think Tic-Tac-Toe", "is too simple?", {}), 3.0)
    # 2. Golden Rule
    hold(frame("9 Mini-Boards", "Inside 1 giant board", {}), 3.0)
    hold(frame("The Golden Rule", "Where you play dictates where they play", {"target": 8}, highlight_arrow=((540, 1000), (860, 1320))), 4.5)
    # 3. Objective
    hold(frame("Win 3 Boards", "In a row to win the game", {"completed": {0: "X", 4: "X", 8: "X"}}), 4.0)
    # 4. CTA
    hold(frame("Play Free Today", "Daily puzzle, bots & online friend matches", {"completed": {0: "X", 4: "X", 8: "X"}}), 4.5)

    ff.stdin.close()
    ff.wait()
    print("Explainer rendered to", out)

    # Post to Discord
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if url:
        import requests
        with open(out, "rb") as f:
            requests.post(url, data={"payload_json": json.dumps({"content": "🎬 **Ultimate Tic-Tac-Toe: Rules Explainer Video** (Ready to pin!)"})},
                          files={"files[0]": (os.path.basename(out), f, "video/mp4")})
        print("Posted explainer to Discord!")

if __name__ == "__main__":
    render_explainer()
