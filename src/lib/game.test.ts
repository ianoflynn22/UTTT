import { describe, expect, it } from "vitest";
import { applyMove, newGame, legalMoves, fromJson } from "./game";
import { chooseMove } from "./ai";

const never = () => 1;
const always = () => 0;

describe("game rules", () => {
  it("X wins three in a row", () => {
    let s = newGame("ttt");
    for (const c of [0, 3, 1, 4, 2]) s = applyMove(s, { b: 0, c }, never);
    expect(s.winner).toBe("X");
  });
  it("plus mode caps + symbols at 3", () => {
    let s = newGame("tttplus");
    for (const c of [0, 5, 10, 15, 1]) s = applyMove(s, { b: 0, c }, always);
    expect(s.boards[0]!.filter((v) => v === "+").length).toBe(3);
  });
  it("ultimate sends opponent to the board matching the cell", () => {
    const s = applyMove(newGame("ultimate"), { b: 4, c: 7 }, never);
    expect(s.target).toBe(7);
    expect(legalMoves(s).every((m) => m.b === 7)).toBe(true);
  });
  it("medium AI takes a winning move", () => {
    let s = newGame("ttt");
    for (const c of [0, 3, 1, 4]) s = applyMove(s, { b: 0, c }, never);
    expect(chooseMove(s, "medium")).toEqual({ b: 0, c: 2 });
  });
});

describe("game state JSON round trip (online games)", () => {
  it("restores an identical state from JSON", () => {
    let s = newGame("ultimateplus");
    s = applyMove(s, { b: 4, c: 7 }, always); // forces a +
    s = applyMove(s, { b: 7, c: 0 }, never);
    const restored = fromJson("ultimateplus", JSON.parse(JSON.stringify(s)));
    expect(restored).toEqual(s);
  });
  it("returns null for malformed JSON instead of throwing", () => {
    expect(fromJson("ttt", null)).toBeNull();
    expect(fromJson("ttt", "nope")).toBeNull();
    expect(fromJson("ttt", { boards: "x" })).not.toBeNull();
  });
});
