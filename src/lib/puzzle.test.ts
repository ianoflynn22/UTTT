import { describe, expect, it } from "vitest";
import { checkSolution, dailyPuzzle, MIN_PUZZLE_MOVES, winningMoves } from "./puzzle";

describe("daily puzzle", () => {
  it("is the same for everyone on the same day", () => {
    expect(JSON.stringify(dailyPuzzle("2026-10-14"))).toBe(JSON.stringify(dailyPuzzle("2026-10-14")));
  });
  it("needs 5+ moves, has no instant win, and its stored line wins", () => {
    for (const d of ["2026-10-14", "2026-10-15", "2027-01-01", "2027-06-30"]) {
      const p = dailyPuzzle(d);
      expect(p.attackerMoves).toBeGreaterThanOrEqual(MIN_PUZZLE_MOVES);
      expect(winningMoves(p.start)).toHaveLength(0);
      expect(checkSolution(p.start, p.line.filter((_, i) => i % 2 === 0))).toBe(true);
    }
  });
});
