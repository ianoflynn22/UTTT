// Script for the daily social clip: today's puzzle, playing until X captures
// a mini-board, then a blunder the defender punishes. Pure + deterministic.
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
  const push = (m: Move) => {
    s = applyMove(s, m);
    moves.push(m);
    states.push(s);
  };

  const attacker = p.start.current;

  // Follow the real winning line until the attacker captures at least one mini-board
  let idx = 0;
  while (idx < p.line.length && !s.over) {
    const prevCaptures = s.completed.filter((w) => w === attacker).length;
    const m = p.line[idx]!;
    push(m);
    idx++;

    const newCaptures = s.completed.filter((w) => w === attacker).length;
    // idx % 2 === 1 means this move was just played by the attacker
    if (newCaptures > prevCaptures && idx % 2 === 1) {
      if (idx < p.line.length && !s.over) {
        push(p.line[idx]!);
        idx++;
      }
      break;
    }

    if (idx >= 6) break;
  }

  if (moves.length === 0) {
    for (let i = 0; i < Math.min(2, p.line.length) && !s.over; i++) push(p.line[i]!);
  }

  const ply = Math.floor(moves.length / 2);
  let pick: Move | null = null;
  let best = -1;
  for (const m of legalMoves(s)) {
    const n = applyMove(s, m);
    if (n.over) continue;
    const r = defenderReply(n, ply);
    const k = applyMove(n, r);
    const score = k.over && k.winner === n.current ? 2 : k.completed[r.b] === n.current && !n.completed[r.b] ? 1 : 0;
    if (score > best) {
      best = score;
      pick = m;
    }
  }

  if (!pick) {
    const legal = legalMoves(s);
    pick = legal[0] ?? null;
  }

  const blunderAt = moves.length;
  if (pick) {
    push(pick);
    push(defenderReply(s, ply));
  }
  return { date, par: p.attackerMoves, states, moves, blunderAt, lost: best === 2 };
}
