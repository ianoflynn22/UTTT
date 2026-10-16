import { playSound } from "@/lib/sound";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { findWin, isPlusMode, MAX_PLUS, type GameState, type Mark, type Move } from "@/lib/game";

export function markClass(v: Mark) {
  return v === "X" ? "text-player-x" : v === "O" ? "text-player-o" : v === "+" ? "text-player-plus" : "";
}

export function GameBoard({
  cells, size, disabled, onPlay, winLine, last, small, hintCell,
}: {
  cells: Mark[]; size: number; disabled: (i: number) => boolean; onPlay: (i: number) => void;
  winLine: number[] | null; last: number | null; small?: boolean; hintCell?: number | null;
}) {
  return (
    <div className="grid gap-[2px] bg-grid-line p-[2px] rounded-md" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
      {cells.map((v, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled(i)}
          onClick={() => onPlay(i)}
          aria-label={`Cell ${i + 1}${v ? ` ${v}` : ""}`}
          className={cn(
            "aspect-square bg-cell font-display font-bold leading-none transition-colors enabled:hover:bg-accent disabled:cursor-default",
            small ? "text-[clamp(0.8rem,3.2vw,1.5rem)]" : "text-[clamp(2rem,12vw,4rem)]",
            markClass(v),
            winLine?.includes(i) && "bg-player-plus/20",
            last === i && "ring-1 ring-inset ring-primary/60",
            hintCell === i && "bg-player-plus/30 ring-2 ring-inset ring-player-plus",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Full board section for a game state: single board or the ultimate grid, plus counters. */
export function BoardView({ state, locked, onPlay, hintBoard, hintCell }: { state: GameState; locked: boolean; onPlay: (m: Move) => void; hintBoard?: number | null; hintCell?: Move | null }) {
  const plus = isPlusMode(state.mode);
  const filled = state.boards.flat().filter((c) => c !== null).length;
  const captured = state.completed.filter((c) => c !== null).length;
  const prev = useRef<{ filled: number; captured: number; over: boolean } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = { filled, captured, over: state.over };
    if (!p || filled <= p.filled) return;
    if (state.over && !p.over) playSound("win");
    else if (captured > p.captured) playSound("capture");
    else playSound("move");
  }, [filled, captured, state.over]);
  return (
    <section className="mx-auto mt-6" style={{ maxWidth: state.ultimate ? 720 : 440 }}>
      {plus && (
        <p className="mb-3 text-center font-mono text-xs uppercase text-muted-foreground">
          <span className="text-player-plus">+</span>{" "}
          {state.ultimate ? `Overall board: ${state.metaPlus}/${MAX_PLUS} used` : `${state.localPlus[0]}/${MAX_PLUS} used`}
        </p>
      )}
      {!state.ultimate ? (
        <GameBoard
          cells={state.boards[0]!}
          size={state.size}
          disabled={(i) => locked || state.boards[0]![i] !== null}
          onPlay={(c) => onPlay({ b: 0, c })}
          winLine={state.winner ? findWin(state.boards[0]!, state.size)?.line ?? null : null}
          last={state.lastMove?.c ?? null}
        />
      ) : (
        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${state.size}, minmax(0,1fr))` }}>
          {state.boards.map((cells, b) => {
            const done = state.completed[b];
            const active = !state.over && done === null && (state.target === null || state.completed[state.target] !== null || state.target === b);
            return (
              <div key={b} className={cn("relative rounded-lg border-2 bg-card p-1 transition-colors", active && !locked ? "border-primary" : "border-border", done && "opacity-90", hintBoard === b && "border-player-plus ring-4 ring-player-plus/40")}>
                <GameBoard
                  small
                  cells={cells}
                  size={state.size}
                  disabled={(i) => locked || !active || cells[i] !== null}
                  onPlay={(c) => onPlay({ b, c })}
                  winLine={done && done !== "D" ? findWin(cells, state.size)?.line ?? null : null}
                  last={state.lastMove?.b === b ? state.lastMove.c : null}
                  hintCell={hintCell?.b === b ? hintCell.c : null}
                />
                {plus && (
                  <p className="mt-1 text-center font-mono text-[10px] uppercase text-muted-foreground">
                    <span className="text-player-plus">+</span> {state.localPlus[b]}/{MAX_PLUS}
                  </p>
                )}
                {done && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-background/60">
                    <span className={cn("font-display text-[clamp(2rem,9vw,4.5rem)] font-bold", done === "D" ? "text-muted-foreground" : markClass(state.meta[b] ?? null))}>
                      {done === "D" ? "—" : state.meta[b]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
