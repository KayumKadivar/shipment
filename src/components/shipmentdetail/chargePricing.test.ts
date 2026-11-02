import { describe, expect, it } from "vitest";
import { applyChargePricing, calculateChargeMarkup, defaultChargePricing, type ChargeMarkupOption } from "./chargePricing";

/** Deterministic buy amounts with a discount and an accessorial. */
const lines = [
  { code: "FRT", description: "Freight", buyCost: 100, sellCost: 120 },
  { code: "DSC", description: "Discount", buyCost: -10, sellCost: -15 },
  { code: "FSC", description: "Fuel surcharge", buyCost: 20, sellCost: 30 },
  { code: "LFG", description: "Lift gate", buyCost: 40, sellCost: 45 },
];

describe("chargePricing", () => {
  it.each<[ChargeMarkupOption, number]>([
    ["% Freight", 9], ["% Freight + Fuel", 11], ["% Freight + Fuel + Accessorial", 15],
  ])("calculateChargeMarkup_%s_UsesMatchingBuyBase", (markupDropdownOption, expected) => {
    const result = calculateChargeMarkup(lines, { ...defaultChargePricing, isMarkupEnabled: true, markupDropdownOption, markupRate: "10" });
    expect(result.freight + result.fuel).toBeCloseTo(expected, 2);
  });

  it("calculateChargeMarkup_PercentageBelowMinimum_AppliesMinimum", () => {
    const result = calculateChargeMarkup(lines, { ...defaultChargePricing, isMarkupEnabled: true, markupDropdownOption: "% Freight", markupRate: "10", minimum: "15" });
    expect(result).toEqual({ freight: 12.27, fuel: 2.73 });
  });

  it("calculateChargeMarkup_RoundingRemainder_AssignsRemainderToFuel", () => {
    expect(calculateChargeMarkup(lines, { ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150" })).toEqual({ freight: 122.73, fuel: 27.27 });
  });

  it("calculateChargeMarkup_ZeroAllocationBase_ReturnsZeroIncrements", () => {
    expect(calculateChargeMarkup([], { ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150" })).toEqual({ freight: 0, fuel: 0 });
  });

  it("applyChargePricing_AppliedMarkup_ReplacesManualSellAmounts", () => {
    const result = applyChargePricing(lines, { ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150" });
    [222.73, -10, 47.27, 40].forEach((expected, index) => expect(result[index].sellCost).toBeCloseTo(expected, 2));
    expect(lines[0].sellCost).toBe(120);
  });

  it("applyChargePricing_NetSellApplied_PreservesSourceRows", () => {
    const result = applyChargePricing(lines, { ...defaultChargePricing, isNetSellRateEnabled: true, netSellRate: "200" });
    expect(result.map((line) => [line.buyCost, line.sellCost])).toEqual([[100, 200], [-10, 0], [20, 0], [40, 0]]);
    expect(lines[2].buyCost).toBe(20);
  });
  it("applyChargePricing_NetSellApplied_PreservesEveryBuyAmount", () => {
    const result = applyChargePricing(lines, {
      ...defaultChargePricing, isNetSellRateEnabled: true, netSellRate: "200",
    });
    expect(result.map((line) => line.buyCost)).toEqual(lines.map((line) => line.buyCost));
  });

});
