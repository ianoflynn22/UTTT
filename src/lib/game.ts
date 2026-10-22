// Pure game engine for Tic-Tac-Toe, TTT Plus, Ultimate and Ultimate Plus.
// Rules ported from the original GitHub Pages version.

export type Mode = "ttt" | "tttplus" | "ultimate" | "ultimateplus";
export type Player = "X" | "O";
export type Mark = Player | "+" | null;
export type Rng = () => number;

export const MAX_PLUS = 3;
export const PLUS_PROBABILITY = 1 / 6;

export interface Move {
  b: number; // board index (always 0 for normal modes)
  c: number; // cell index
}

export interface GameState {
  mode: Mode;
  size: number;
  ultimate: boolean;
  boards: Mark[][]; // normal modes use a single board
  completed: (Player | "D" | null)[]; // ultimate only; null = in play
  meta: Mark[]; // ultimate only
  localPlus: number[];
  metaPlus: number;
  target: number | null;
  current: Player;
  winner: Player | null;
  over: boolean;
  lastMove: Move | null;
}

const linesCache = new Map<number, number[][]>();
export function winningLines(size: number): number[][] {
  const cached = linesCache.get(size);
  if (cached) return cached;
  const res: number[][] = [];
  for (let r = 0; r < size; r++) res.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) res.push(Array.from({ length: size }, (_, r) => r * size + c));
  res.push(Array.from({ length: size }, (_, i) => i * size + i));
  res.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  linesCache.set(size, res);
  return res;
}

/** Returns the winning line and the player it belongs to. "+" counts for either player. */
export function findWin(cells: Mark[], size: number): { line: number[]; player: Player } | null {
  for (const player of ["X", "O"] as const) {
    for (const line of winningLines(size)) {
      if (line.every((i) => cells[i] === player || cells[i] === "+")) return { line, player };
    }
  }
  return null;
}

export const isPlusMode = (m: Mode) => m === "tttplus" || m === "ultimateplus";

export function newGame(mode: Mode): GameState {
  const ultimate = mode === "ultimate" || mode === "ultimateplus";
  const size = mode === "ttt" || mode === "ultimate" ? 3 : 4;
  const count = ultimate ? size * size : 1;
  return {
    mode,
    size,
    ultimate,
    boards: Array.from({ length: count }, () => Array(size * size).fill(null)),
    completed: Array(count).fill(null),
    meta: Array(count).fill(null),
    localPlus: Array(count).fill(0),
    metaPlus: 0,
    target: null,
    current: "X",
    winner: null,
    over: false,
    lastMove: null,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    boards: s.boards.map((b) => b.slice()),
    completed: s.completed.slice(),
    meta: s.meta.slice(),
    localPlus: s.localPlus.slice(),
  };
}

export function isLegal(s: GameState, m: Move): boolean {
  if (s.over) return false;
  if (!s.ultimate) return m.b === 0 && s.boards[0]![m.c] === null;
  if (s.completed[m.b] !== null || s.boards[m.b]![m.c] !== null) return false;
  if (s.target !== null && s.completed[s.target] === null && m.b !== s.target) return false;
  return true;
}

export function legalMoves(s: GameState): Move[] {
  const out: Move[] = [];
  if (s.over) return out;
  for (let b = 0; b < s.boards.length; b++) {
    for (let c = 0; c < s.boards[b]!.length; c++) if (isLegal(s, { b, c })) out.push({ b, c });
  }
  return out;
}

/** Applies a move, returning a new state. `rng` decides whether a Plus appears. */
export function applyMove(prev: GameState, m: Move, rng: Rng = Math.random): GameState {
  if (!isLegal(prev, m)) return prev;
  const s = cloneState(prev);
  s.lastMove = m;
  const plus = isPlusMode(s.mode);

  if (!s.ultimate) {
    const cells = s.boards[0]!;
    if (plus && s.localPlus[0]! < MAX_PLUS && rng() < PLUS_PROBABILITY) {
      cells[m.c] = "+";
      s.localPlus[0]!++;
    } else cells[m.c] = s.current;
    const win = findWin(cells, s.size);
    if (win) {
      s.winner = win.player;
      s.over = true;
    } else if (cells.every((v) => v !== null)) s.over = true;
    else s.current = s.current === "X" ? "O" : "X";
    return s;
  }

  const cells = s.boards[m.b]!;
  if (plus && s.localPlus[m.b]! < MAX_PLUS && rng() < PLUS_PROBABILITY) {
    cells[m.c] = "+";
    s.localPlus[m.b]!++;
  } else cells[m.c] = s.current;

  const win = findWin(cells, s.size);
  if (win) {
    s.completed[m.b] = win.player;
    if (plus && s.metaPlus < MAX_PLUS && rng() < PLUS_PROBABILITY) {
      s.meta[m.b] = "+";
      s.metaPlus++;
    } else s.meta[m.b] = win.player;
    const metaWin = findWin(s.meta, s.size);
    if (metaWin) {
      s.winner = metaWin.player;
      s.over = true;
      return s;
    }
  } else if (cells.every((v) => v !== null)) s.completed[m.b] = "D";

  s.target = s.completed[m.c] === null ? m.c : null;
  s.current = s.current === "X" ? "O" : "X";
  if (s.completed.every((v) => v !== null)) s.over = true;
  return s;
}

