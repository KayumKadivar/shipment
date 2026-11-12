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
  it("calculateChargeMarkup_whenMarkupHasFractionalCents_preservesDeferredRounding", () => {
    expect(calculateChargeMarkup([
      { ...lines[0], buyCost: 1 }, { ...lines[2], buyCost: 1 },
    ], { ...defaultChargePricing, isMarkupEnabled: true, markupRate: "0.005" }))
      .toEqual({ freight: 0, fuel: 0.01 });
  });

  it("calculateChargeMarkup_whenAllocationBaseIsNegative_returnsZeroIncrements", () => {
    expect(calculateChargeMarkup([{ ...lines[0], buyCost: -1 }], {
      ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150",
    })).toEqual({ freight: 0, fuel: 0 });
  });

  it("calculateChargeMarkup_whenBuyAmountIsNull_treatsItAsZero", () => {
    expect(calculateChargeMarkup([{ ...lines[0], buyCost: null }, lines[2]], {
      ...defaultChargePricing, isMarkupEnabled: true, markupRate: "10",
    })).toEqual({ freight: 0, fuel: 10 });
  });

  it("calculateChargeMarkup_whenBothModesAreEnabled_stillReturnsMarkupIncrements", () => {
    expect(calculateChargeMarkup(lines, {
      ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150",
      isNetSellRateEnabled: true, netSellRate: "200",
    })).toEqual({ freight: 122.73, fuel: 27.27 });
  });

  it.each(["invalid", "-5", ""])("applyChargePricing_whenNetSellIs%s_normalizesToZero", (netSellRate) => {
    expect(applyChargePricing(lines, { ...defaultChargePricing, isNetSellRateEnabled: true, netSellRate })
      .map((line) => line.sellCost)).toEqual([0, 0, 0, 0]);
  });

  it("applyChargePricing_whenBothModesAreEnabled_prioritizesNetSell", () => {
    expect(applyChargePricing(lines, {
      ...defaultChargePricing, isMarkupEnabled: true, markupRate: "150",
      isNetSellRateEnabled: true, netSellRate: "200",
    }).map((line) => line.sellCost)).toEqual([200, 0, 0, 0]);
  });

  it("applyChargePricing_whenMultipleFreightRowsExist_setsEachToNetSell", () => {
    const source = [{ ...lines[0], id: "first" }, { ...lines[0], id: "second" }];
    expect(applyChargePricing(source, {
      ...defaultChargePricing, isNetSellRateEnabled: true, netSellRate: "200",
    })).toEqual(source.map((line) => ({ ...line, sellCost: 200 })));
  });

  it("applyChargePricing_whenIncrementsAreSupplied_usesSuppliedAmounts", () => {
    expect(applyChargePricing(lines, defaultChargePricing, { freight: 7, fuel: 3 })
      .map((line) => line.sellCost)).toEqual([107, -10, 23, 40]);
  });

  it("applyChargePricing_whenNeitherModeIsEnabled_restoresBuyAmounts", () => {
    expect(applyChargePricing(lines, defaultChargePricing).map((line) => line.sellCost))
      .toEqual(lines.map((line) => line.buyCost));
  });
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
