// Builds the explainer video storyboards (voice lines + board frames) as JSON.
// Moves are played through the real engine (applyMove) so every frame follows the
// actual rules; only the starting positions are arranged by hand.
// Usage: bun scripts/tiktok/explainers.ts > scripts/tiktok/explainers.json
import { applyMove, cloneState, newGame, type GameState, type Mark, type Mode, type Player } from "../../src/lib/game";
import { frameState } from "./serialize";

type Arrow = { b: number; c: number; to: number };
interface FrameOpts {
  title: string;
  sub?: string;
  banner?: string;
  arrow?: Arrow;
  glow?: number[];
  free?: boolean;
  locked?: number;
  last?: { b: number; c: number };
  stamp?: boolean; // big celebratory hit
}
const frame = (s: GameState, o: FrameOpts) => ({ ...o, state: frameState(s) });
type Frame = ReturnType<typeof frame>;
interface Scene {
  say: string;
  frames: Frame[];
}

/** rng that yields the given values in order (0 = becomes +, 1 = normal), then normal. */
const seq = (vals: number[]) => {
  let i = 0;
  return () => (i < vals.length ? vals[i++]! : 1);
};

function mv(s: GameState, b: number, c: number, o: { rng?: number[]; free?: boolean; as?: Player } = {}): GameState {
  let t = s;
  if (o.free || o.as) {
    t = cloneState(s);
    if (o.free) t.target = null;
    if (o.as) t.current = o.as;
  }
  const n = applyMove(t, { b, c }, seq(o.rng ?? []));
  if (n === t) throw new Error(`illegal move ${b},${c}`);
  return n;
}

/** Setup only: place marks without playing a turn. */
function put(s: GameState, b: number, cells: Record<number, Mark>): GameState {
  const t = cloneState(s);
  for (const [c, m] of Object.entries(cells)) t.boards[b]![Number(c)] = m;
  return t;
}

/** Setup only: a board already won earlier in the game. */
function claimed(s: GameState, b: number, p: Player, line: number[]): GameState {
  const t = cloneState(s);
  for (const c of line) t.boards[b]![c] = p;
  t.completed[b] = p;
  t.meta[b] = p;
  return t;
}

const CTA_SAY = "Think you can beat the Bot? Play free right now, at U. T. T. T. Plus dot com!";
const cta = (s: GameState): Scene => ({
  say: CTA_SAY,
  frames: [frame(s, { title: "Think you can win?", sub: "Free · No download · Daily puzzle", banner: "utttplus.com" })],
});

function goldenRule(): Scene[] {
  const g0 = newGame("ultimate");
  const g1 = mv(g0, 4, 2);
  const g2 = mv(g1, 2, 6);
  let g3 = put(g2, 6, { 0: "X", 4: "X" });
  g3 = put(g3, 0, { 1: "O" });
  g3 = put(g3, 3, { 5: "O" });
  const g4 = mv(g3, 6, 8, { as: "X" });
  let g5 = claimed(g4, 4, "X", [0, 4, 8]);
  g5 = put(g5, 2, { 0: "X", 4: "X" });
  g5 = put(g5, 7, { 1: "O", 4: "O" });
  g5 = put(g5, 5, { 3: "O" });
  const g6 = mv(g5, 2, 8, { as: "X", free: true });
  return [
    { say: "You think you're good at Tic Tac Toe? You've never played THIS.", frames: [frame(g0, { title: "Think you're good at", sub: "Tic-Tac-Toe?", glow: [0, 1, 2, 3, 4, 5, 6, 7, 8] })] },
    { say: "Nine tiny boards, inside one big board. And here's the twist!", frames: [frame(g0, { title: "9 boards in 1", sub: "Here's the twist…" })] },
    {
      say: "X plays the top right square of the middle board. That sends O to the top right board!",
      frames: [
        frame(g1, { title: "Your square picks", sub: "THEIR board", last: { b: 4, c: 2 } }),
        frame(g1, { title: "Top-right square", sub: "→ top-right board", arrow: { b: 4, c: 2, to: 2 }, glow: [2], banner: "O must play here", last: { b: 4, c: 2 } }),
      ],
    },
    {
      say: "O plays bottom left. So now, X is forced into the bottom left board.",
      frames: [
        frame(g2, { title: "O plays bottom-left", last: { b: 2, c: 6 } }),
        frame(g2, { title: "Now X is forced", sub: "into the bottom-left board", arrow: { b: 2, c: 6, to: 6 }, glow: [6], last: { b: 2, c: 6 } }),
      ],
    },
    {
      say: "Get three in a row on a small board, and it's yours!",
      frames: [
        frame(g3, { title: "Three in a row…", sub: "claims the board", glow: [6] }),
        frame(g4, { title: "BOARD CLAIMED!", stamp: true, last: { b: 6, c: 8 } }),
      ],
    },
    {
      say: "Claim three boards in a row, and you win the whole game. Every move is a trap!",
      frames: [
        frame(g5, { title: "3 boards in a row", sub: "wins the game", glow: [2] }),
        frame(g6, { title: "X WINS!", sub: "Every move is a trap", stamp: true, last: { b: 2, c: 8 } }),
      ],
    },
    cta(g6),
  ];
}

