import { applyMove, legalMoves, type GameState, type Move, type Player } from "./game";

export type Difficulty = "easy" | "medium" | "hard";

const noPlus = () => 1; // rng that never produces a Plus — used for "what if" checks
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

/** Moves that win immediately (or win a local board in ultimate) for `player`. */
function strongMoves(s: GameState, player: Player): Move[] {
  const probe = { ...s, current: player };
  return legalMoves(probe).filter((m) => {
    const n = applyMove(probe, m, noPlus);
    return n.winner === player || (s.ultimate && n.completed[m.b] === player);
  });
}

function playout(s: GameState): Player | null {
  let cur = s;
  while (!cur.over) cur = applyMove(cur, pick(legalMoves(cur)));
  return cur.winner;
}

function monteCarlo(s: GameState, budgetMs: number): Move {
  const moves = legalMoves(s);
  const me = s.current;
  const score = new Array(moves.length).fill(0);
  const plays = new Array(moves.length).fill(0);
  const end = Date.now() + budgetMs;
  let i = 0;
  while (Date.now() < end || i < moves.length * 4) {
    const k = i++ % moves.length;
    const w = playout(applyMove(s, moves[k]!));
    plays[k]++;
    score[k] += w === me ? 1 : w === null ? 0.4 : 0;
    if (i > 200000) break;
  }
  let best = 0;
  for (let k = 1; k < moves.length; k++) if (score[k]! / plays[k]! > score[best]! / plays[best]!) best = k;
  return moves[best]!;
}

export function chooseMove(s: GameState, level: Difficulty): Move | null {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  if (level === "easy") return pick(moves);
  const opp: Player = s.current === "X" ? "O" : "X";
  const win = strongMoves(s, s.current).find((m) => applyMove(s, m, noPlus).winner === s.current);
  if (win) return win;
  if (level === "medium") {
    const mine = strongMoves(s, s.current);
    if (mine.length) return pick(mine);
    const block = strongMoves(s, opp);
    if (block.length) return pick(block);
    return pick(moves);
  }
  return monteCarlo(s, s.ultimate ? 900 : 300);
}
