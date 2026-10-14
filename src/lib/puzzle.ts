// Daily puzzle: a deterministic Ultimate position where the side to move must beat a fixed,
// deterministic defender. Each puzzle is generated with a known winning line of 5+ attacker moves.
import { applyMove, legalMoves, newGame, type GameState, type Move, type Player } from "./game";

export function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function winningMoves(s: GameState): Move[] {
  return legalMoves(s).filter((m) => {
    const n = applyMove(s, m);
    return n.over && n.winner === s.current;
  });
}

export function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export const MIN_PUZZLE_MOVES = 5;

/** Greedy one-ply policy used by both the defender and the generator's attacker. */
function policyMove(s: GameState, seed: number): Move {
  const me = s.current;
  const rng = seededRng(seed);
  let best: Move = legalMoves(s)[0]!;
  let bestScore = -Infinity;
  for (const m of legalMoves(s)) {
    const n = applyMove(s, m);
    let score = rng();
    if (n.over) score += n.winner === me ? 10000 : 0;
    else {
      if (n.completed[m.b] === me) score += 20;
      const replies = legalMoves(n);
      let threats = 0;
      for (const r of replies) {
        const k = applyMove(n, r);
        if (k.over && k.winner && k.winner !== me) { score -= 1000; break; }
        if (k.completed[r.b] && k.completed[r.b] !== me && !n.completed[r.b]) threats++;
      }
      score -= threats * 6;
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

/** The defender's reply at a given ply — deterministic so client and server agree. */
export function defenderReply(s: GameState, ply: number): Move {
  return policyMove(s, 0x5eed + ply * 101);
}

export interface DailyPuzzle {
  start: GameState;
  /** Full winning line found at generation: attacker, defender, attacker, … */
  line: Move[];
  attackerMoves: number;
}

const sameMove = (a: Move, b: Move) => a.b === b.b && a.c === b.c;

/** Replays attacker moves against the defender; returns the final state, or null if illegal. */
export function replayAttack(start: GameState, moves: Move[]): { state: GameState; line: Move[] } | null {
  let s = start;
  const line: Move[] = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]!;
    if (s.over || !legalMoves(s).some((l) => sameMove(l, m))) return null;
    s = applyMove(s, m);
    line.push(m);
    if (s.over) break;
    const r = defenderReply(s, i);
    s = applyMove(s, r);
    line.push(r);
  }
  return { state: s, line };
}

/** True if the attacker moves win the puzzle. */
export function checkSolution(p: GameState, moves: Move[]): boolean {
  const res = replayAttack(p, moves);
  return !!res && res.state.over && res.state.winner === (p.current as Player);
}

/** Same puzzle for everyone on a given UTC date. */
export function dailyPuzzle(key: string): DailyPuzzle {
  let base = 0;
  for (const ch of key) base = (base * 31 + ch.charCodeAt(0)) >>> 0;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = seededRng(base + attempt * 7919);
    let s = newGame("ultimate");
    const opening = 26 + Math.floor(rng() * 20);
    for (let i = 0; i < opening && !s.over; i++) {
      const legal = legalMoves(s);
      s = applyMove(s, legal[Math.floor(rng() * legal.length)]!, rng);
    }
    if (s.over || winningMoves(s).length) continue;
    const start = s;
    const attacker = start.current;
    const mine: Move[] = [];
    for (let i = 0; i < 25 && !s.over; i++) {
      const m = policyMove(s, base + attempt * 31 + i);
      mine.push(m);
      s = applyMove(s, m);
      if (s.over) break;
      s = applyMove(s, defenderReply(s, i));
    }
    if (s.over && s.winner === attacker && mine.length >= MIN_PUZZLE_MOVES && mine.length <= 12) {
      const res = replayAttack(start, mine)!;
      return { start, line: res.line, attackerMoves: mine.length };
    }
  }
  return { start: newGame("ultimate"), line: [], attackerMoves: 0 };
}

/** Suggested next move: the stored line while the player follows it, otherwise the policy's pick. */
export function hintMove(p: DailyPuzzle, s: GameState, playedLine: Move[]): Move {
  const onLine = playedLine.every((m, i) => p.line[i] && sameMove(m, p.line[i]!));
  const next = p.line[playedLine.length];
  if (onLine && next) return next;
  return policyMove(s, 0x41 + playedLine.length);
}
