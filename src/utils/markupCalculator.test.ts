import { describe, expect, it } from "vitest";
import { applyMarkupToRate, calculateMarkupDistribution, type MarkupDistributionParams } from "./markupCalculator";

/** Equal freight and fuel expose allocation differences for fractional-cent markup. */
const params: MarkupDistributionParams = {
  netFreightBuy: 1, fuelBuy: 1, totalBuy: 2,
  markupDropdownOption: "Flat", markupRate: "0.005",
  isMarkupEnabled: true, isNetSellRateEnabled: false,
};

describe("calculateMarkupDistribution", () => {
  it("calculateMarkupDistribution_whenRoundingIsDefault_roundsBeforeAllocation", () => {
    expect(calculateMarkupDistribution(params)).toEqual({
      calculatedMarkup: 0.01, ppsFreight: 0.01, ppsFuel: 0, isNetSellActive: false,
    });
  });

  it("calculateMarkupDistribution_whenRoundingIsDeferred_roundsAfterAllocation", () => {
    expect(calculateMarkupDistribution({ ...params, roundMarkupBeforeDistribution: false })).toEqual({
      calculatedMarkup: 0.005, ppsFreight: 0, ppsFuel: 0.01, isNetSellActive: false,
    });
  });

  it("calculateMarkupDistribution_whenAllocationBaseIsZero_preservesFreightFallback", () => {
    expect(calculateMarkupDistribution({ ...params, netFreightBuy: 0, fuelBuy: 0, markupRate: 150 }))
      .toMatchObject({ ppsFreight: 150, ppsFuel: 0 });
  });

  it("calculateMarkupDistribution_whenBothModesAreEnabled_prioritizesNetSell", () => {
    expect(calculateMarkupDistribution({ ...params, isNetSellRateEnabled: true, netSellRate: 200 }))
      .toEqual({ calculatedMarkup: 198, ppsFreight: 200, ppsFuel: 0, isNetSellActive: true });
  });
});

it("applyMarkupToRate_whenRoundingIsUnspecified_preservesCarrierRounding", () => {
  expect(applyMarkupToRate({ id: "carrier", price: 2, grossCharge: 1, fuelSurcharge: 1 }, {
    isMarkupEnabled: true, markupDropdownOption: "Flat", numericMarkup: 0,
    numericMarkupRate: 0.005, isNetSellRateEnabled: false, numericNetSellRate: 0,
  })).toMatchObject({ sellPrice: 2.01, grossSell: 1.01, fuelSell: 1, markupAmount: 0.01 });
});

it("applyMarkupToRate_whenRatePriceIsZeroOrNegative_doesNotApplyMarkup", () => {
  const errorRate = {
    id: "error-carrier",
    name: "Clear Lane",
    code: "CLNI",
    price: 0,
    grossCharge: 0,
    discount: 0,
    fuelSurcharge: 0,
  };

  const result = applyMarkupToRate(errorRate, {
    isMarkupEnabled: true,
    markupDropdownOption: "Flat",
    numericMarkup: 0,
    numericMarkupRate: 150,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
  });

  expect(result.sellPrice).toBe(0);
  expect(result.grossSell).toBe(0);
  expect(result.markupAmount).toBe(0);
  expect(result.isNetSellActive).toBe(false);
});
