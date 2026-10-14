import { describe, expect, it } from "vitest";
import { isUsernameBlocked } from "./username-filter";

describe("username filter", () => {
  it("blocks slurs", () => expect(isUsernameBlocked("xX_Faggot_Xx")).toBe(true));
  it("blocks number swaps", () => expect(isUsernameBlocked("r3t4rd")).toBe(true));
  it("allows normal names", () => expect(isUsernameBlocked("Ianoflynn")).toBe(false));
  it("allows place names", () => expect(isUsernameBlocked("Scunthorpe")).toBe(false));
  it("allows mild words", () => expect(isUsernameBlocked("damn_good")).toBe(false));
});
