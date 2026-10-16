import { describe, expect, it } from "vitest";
import { channelGain, clampVolume, DEFAULT_AUDIO } from "./sound";

describe("audio volumes", () => {
  it("volumes stay within 0–100%", () => {
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(-5)).toBe(0);
  });
  it("master scales each channel", () => {
    expect(channelGain({ ...DEFAULT_AUDIO, master: 50, sfx: 50 }, "sfx")).toBe(0.25);
  });
  it("mute silences everything", () => {
    expect(channelGain({ ...DEFAULT_AUDIO, muted: true }, "music")).toBe(0);
    expect(channelGain({ ...DEFAULT_AUDIO, muted: true }, "sfx")).toBe(0);
  });
  it("music is off by default", () => {
    expect(channelGain(DEFAULT_AUDIO, "music")).toBe(0);
  });
});
