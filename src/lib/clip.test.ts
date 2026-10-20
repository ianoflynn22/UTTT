import { describe, expect, it } from "vitest";
import { clipScript, winLines } from "./clip";
import { dailyPuzzle } from "./puzzle";

describe("daily clip", () => {
  it("is the same for the same date", () => {
    expect(JSON.stringify(clipScript("2026-10-16"))).toBe(JSON.stringify(clipScript("2026-10-16")));
  });
  it("starts from today's puzzle", () => {
    const c = clipScript("2026-10-16");
    expect(JSON.stringify(c.states[0])).toBe(JSON.stringify(dailyPuzzle("2026-10-16").start));
  });
  it("ends with the Bot winning the whole game, not just a mini-board", () => {
    for (const d of ["2026-10-16", "2026-10-19", "2026-10-25", "2026-11-03"]) {
      const c = clipScript(d);
      const end = c.states[c.states.length - 1]!;
      const bot = c.states[0]!.current === "X" ? "O" : "X";
      expect(c.lost).toBe(true);
      expect(end.winner).toBe(bot);
      expect(winLines(end).meta).not.toBeNull();
    }
  });
});
