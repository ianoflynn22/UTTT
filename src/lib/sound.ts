// Tiny synthesized sounds + haptics. Muted state is remembered per device.
export const MUTE_KEY = "uttt-muted";
let ctx: AudioContext | null = null;
export const isMuted = () => typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
function tone(freq: number, start: number, dur: number, vol = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}
export function playSound(kind: "move" | "capture" | "win") {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ctx ??= new AudioContext();
    if (kind === "move") tone(520, 0, 0.08);
    if (kind === "capture") { tone(660, 0, 0.1); tone(880, 0.08, 0.14); }
    if (kind === "win") [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.25, 0.1));
    navigator.vibrate?.(kind === "win" ? [30, 40, 60] : kind === "capture" ? 25 : 10);
  } catch {
    /* audio unavailable */
  }
}
