// Script for the daily social clip: today's puzzle, playing along the real
// winning line until X captures a mini-board, then a blunder — after which the
// Bot is allowed to punish it all the way to winning the whole game.
// Pure + deterministic.
import { applyMove, findWin, legalMoves, type GameState, type Move, type Player } from "./game";
import { dailyPuzzle, defenderReply } from "./puzzle";

export interface ClipScript {
  date: string;
  par: number;
  states: GameState[]; // states[0] = start, then one per move
  moves: Move[];
  blunderAt: number; // index into moves of the first blunder
  lost: boolean; // defender won the whole game
}

/** Winning 3-in-a-row lines for drawing: per completed mini-board and for the overall board. */
export function winLines(s: GameState): { boards: (number[] | null)[]; meta: number[] | null } {
  if (!s.ultimate) {
    const w = findWin(s.boards[0]!, s.size);
    return { boards: [w ? w.line : null], meta: null };
  }
  const boards = s.boards.map((cells, b) =>
    s.completed[b] === "X" || s.completed[b] === "O" ? (findWin(cells, s.size)?.line ?? null) : null,
  );
  const m = s.winner ? findWin(s.meta, s.size) : null;
  return { boards, meta: m ? m.line : null };
}

const MAX_PLIES = 80;

/** Attacker move that most helps the defender (without the attacker winning by accident). */
function worstMove(s: GameState, ply: number, defender: Player): Move | null {
  let pick: Move | null = null;
  let best = -Infinity;
  for (const m of legalMoves(s)) {
    const n = applyMove(s, m);
    if (n.over && n.winner !== defender) continue; // never let the attacker win or draw here
    const r = defenderReply(n, ply);
    const k = applyMove(n, r);
    let score = 0;
    if (k.over && k.winner === defender) score = 100;
    else if (k.completed[r.b] === defender && n.completed[r.b] === null) score = 10;
    // Prefer sending the defender somewhere it already leads on the big board.
    score += k.completed.filter((w) => w === defender).length;
    score -= k.completed.filter((w) => w !== null && w !== defender).length * 0.5;
    if (score > best) {
      best = score;
      pick = m;
    }
  }
  return pick;
}

function play(date: string, prefix: number) {
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
  const defender: Player = attacker === "X" ? "O" : "X";
  for (let i = 0; i < prefix && !s.over; i++) push(p.line[i]!);
  const blunderAt = moves.length;
  while (!s.over && moves.length < MAX_PLIES) {
    const ply = Math.floor(moves.length / 2);
    const m = s.current === attacker ? worstMove(s, ply, defender) : defenderReply(s, ply);
    if (!m) break;
    push(m);
  }
  return { date, par: p.attackerMoves, states, moves, blunderAt, lost: s.winner === defender };
}

/** How many winning-line moves to show: until the attacker captures a mini-board and the Bot replies. */
function naturalPrefix(date: string): number {
  const p = dailyPuzzle(date);
  const attacker = p.start.current;
  let s = p.start;
  for (let i = 0; i < p.line.length && i < 6; i++) {
    const prev = s.completed.filter((w) => w === attacker).length;
    s = applyMove(s, p.line[i]!);
    if (s.over) return i; // never show the actual solution's final move
    if (i % 2 === 0 && s.completed.filter((w) => w === attacker).length > prev) return Math.min(i + 2, p.line.length - 1);
  }
  return Math.min(6, p.line.length - 1);
}

export function clipScript(date: string): ClipScript {
  // Prefer the natural cut; if the Bot can't finish the game from there, blunder earlier.
  const n = naturalPrefix(date);
  let fallback: ClipScript | null = null;
  for (let k = n; k >= 0; k -= 2) {
    const c = play(date, k);
    if (c.lost) return c;
    fallback ??= c;
  }
  return fallback!;
}
