// Shared rating stat bits: Elo number + W/L/D record.
// Elo and records use the body font with tabular numerals for a clean look.
import { cn } from "@/lib/utils";

export function Elo({ value, className }: { value: number; className?: string }) {
  return <span className={cn("font-semibold tabular-nums tracking-tight", className)}>{value}</span>;
}

export function Wld({ w, l, d, className }: { w: number; l: number; d: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2.5", className)}>
      <Stat k="W" v={w} tone="text-player-o" />
      <Stat k="D" v={d} />
      <Stat k="L" v={l} tone="text-destructive" />
    </span>
  );
}

function Stat({ k, v, tone }: { k: string; v: number; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={cn("font-semibold tabular-nums text-foreground", tone)}>{v}</span>
      <span className="font-mono text-[10px] uppercase text-muted-foreground">{k}</span>
    </span>
  );
}
