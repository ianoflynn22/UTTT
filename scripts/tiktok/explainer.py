#!/usr/bin/env python3
"""Generate a complete 35s TikTok Rules Explainer Video with AI Voiceover and step-by-step example moves."""
import glob, json, math, os, subprocess, sys, tempfile
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
ACTIVE_BG = (45, 62, 102)

def font(size, bold=True):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for n in names:
        hits = glob.glob(f"/usr/share/fonts/**/{n}", recursive=True) + glob.glob(f"/nix/store/*/share/fonts/**/{n}", recursive=True)
        if hits:
            return ImageFont.truetype(hits[0], size)
    return ImageFont.load_default(size)

F_HUGE, F_BIG, F_MED, F_SMALL = font(96), font(68), font(48), font(36, False)

def center(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)

def draw_arrow(d, p1, p2, col=GOLD, width=12):
    d.line([p1, p2], fill=col, width=width)
    x1, y1 = p1
    x2, y2 = p2
    angle = math.atan2(y2 - y1, x2 - x1)
    head_len = 38
    head_angle = math.pi / 6
    x3 = x2 - head_len * math.cos(angle - head_angle)
    y3 = y2 - head_len * math.sin(angle - head_angle)
    x4 = x2 - head_len * math.cos(angle + head_angle)
    y4 = y2 - head_len * math.sin(angle + head_angle)
    d.polygon([(x2, y2), (x3, y3), (x4, y4)], fill=col)

