#!/usr/bin/env python3
"""Render the daily 9:16 clip and (optionally) post it to Discord.

Usage: bun scripts/tiktok/data.ts | python3 scripts/tiktok/render.py out.mp4
Posts to Discord when the DISCORD_WEBHOOK_URL environment variable is set.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (W, FPS, FG, MUTED, GOLD, RED, DARK_GOLD, new_frame, text_block, banner, draw_board,
                    turn_badge, ffmpeg_writer, post_to_discord, font, tts, audio_duration)
import asyncio, subprocess, tempfile


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


def voice_lines(data):
    return {
        "intro": f"Can you solve today's Ultimate Tic-Tac-Toe puzzle? Win in {data['par']} moves.",
        "doubt": "Hmm... is this the right move?",
        "strike": "Uh oh. The Bot strikes back!",
        "fail": "Failed! What would you have played? Tell me in the comments.",
        "cta": "Tic-Tac-Toe, evolved. Play today's puzzle free, at U-T-T-T Plus dot com!",
    }


def make_voice(data, tmp):
    """Returns {key: (mp3 path, seconds)}; empty if the voice is unavailable (music-free silent clip)."""
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("edge-tts not installed; rendering without voiceover")
        return {}
    out = {}
    for k, text in voice_lines(data).items():
        p = os.path.join(tmp, f"{k}.mp3")
        asyncio.run(tts(text, p))
        out[k] = (p, audio_duration(p))
    return out


def render(data, out):
    tmp = tempfile.mkdtemp()
    voice = make_voice(data, tmp)
    silent = os.path.join(tmp, "silent.mp4") if voice else out
    ff = ffmpeg_writer(silent)
    clock = [0.0]
    cues = []

    def say(key):
        if key in voice:
            cues.append((voice[key][0], clock[0]))

    def need(key, secs):
        return max(secs, voice[key][1] + 0.3) if key in voice else secs

    def hold(buf, secs):
        n = int(secs * FPS)
        for _ in range(n):
            ff.stdin.write(buf)
        clock[0] += n / FPS

    par, b, end = data["par"], data["blunderAt"], len(data["moves"])
    say("intro")
    hold(frame(data, 0, "Today's puzzle", f"Win in {par} moves. Can you?", GOLD), need("intro", 2.5))
    for i in range(1, b + 1):
        you = data["states"][i - 1]["current"] == data["attacker"]
        took = sum(w is not None for w in data["states"][i]["completed"]) > sum(w is not None for w in data["states"][i - 1]["completed"])
        sub = ("You take a board!" if you else "Bot takes a board") if took else ("Nice move" if you else "Bot defends")
        hold(frame(data, i, "Looking good…", sub, GOLD if took else FG), 1.6)
    say("doubt")
    hold(frame(data, b, "Hmm…", "Is this the right move?", GOLD), need("doubt", 1.4))
    # The Bot punishes the blunder all the way to winning the big board.
    say("strike")
    for i in range(b + 1, end):
        hold(frame(data, i, "Uh oh…", "The Bot strikes back", RED), 0.9)
    msg = "Bot wins the game" if data["lost"] else "Bot steals it"
    for k in range(6):
        hold(frame(data, end, "BLUNDER", msg, RED, flash=k % 2 == 0, show_turn=False, t=min(1, (k + 1) / 4)), 0.2)
    say("fail")
    hold(frame(data, end, "BLUNDER", msg, RED, flash=True, ban=("FAILED", "What would you play?", RED), show_turn=False),
         need("fail", 2.5))
    say("cta")
    hold(frame(data, 0, "Tic-Tac-Toe, evolved.", "Solve today's puzzle", GOLD,
               ban=("utttplus.com", "Free · Link in bio", DARK_GOLD), show_turn=False), need("cta", 3.0))
    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")
    if voice:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", silent]
        for p, _ in cues:
            cmd += ["-i", p]
        parts = [f"[{i + 1}:a]adelay={int(t * 1000)}:all=1[v{i}]" for i, (_, t) in enumerate(cues)]
        mix = "".join(f"[v{i}]" for i in range(len(cues))) + f"amix=inputs={len(cues)}:normalize=0[a]"
        cmd += ["-filter_complex", ";".join(parts + [mix]), "-map", "0:v", "-map", "[a]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)


if __name__ == "__main__":
    data = json.load(sys.stdin)
    out = sys.argv[1] if len(sys.argv) > 1 else f"puzzle-{data['date']}.mp4"
    render(data, out)
    print("Rendered", out, os.path.getsize(out) // 1024, "KB")
    post_to_discord(out, f"🧩 Daily puzzle {data['date']} — Par {data['par']}\n\nCaption:\n"
                    "Today's puzzle got me 💀 What would you have played? 👇 Tic-Tac-Toe, evolved — play free at utttplus.com "
                    "#ultimatetictactoe #puzzle #dailygame #brainteaser #tictactoe #fyp")
