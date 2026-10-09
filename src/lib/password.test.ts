import { describe, expect, it } from "vitest";
import { checkPasswordRequirements, passwordMeetsRequirements } from "./password";

// Mirrors the live Supabase project's password_required_characters policy
// exactly (see supabase/config.toml) — these fixtures were cross-checked
// against the live project's own /auth/v1/signup 422 responses, not just
// this function's own logic.
describe("passwordMeetsRequirements", () => {
  it.each([
    ["weak123", false, "too short (7 chars)"],
    ["alllowercase123", false, "no uppercase"],
    ["ALLUPPERCASE123", false, "no lowercase"],
    ["NoDigitsHere", false, "no digit"],
    ["StrongPass123", true, "meets every requirement"],
  ])("%s -> %s (%s)", (password, expected) => {
    expect(passwordMeetsRequirements(password)).toBe(expected);
  });
});

describe("checkPasswordRequirements", () => {
  it("reports each requirement independently", () => {
    expect(checkPasswordRequirements("abc")).toEqual({
      length: false,
      lowercase: true,
      uppercase: false,
      digit: false,
    });
  });
});
