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

import { replayStates as _replay, applyMove as _apply, newGame as _new } from "./game";
describe("replayStates", () => {
  it("rebuilds the exact final position, including random pluses", () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let s = _new("ultimateplus");
    const moves: { b: number; c: number }[] = [];
    for (let i = 0; i < 120 && !s.over; i++) {
      const legal = [] as { b: number; c: number }[];
      s.boards.forEach((bd, b) => bd.forEach((_, c) => { const n = _apply(s, { b, c }, () => 1); if (n !== s) legal.push({ b, c }); }));
      const m = legal[Math.floor(rng() * legal.length)]!;
      moves.push(m);
      s = _apply(s, m, rng);
    }
    const states = _replay("ultimateplus", moves, s);
    expect(states).toHaveLength(moves.length + 1);
    expect(states[states.length - 1]!.boards).toEqual(s.boards);
    expect(states[states.length - 1]!.meta).toEqual(s.meta);
  });
});
