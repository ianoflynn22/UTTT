// Shared: turn a GameState into the compact JSON the Python renderers draw.
import type { GameState } from "../../src/lib/game";
import { winLines } from "../../src/lib/clip";

export function frameState(s: GameState) {
  const lines = winLines(s);
  return {
    ultimate: s.ultimate,
    size: s.size,
    boards: s.boards,
    completed: s.completed,
    meta: s.meta,
    target: s.target,
    current: s.current,
    over: s.over,
    winner: s.winner,
    boardLines: lines.boards,
    metaLine: lines.meta,
  };
}