def board_coords(b, c=None):
    size, x0, y0 = 960, 60, 520
    cell = size / 9
    bx = x0 + (b % 3) * size / 3
    by = y0 + (b // 3) * size / 3
    if c is None:
        return bx + size / 6, by + size / 6
    cx = bx + (c % 3) * cell + cell / 2
    cy = by + (c // 3) * cell + cell / 2
    return cx, cy

def draw_board(d, boards, completed, target=None, hot=None):
    size, x0, y0 = 960, 60, 520
    cell = size / 9
    d.rounded_rectangle([x0 - 16, y0 - 16, x0 + size + 16, y0 + size + 16], 28, fill=PANEL)
    for b in range(9):
        bx, by = x0 + (b % 3) * size / 3, y0 + (b // 3) * size / 3
        if target == b:
            d.rectangle([bx + 4, by + 4, bx + size / 3 - 4, by + size / 3 - 4], fill=ACTIVE_BG)
        for c in range(9):
            cx, cy = bx + (c % 3) * cell, by + (c // 3) * cell
            m = boards[b][c] if boards else None
            pad = cell * 0.24
            if hot and hot[0] == b and hot[1] == c:
                d.rectangle([cx + 3, cy + 3, cx + cell - 3, cy + cell - 3], fill=(80, 105, 160))
            if m == "X":
                d.line([cx + pad, cy + pad, cx + cell - pad, cy + cell - pad], fill=X_COL, width=9)
                d.line([cx + cell - pad, cy + pad, cx + pad, cy + cell - pad], fill=X_COL, width=9)
            elif m == "O":
                d.ellipse([cx + pad, cy + pad, cx + cell - pad, cy + cell - pad], outline=O_COL, width=9)
        for i in (1, 2):
            d.line([bx + i * cell, by + 10, bx + i * cell, by + size / 3 - 10], fill=LINE, width=2)
            d.line([bx + 10, by + i * cell, bx + size / 3 - 10, by + i * cell], fill=LINE, width=2)
        w = completed.get(b) if completed else None
        if w in ("X", "O"):
            col = X_COL if w == "X" else O_COL
            p = size / 3 * 0.2
            if w == "X":
                d.line([bx + p, by + p, bx + size / 3 - p, by + size / 3 - p], fill=col, width=22)
                d.line([bx + size / 3 - p, by + p, bx + p, by + size / 3 - p], fill=col, width=22)
            else:
                d.ellipse([bx + p, by + p, bx + size / 3 - p, by + size / 3 - p], outline=col, width=22)

    for i in (1, 2):
        d.line([x0 + i * size / 3, y0, x0 + i * size / 3, y0 + size], fill=FG, width=6)
        d.line([x0, y0 + i * size / 3, x0 + size, y0 + i * size / 3], fill=FG, width=6)

def frame(title, sub, boards, completed, target=None, hot=None, arrow=None, banner=None, tag="HOW TO PLAY"):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    center(d, 90, tag, F_MED, GOLD)
    center(d, 190, title, F_BIG, FG)
    center(d, 300, sub, F_SMALL, MUTED)

    draw_board(d, boards, completed, target, hot)
    if arrow:
        draw_arrow(d, arrow[0], arrow[1], GOLD, 12)
    if banner:
        col = banner[2] if len(banner) > 2 else PANEL
        d.rounded_rectangle([90, 1550, W - 90, 1800], 36, fill=col)
        center(d, 1580, banner[0], F_BIG, FG)
        center(d, 1700, banner[1], F_SMALL, FG if col != PANEL else MUTED)
    else:
        center(d, 1640, "utttplus.com  ·  Link in bio", F_SMALL, GOLD)
    return img.tobytes()

def make_voiceover(tmpdir):
    """Generate audio files using edge-tts and concatenate into a single audio track."""
    scripts = [
        ("s1.mp3", "Think Tic-Tac-Toe is a solved game? Ultimate Tic-Tac-Toe completely changes the rules."),
        ("s2.mp3", "There are nine mini-boards. Here is the golden rule: wherever you place your mark inside a square, forces your opponent to play on that board next."),
        ("s3.mp3", "Win three squares in a row to capture a mini-board."),
        ("s4.mp3", "Capture three mini-boards in a row to win the entire game. You have to think three moves ahead!"),
        ("s5.mp3", "Play free against friends, smart bots, or the daily puzzle right now at utttplus.com. Link in bio.")
    ]
    durations = []
    concat_list = os.path.join(tmpdir, "concat.txt")
    with open(concat_list, "w") as cl:
        for fname, text in scripts:
            path = os.path.join(tmpdir, fname)
            cmd = ["edge-tts", "--voice", "en-US-ChristopherNeural", "--text", text, "--write-media", path]
            subprocess.run(cmd, check=True)
            res = subprocess.run(["ffprobe", "-i", path, "-show_entries", "format=duration", "-v", "quiet", "-of", "csv=p=0"],
                                 capture_output=True, text=True)
            dur = float(res.stdout.strip())
            durations.append(dur)
            cl.write(f"file '{path}'\n")

    combined = os.path.join(tmpdir, "voiceover.mp3")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", combined],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return combined, durations

def render(out="explainer.mp4"):
    tmpdir = tempfile.mkdtemp()
    print("Generating AI voiceover with edge-tts...")
    audio_path, durs = make_voiceover(tmpdir)
    print("Voiceover generated. Scene durations:", [round(d, 2) for durs in durs for d in [durs]])

    raw_video = os.path.join(tmpdir, "video.mp4")
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "22", raw_video],
        stdin=subprocess.PIPE)

    def hold(buf, secs):
        for _ in range(int(secs * FPS)):
            ff.stdin.write(buf)

    empty = [[None]*9 for _ in range(9)]

    # SCENE 1: The Hook (durs[0])
    s1_dur = durs[0]
    hold(frame("THINK IT'S TOO EASY?", "9 mini-boards inside 1 giant board", empty, {}, banner=("ULTIMATE TIC-TAC-TOE", "A whole new level of strategy", PANEL)), s1_dur)

    # SCENE 2: The Golden Rule (durs[1]) - Step-by-step example moves!
    s2_dur = durs[1]
    # Move 1: X plays in Center Board (4), top-right square (2)
    b1 = [row[:] for row in empty]
    b1[4][2] = "X"
    # Show X play
    hold(frame("THE GOLDEN RULE", "X plays center board, top-right square", b1, {}, hot=(4, 2)), 1.8)
    # Arrow shoots from cell (4, 2) to Board 2!
    arrow1 = (board_coords(4, 2), board_coords(2))
    hold(frame("FORCED MOVE!", "Your square dictates their board!", b1, {}, target=2, hot=(4, 2), arrow=arrow1,
               banner=("O IS FORCED TO PLAY HERE", "Sent to top-right board (Board 2)", GOLD)), 2.2)

    # Move 2: O is forced to play in Board 2. O plays in bottom-left square (6)!
    b2 = [row[:] for row in b1]
    b2[2][6] = "O"
    hold(frame("O RESPONDS IN BOARD 2", "O plays in the bottom-left square...", b2, {}, target=2, hot=(2, 6)), 1.8)
    # Arrow shoots from cell (2, 6) to Board 6!
    arrow2 = (board_coords(2, 6), board_coords(6))
    remaining_s2 = max(0.5, s2_dur - (1.8 + 2.2 + 1.8))
    hold(frame("NOW X IS SENT HERE!", "O sends X to the bottom-left board", b2, {}, target=6, hot=(2, 6), arrow=arrow2,
               banner=("X MUST PLAY IN BOARD 6", "Every single move dictates the next!", (52, 211, 153))), remaining_s2)

    # SCENE 3: Capture a Mini-Board (durs[2])
    s3_dur = durs[2]
    b3 = [row[:] for row in b2]
    # Set up center board with 2 X's
    b3[4][0] = "X"
    b3[4][1] = "X"
    # X completes the row in center board!
    b3[4][2] = "X"
    hold(frame("CAPTURE A BOARD", "Win 3-in-a-row inside any mini-board", b3, {}, hot=(4, 1)), 1.5)
    # BOOM! Stamped capture!
    comp3 = {4: "X"}
    remaining_s3 = max(0.5, s3_dur - 1.5)
    hold(frame("BOARD CAPTURED! 🎯", "Giant X claims the center board", b3, comp3, banner=("MINI-BOARD WON!", "Center board is now locked for X", X_COL)), remaining_s3)

    # SCENE 4: Ultimate Win Condition (durs[3])
    s4_dur = durs[3]
    b4 = [row[:] for row in b3]
    # Boards 0, 4, 8 captured!
    comp4 = {0: "X", 4: "X", 8: "X"}
    hold(frame("HOW TO WIN THE MATCH", "Win 3 mini-boards in a row", b4, comp4), 2.0)
    # Highlight diagonal win
    remaining_s4 = max(0.5, s4_dur - 2.0)
    arrow_diag = (board_coords(0), board_coords(8))
    hold(frame("🏆 MATCH VICTORY!", "3 boards in a row wins the whole game", b4, comp4, arrow=arrow_diag,
               banner=("VICTORY FOR X!", "Thinking 3 moves ahead pays off", GOLD)), remaining_s4)

    # SCENE 5: Call to Action (durs[4])
    s5_dur = durs[4]
    hold(frame("PLAY FREE TODAY", "Wordle meets Chess · New daily puzzle", b4, comp4,
               banner=("utttplus.com", "Free in bio · Play bots, friends or puzzle", (170, 120, 20))), s5_dur)

    ff.stdin.close()
    ff.wait()

    print("Muxing video and voiceover...")
    subprocess.run([
        "ffmpeg", "-y", "-i", raw_video, "-i", audio_path,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print(f"Rendered explainer to {out} ({os.path.getsize(out) // 1024} KB)")

    # Post to Discord
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if url:
        import requests
        caption = ("🎬 **How to Play Ultimate Tic-Tac-Toe** (Explainer with AI Voiceover)\n\n"
                   "Think Tic-Tac-Toe is too easy? Ultimate Tic-Tac-Toe fixes that completely 🧠\n"
                   "Play free online against friends, bots, or the daily puzzle at utttplus.com #ultimatetictactoe #howtoplay #gaming #boardgames #brainteaser #fyp")
        with open(out, "rb") as f:
            r = requests.post(url, data={"payload_json": json.dumps({"content": caption})},
                              files={"files[0]": (os.path.basename(out), f, "video/mp4")}, timeout=120)
        if r.ok:
            print("Successfully posted explainer to Discord!")
        else:
            print(f"Discord post failed: {r.status_code} {r.text}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "explainer.mp4"
    render(out_file)
