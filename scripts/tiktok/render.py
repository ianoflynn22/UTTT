#!/usr/bin/env python3
"""Render the daily 9:16 clip and (optionally) post it to Discord.

Usage: bun scripts/tiktok/data.ts | python3 scripts/tiktok/render.py out.mp4
Posts to Discord when the DISCORD_WEBHOOK_URL environment variable is set.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (W, FPS, FG, MUTED, GOLD, RED, DARK_GOLD, new_frame, text_block, banner, draw_board,
                    turn_badge, ffmpeg_writer, post_to_discord, font)


def frame(data, idx, title, sub, sub_col=FG, flash=False, ban=None, show_turn=True, t=1.0):
    img, d = new_frame()
    d.text((W / 2, 90), "UTTT+", font=font(64), fill=GOLD, anchor="ma")
    y = text_block(d, W / 2, 190, title, W - 120, 90, FG, max_lines=1)
    text_block(d, W / 2, y + 10, sub, W - 140, 46, sub_col, bold=False, max_lines=1)
    st = data["states"][idx]
    if show_turn and not ban and not st["over"]:
        turn_badge(d, st["current"], st["current"] == data["attacker"])
    last = data["moves"][idx - 1] if idx > 0 else None
    draw_board(d, st, last, flash, t=t)
    if ban:
        banner(d, ban[0], ban[1], fill=ban[2])
    else:
        d.text((W / 2, 1640), f"{data['date']}  ·  Daily Puzzle", font=font(40, False), fill=MUTED, anchor="ma")
    return img.tobytes()


def render(data, out):
    ff = ffmpeg_writer(out)

    def hold(buf, secs):
        for _ in range(int(secs * FPS)):
            ff.stdin.write(buf)

    par, b, end = data["par"], data["blunderAt"], len(data["moves"])
    hold(frame(data, 0, "Today's puzzle", f"Win in {par} moves. Can you?", GOLD), 2.5)
    for i in range(1, b + 1):
        you = data["states"][i - 1]["current"] == data["attacker"]
        took = sum(w is not None for w in data["states"][i]["completed"]) > sum(w is not None for w in data["states"][i - 1]["completed"])
        sub = ("You take a board!" if you else "Bot takes a board") if took else ("Nice move" if you else "Bot defends")
        hold(frame(data, i, "Looking good…", sub, GOLD if took else FG), 1.6)
    hold(frame(data, b, "Hmm…", "Is this the right move?", GOLD), 1.4)
    # The Bot punishes the blunder all the way to winning the big board.
    for i in range(b + 1, end):
        hold(frame(data, i, "Uh oh…", "The Bot strikes back", RED), 0.9)
    for k in range(6):
        hold(frame(data, end, "BLUNDER", "Bot wins the game" if data["lost"] else "Bot steals it", RED,
                   flash=k % 2 == 0, show_turn=False, t=min(1, (k + 1) / 4)), 0.2)
    hold(frame(data, end, "BLUNDER", "Bot wins the game" if data["lost"] else "Bot steals it", RED, flash=True,
               ban=("FAILED", "Can you beat it?", RED), show_turn=False), 2.5)
    hold(frame(data, 0, "Your turn", "Solve it before midnight", GOLD,
               ban=("utttplus.com", "Free · Link in bio", DARK_GOLD), show_turn=False), 3.0)
    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")


if __name__ == "__main__":
    data = json.load(sys.stdin)
    out = sys.argv[1] if len(sys.argv) > 1 else f"puzzle-{data['date']}.mp4"
    render(data, out)
    print("Rendered", out, os.path.getsize(out) // 1024, "KB")
    post_to_discord(out, f"🧩 Daily puzzle {data['date']} — Par {data['par']}\n\nCaption:\n"
                    "Today's puzzle got me 💀 Can you find the winning line? Play free at utttplus.com "
                    "#ultimatetictactoe #puzzle #dailygame #brainteaser #tictactoe #fyp")
