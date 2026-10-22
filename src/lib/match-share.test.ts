import { describe, it, expect } from "vitest";
import { matchShareText } from "./match-share";
describe("matchShareText", () => {
  it("shows a rated win with Elo gain", () => {
    expect(matchShareText({ modeName: "UTTT", result: "win", opponent: "bob", delta: 16, moves: 28, resigned: false, rated: true }))
      .toBe("UTTT+ · UTTT\n🏆 Won vs @bob (+16 Elo) in 28 moves\nPlay free: https://utttplus.com");
  });
  it("marks a resignation as a win and friend games as friendly", () => {
    expect(matchShareText({ modeName: "UTTT", result: "win", opponent: "bob", delta: null, moves: 9, resigned: true, rated: false }))
      .toContain("🏆 Won vs @bob (friendly) in 9 moves — they resigned");
  });
});