function freeMove(): Scene[] {
  let s = newGame("ultimate");
  s = claimed(s, 0, "X", [0, 4, 8]);
  s = put(s, 0, { 1: "O", 2: "O" });
  s = put(s, 4, { 2: "X", 6: "X", 0: "O" });
  s = put(s, 3, { 4: "X" });
  s = put(s, 8, { 4: "O", 0: "O" });
  s = put(s, 1, { 8: "O" });
  s = cloneState(s);
  s.current = "O";
  s.target = 3;
  const n = mv(s, 3, 0); // sends X to finished board 0 → free move
  const w = mv(n, 4, 4); // X uses the free move to claim the centre
  return [
    { say: "This one sneaky rule changes everything in Ultimate Tic Tac Toe!", frames: [frame(s, { title: "The FREE MOVE", sub: "rule nobody tells you" })] },
    { say: "X has already won the top left board.", frames: [frame(s, { title: "X owns this board", glow: [0] })] },
    {
      say: "Now O plays the top left square, which sends X to that finished board!",
      frames: [
        frame(n, { title: "O plays top-left…", last: { b: 3, c: 0 } }),
        frame(n, { title: "…but that board", sub: "is already finished!", arrow: { b: 3, c: 0, to: 0 }, locked: 0, last: { b: 3, c: 0 } }),
      ],
    },
    { say: "So X gets a free move. X can play anywhere on the whole board!", frames: [frame(n, { title: "FREE MOVE!", sub: "Play in ANY open board", free: true, banner: "Anywhere you want" })] },
    {
      say: "And X uses it to steal the middle board. Brutal!",
      frames: [frame(n, { title: "X picks the middle", glow: [4], free: true }), frame(w, { title: "BOARD STOLEN!", stamp: true, last: { b: 4, c: 4 } })],
    },
    { say: "So never send your opponent to a finished board, unless you want to hand them a free move.", frames: [frame(w, { title: "Pro tip", sub: "Don't send them to a finished board" })] },
    cta(w),
  ];
}

function tttPlus(): Scene[] {
  const t0 = newGame("tttplus");
  const t1 = mv(t0, 0, 5);
  const t2 = mv(t1, 0, 6);
  const t3 = mv(t2, 0, 10, { rng: [0] }); // becomes +
  const t4 = mv(t3, 0, 9);
  const t5 = mv(t4, 0, 0);
  const t6 = mv(t5, 0, 3);
  const t7 = mv(t6, 0, 15);
  return [
    { say: "Normal Tic Tac Toe is way too easy. So we made it bigger, with a wild card!", frames: [frame(t0, { title: "Tic-Tac-Toe+", sub: "Bigger. Wilder." })] },
    {
      say: "It's played on a four by four board. Get four in a row to win.",
      frames: [frame(t1, { title: "4 × 4 board", sub: "Get FOUR in a row", last: { b: 0, c: 5 } }), frame(t2, { title: "4 × 4 board", sub: "Get FOUR in a row", last: { b: 0, c: 6 } })],
    },
    { say: "But every move has a one in six chance to turn into a gold plus!", frames: [frame(t3, { title: "WILD CARD!", sub: "1 in 6 moves becomes +", last: { b: 0, c: 10 }, stamp: true })] },
    {
      say: "A plus counts for both players, and there can be up to three on the board.",
      frames: [frame(t4, { title: "+ counts for BOTH", sub: "Max 3 per board", last: { b: 0, c: 9 } }), frame(t6, { title: "+ counts for BOTH", sub: "Max 3 per board", last: { b: 0, c: 3 } })],
    },
    { say: "X has three X's and a plus on the diagonal. Four in a row. X wins!", frames: [frame(t7, { title: "X WINS!", sub: "3 X's + 1 wild card", stamp: true, last: { b: 0, c: 15 } })] },
    cta(t7),
  ];
}

