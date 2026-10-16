// Prints today's clip script as JSON for render.py. Usage: bun scripts/tiktok/data.ts [YYYY-MM-DD]
import { clipScript } from "../../src/lib/clip";
import { dateKey } from "../../src/lib/puzzle";

const date = process.argv[2] ?? dateKey();
const c = clipScript(date);
console.log(JSON.stringify({
  date: c.date,
  par: c.par,
  blunderAt: c.blunderAt,
  lost: c.lost,
  moves: c.moves,
  attacker: c.states[0]!.current,
  states: c.states.map((s) => ({ boards: s.boards, completed: s.completed, target: s.target, over: s.over, winner: s.winner })),
}));
