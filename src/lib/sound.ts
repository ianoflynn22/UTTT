// Synthesized sounds, ambient music and haptics. Settings are remembered per device.
export const MUTE_KEY = "uttt-muted";
export const AUDIO_KEY = "uttt-audio";

export type AudioSettings = { master: number; music: number; sfx: number; muted: boolean };
export const DEFAULT_AUDIO: AudioSettings = { master: 80, music: 0, sfx: 80, muted: false };

export function clampVolume(v: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
}

export function loadAudio(): AudioSettings {
  if (typeof localStorage === "undefined") return DEFAULT_AUDIO;
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "{}");
    if (raw.musicOn === false) raw.music = 0;
    delete raw.musicOn;
    const s = { ...DEFAULT_AUDIO, ...raw, muted: raw.muted ?? localStorage.getItem(MUTE_KEY) === "1" };
    return { ...s, master: clampVolume(s.master), music: clampVolume(s.music), sfx: clampVolume(s.sfx) };
  } catch {
    return DEFAULT_AUDIO;
  }
}

/** Effective gain (0–1) for a channel: master × channel, zero when muted. */
export function channelGain(s: AudioSettings, channel: "music" | "sfx") {
  if (s.muted) return 0;
  return (s.master / 100) * (s[channel] / 100);
}

let settings: AudioSettings = DEFAULT_AUDIO;
let loaded = false;
let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;

const get = () => {
  if (!loaded && typeof window !== "undefined") { settings = loadAudio(); loaded = true; }
  return settings;
};
export const isMuted = () => get().muted;

function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(ctx.destination);
    musicBus.connect(ctx.destination);
    applyGains();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function applyGains() {
  if (!ctx || !sfxBus || !musicBus) return;
  const s = get();
  sfxBus.gain.setTargetAtTime(channelGain(s, "sfx"), ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(channelGain(s, "music") * 0.5, ctx.currentTime, 0.3);
}

export function setAudio(next: AudioSettings) {
  settings = next;
  loaded = true;
  localStorage.setItem(AUDIO_KEY, JSON.stringify(next));
  localStorage.setItem(MUTE_KEY, next.muted ? "1" : "0");
  if (next.music > 0 && next.master > 0 && !next.muted) startMusic();
  else stopMusic();
  applyGains();
}

function tone(freq: number, start: number, dur: number, vol = 0.08) {
  if (!ctx || !sfxBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur);
}

export function playSound(kind: "move" | "capture" | "win") {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ensureCtx();
    if (kind === "move") tone(520, 0, 0.08);
    if (kind === "capture") { tone(660, 0, 0.1); tone(880, 0.08, 0.14); }
    if (kind === "win") [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.25, 0.1));
    navigator.vibrate?.(kind === "win" ? [30, 40, 60] : kind === "capture" ? 25 : 10);
  } catch {
    /* audio unavailable */
  }
}

// Gentle ambient pad: slow chord changes through a soft lowpass filter.
const CHORDS = [
  [220, 261.63, 329.63], // Am
  [174.61, 220, 261.63], // F
  [196, 246.94, 293.66], // G
  [164.81, 196, 246.94], // Em
];
let chordIdx = 0;
function playChord() {
  if (!ctx || !musicBus) return;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.connect(musicBus);
  const t = ctx.currentTime;
  for (const f of CHORDS[chordIdx % CHORDS.length]!) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + 9.2);
    }
  }
  chordIdx++;
}

export function startMusic() {
  if (typeof window === "undefined" || musicTimer) return;
  try {
    ensureCtx();
    playChord();
    musicTimer = setInterval(playChord, 7000);
  } catch {
    /* audio unavailable */
  }
}
export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

/** Browsers only allow audio after a tap; resume music on the first interaction. */
export function initAudio() {
  if (typeof window === "undefined") return;
  const s = get();
  if (s.music === 0 || s.muted) return;
  const kick = () => { startMusic(); window.removeEventListener("pointerdown", kick); };
  window.addEventListener("pointerdown", kick);
}