function utttPlus(): Scene[] {
  const all = Array.from({ length: 16 }, (_, i) => i);
  const u0 = newGame("ultimateplus");
  const u1 = mv(u0, 5, 10);
  const u2 = mv(u1, 10, 3, { rng: [0] }); // O's move becomes + and sends X to board 3
  let u3 = put(u2, 3, { 0: "X", 1: "X", 2: "X" });
  u3 = put(u3, 10, { 5: "O", 6: "O" });
  u3 = put(u3, 12, { 9: "O" });
  const u4 = mv(u3, 3, 3, { as: "X" }); // claims board 3 (row), sends O to board 3? finished → free
  let u5 = put(u4, 6, { 0: "X", 5: "X", 10: "X" });
  const u6 = mv(u5, 6, 15, { as: "X", free: true, rng: [1, 0] }); // claimed, but becomes + on the big board
  let u7 = claimed(u6, 0, "X", [0, 5, 10, 15]);
  u7 = claimed(u7, 1, "X", [3, 6, 9, 12]);
  u7 = put(u7, 2, { 0: "X", 4: "X", 8: "X" });
  u7 = put(u7, 9, { 1: "O", 2: "O" });
  const u8 = mv(u7, 2, 12, { as: "X", free: true });
  return [
    { say: "Ultimate Tic Tac Toe Plus. This is the final boss.", frames: [frame(u0, { title: "UTTT+", sub: "The final boss" })] },
    { say: "Sixteen boards, each one four by four. That's two hundred and fifty six squares!", frames: [frame(u0, { title: "16 boards · 4×4 each", sub: "256 squares!", glow: all })] },
    {
      say: "Same golden rule. The square you pick sends your opponent to that board.",
      frames: [
        frame(u1, { title: "Your square picks", sub: "THEIR board", last: { b: 5, c: 10 } }),
        frame(u1, { title: "Your square picks", sub: "THEIR board", arrow: { b: 5, c: 10, to: 10 }, glow: [10], last: { b: 5, c: 10 } }),
      ],
    },
    { say: "Gold plus tiles count for both players. Up to three on every board!", frames: [frame(u2, { title: "WILD CARDS", sub: "+ counts for both players", last: { b: 10, c: 3 }, stamp: true })] },
    {
      say: "Get four in a row to claim a board. But watch out, a won board can turn into a plus on the big board too!",
      frames: [
        frame(u3, { title: "4 in a row", sub: "claims the board", glow: [3] }),
        frame(u4, { title: "BOARD CLAIMED!", stamp: true, last: { b: 3, c: 3 } }),
        frame(u6, { title: "…or a big +!", sub: "Won boards can go wild too", stamp: true, last: { b: 6, c: 15 } }),
      ],
    },
    {
      say: "Claim four boards in a row, and you win it all!",
      frames: [frame(u7, { title: "4 boards in a row", sub: "wins the game", glow: [2] }), frame(u8, { title: "X WINS!", stamp: true, last: { b: 2, c: 12 } })],
    },
    cta(u8),
  ];
}

const videos: { id: string; mode: Mode; title: string; caption: string; scenes: Scene[] }[] = [
  { id: "golden-rule", mode: "ultimate", title: "Ultimate Tic-Tac-Toe in 30 seconds", caption: "The tic-tac-toe you never knew 🤯 Your square picks THEIR board. Play free at utttplus.com #ultimatetictactoe #tictactoe #boardgames #puzzle #fyp", scenes: goldenRule() },
  { id: "free-move", mode: "ultimate", title: "The Free Move rule", caption: "The sneaky rule that wins games 👀 Send them to a finished board = free move. Play free at utttplus.com #ultimatetictactoe #strategy #tictactoe #fyp", scenes: freeMove() },
  { id: "ttt-plus", mode: "tttplus", title: "Tic-Tac-Toe+ explained", caption: "Tic-tac-toe but 4×4 with WILD CARDS 🃏 Play free at utttplus.com #tictactoe #boardgames #puzzle #fyp", scenes: tttPlus() },
  { id: "uttt-plus", mode: "ultimateplus", title: "UTTT+ explained", caption: "256 squares. Wild cards. The final boss of tic-tac-toe 💀 Play free at utttplus.com #ultimatetictactoe #tictactoe #strategy #fyp", scenes: utttPlus() },
];

for (const v of videos) {
  const end = v.scenes[v.scenes.length - 2]!.frames.at(-1)!.state;
  if (!end.winner && v.id !== "free-move") throw new Error(`${v.id} should end with a win`);
}
console.log(JSON.stringify({ videos }));
