import { describe, it, expect } from "vitest";
import { weekStart } from "./weekly.functions";

describe("weekly leaderboard reset", () => {
  it("resets on Monday 00:00 UTC", () => {
    expect(weekStart(new Date("2026-10-23T07:49:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-25T23:59:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-26T00:01:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});