export const MODE_INFO: Record<Mode, { name: string; rules: string }> = {
  ttt: { name: "Tic-Tac-Toe", rules: "Get three Xs or Os in a row, column, or diagonal." },
  tttplus: {
    name: "Tic-Tac-Toe Plus",
    rules:
      "Play on a 4×4 board and get four in a row, column, or diagonal. Each move has a 1/6 chance to become +. A + counts for either player. There can be at most 3 + symbols.",
  },
  ultimate: {
    name: "Ultimate Tic-Tac-Toe",
    rules:
      "Win local boards to win the overall game. Your cell choice decides the opponent's next board. If that board is already complete, the opponent may play on any open board.",
  },
  ultimateplus: {
    name: "Ultimate Tic-Tac-Toe Plus",
    rules:
      "Ultimate on 4×4 local boards. Each local board can hold up to 3 + symbols; each move has a 1/6 chance to become +, which counts for either player. A won board's overall result can also turn into +, with a separate maximum of 3 on the big board.",
  },
};

/** Rebuilds a GameState from JSON stored server-side (online games). Returns null if malformed. */
export function fromJson(mode: Mode, raw: unknown): GameState | null {
  const base = newGame(mode);
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const mark = (v: unknown): Mark => (v === "X" || v === "O" || v === "+" ? v : null);
  const result = (v: unknown): Player | "D" | null => (v === "X" || v === "O" || v === "D" ? v : null);
  const boards = base.boards.map((b, i) => {
    const src = Array.isArray(o["boards"]) ? o["boards"][i] : null;
    return Array.isArray(src) ? src.map(mark) : b;
  });
  const completed = base.completed.map((_, i) => result(Array.isArray(o["completed"]) ? o["completed"][i] : null));
  const meta = base.meta.map((_, i) => mark(Array.isArray(o["meta"]) ? o["meta"][i] : null));
  const localPlus = base.localPlus.map((_, i) => {
    const v = Array.isArray(o["localPlus"]) ? o["localPlus"][i] : 0;
    return typeof v === "number" && Number.isFinite(v) ? Math.min(MAX_PLUS, Math.max(0, Math.round(v))) : 0;
  });
  const target =
    typeof o["target"] === "number" && Number.isInteger(o["target"]) && o["target"] >= 0 && o["target"] < base.boards.length
      ? o["target"]
      : null;
  const lastRaw = o["lastMove"] as { b?: unknown; c?: unknown } | null | undefined;
  const lastMove =
    lastRaw && typeof lastRaw.b === "number" && typeof lastRaw.c === "number"
      ? { b: lastRaw.b, c: lastRaw.c }
      : null;
  return {
    mode,
    size: base.size,
    ultimate: base.ultimate,
    boards,
    completed,
    meta,
    localPlus,
    metaPlus:
      typeof o["metaPlus"] === "number" && Number.isFinite(o["metaPlus"])
        ? Math.min(MAX_PLUS, Math.max(0, Math.round(o["metaPlus"])))
        : 0,
    target,
    current: o["current"] === "O" ? "O" : "X",
    winner: o["winner"] === "X" || o["winner"] === "O" ? o["winner"] : null,
    over: o["over"] === true,
    lastMove,
  };
}

/**
 * Rebuilds every position of a finished game from its move list.
 * Pluses are random, so we read the final board to know which moves became "+"
 * (a placed mark is never overwritten). Returns [start, after move 1, ...].
 */
export function replayStates(mode: Mode, moves: Move[], final: GameState | null): GameState[] {
  const out: GameState[] = [newGame(mode)];
  for (const m of moves) {
    const s = out[out.length - 1]!;
    if (!isLegal(s, m)) break;
    const queue: number[] = [];
    if (isPlusMode(mode)) {
      if (s.localPlus[m.b]! < MAX_PLUS) queue.push(final?.boards[m.b]?.[m.c] === "+" ? 0 : 1);
      queue.push(final?.meta[m.b] === "+" ? 0 : 1);
    }
    out.push(applyMove(s, m, () => queue.shift() ?? 1));
  }
  return out;
}
