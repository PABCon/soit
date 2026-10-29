import { describe, expect, it } from "vitest";
import {
  AD_CREDIT_CUSTOM_MAX_QTY,
  AD_CREDIT_CUSTOM_MIN_QTY,
  isValidCustomAdCreditQty,
  pricePerAdEur,
  totalPriceEurCents,
} from "./ad-credit-pricing";

describe("ad-credit-pricing", () => {
  it("passes through the three real anchor points exactly (n=1, n=5, n=200)", () => {
    expect(pricePerAdEur(1)).toBeCloseTo(59.0, 2);
    expect(pricePerAdEur(5)).toBeCloseTo(34.0, 2);
    expect(pricePerAdEur(200)).toBeCloseTo(20.0, 2);
  });

  it("is monotonically decreasing (more ads never costs more per ad)", () => {
    let prev = pricePerAdEur(1);
    for (let n = 2; n <= AD_CREDIT_CUSTOM_MAX_QTY; n++) {
      const price = pricePerAdEur(n);
      expect(price).toBeLessThan(prev);
      prev = price;
    }
  });

  it("continues smoothly past the n=5 fixed-pack boundary — no upward jump", () => {
    expect(pricePerAdEur(6)).toBeLessThan(pricePerAdEur(5));
  });

  it("rounds the total once, to the nearest cent", () => {
    expect(totalPriceEurCents(10)).toBe(Math.round(pricePerAdEur(10) * 10 * 100));
    expect(Number.isInteger(totalPriceEurCents(10))).toBe(true);
  });

  it("accepts only whole numbers within [6, 200]", () => {
    expect(isValidCustomAdCreditQty(AD_CREDIT_CUSTOM_MIN_QTY)).toBe(true);
    expect(isValidCustomAdCreditQty(AD_CREDIT_CUSTOM_MAX_QTY)).toBe(true);
    expect(isValidCustomAdCreditQty(5)).toBe(false);
    expect(isValidCustomAdCreditQty(201)).toBe(false);
    expect(isValidCustomAdCreditQty(10.5)).toBe(false);
    expect(isValidCustomAdCreditQty(NaN)).toBe(false);
    expect(isValidCustomAdCreditQty(-6)).toBe(false);
  });
});
