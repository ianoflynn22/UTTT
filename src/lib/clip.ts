// Script for the daily social clip: today's puzzle, a few good-looking moves, then a blunder
// the defender punishes. Pure + deterministic so the same clip comes out for a given date.
import { applyMove, legalMoves, type GameState, type Move } from "./game";
import { dailyPuzzle, defenderReply } from "./puzzle";

export interface ClipScript {
  date: string;
  par: number;
  states: GameState[]; // states[0] = start, then one per move
  moves: Move[];
  blunderAt: number; // index into moves of the blunder
  lost: boolean; // defender won the whole game (otherwise it captured a board)
}

export function clipScript(date: string): ClipScript {
  const p = dailyPuzzle(date);
  let s = p.start;
  const states = [s];
  const moves: Move[] = [];
  const push = (m: Move) => { s = applyMove(s, m); moves.push(m); states.push(s); };
  const good = Math.max(1, Math.min(3, p.attackerMoves - 2));
  // Follow the real winning line for a few attacker moves (attacker + defender pairs).
  for (let i = 0; i < good * 2 && p.line[i] && !s.over; i++) push(p.line[i]!);
  const ply = good;
  // Rank candidate blunders: defender wins outright > defender captures a board.
  let pick: Move | null = null;
  let best = -1;
  for (const m of legalMoves(s)) {
    const n = applyMove(s, m);
    if (n.over) continue;
    const r = defenderReply(n, ply);
    const k = applyMove(n, r);
    const score = k.over && k.winner === n.current ? 2 : k.completed[r.b] === n.current && !n.completed[r.b] ? 1 : 0;
    if (score > best) { best = score; pick = m; }
  }
  const blunderAt = moves.length;
  if (pick) {
    push(pick);
    push(defenderReply(s, ply));
  }
  return { date, par: p.attackerMoves, states, moves, blunderAt, lost: best === 2 };
}
