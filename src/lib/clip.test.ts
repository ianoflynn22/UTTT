import { describe, expect, it } from "vitest";
import { clipScript } from "./clip";
import { dailyPuzzle } from "./puzzle";

describe("daily clip", () => {
  it("is the same for the same date", () => {
    expect(JSON.stringify(clipScript("2026-10-16"))).toBe(JSON.stringify(clipScript("2026-10-16")));
  });
  it("starts from today's puzzle and ends with the defender's punishing reply", () => {
    const c = clipScript("2026-10-16");
    expect(JSON.stringify(c.states[0])).toBe(JSON.stringify(dailyPuzzle("2026-10-16").start));
    expect(c.moves.length).toBe(c.blunderAt + 2);
  });
});
