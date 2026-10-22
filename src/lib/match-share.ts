export function matchShareText(o: {
  modeName: string; result: "win" | "loss" | "draw"; opponent: string | null; delta: number | null;
  moves: number; resigned: boolean; rated: boolean;
}) {
  const icon = o.result === "win" ? "🏆 Won" : o.result === "loss" ? "💀 Lost" : "🤝 Drew";
  const vs = o.opponent ? ` vs @${o.opponent}` : "";
  const elo = o.rated && o.delta != null ? ` (${o.delta >= 0 ? "+" : ""}${o.delta} Elo)` : o.rated ? "" : " (friendly)";
  const how = o.resigned && o.result === "win" ? " — they resigned" : "";
  return `UTTT+ · ${o.modeName}\n${icon}${vs}${elo} in ${o.moves} moves${how}\nPlay free: https://utttplus.com`;
}
