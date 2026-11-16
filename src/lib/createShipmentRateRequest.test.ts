import { describe, expect, it } from "vitest";
import type { ShipmentRate } from "../types/shipment.types";
import { createShipmentRateRequest } from "./createShipmentRateRequest";

/** Creates an isolated rate with representative shipment charges. */
function rate(): ShipmentRate {
  return {
    freight: 4478.4, fuel: 149.04, discount: -4314.94,
    accesorialCostDetails: [{ accCode: "MIS", description: "Charge", ratedCost: 104.5, billedCost: 110 }],
  };
}

describe("createShipmentRateRequest", () => {
  it.each([-4314.94, 4314.94, 0, -0])("createShipmentRateRequest_Discount_ReturnsAbsoluteAmount_%s", (discount) => {
    expect(createShipmentRateRequest({ ...rate(), discount }).discount).toBe(Math.abs(discount));
  });

  it("createShipmentRateRequest_DistinctCosts_PreservesAmountsAndMetadata", () => {
    expect(createShipmentRateRequest(rate())).toEqual({
      freight: 4478.4, fuel: 149.04, discount: 4314.94,
      accesorialCostDetails: [{ accCode: "MIS", description: "Charge", ratedCost: 104.5, billedCost: 110 }],
    });
  });

  it.each([
    [104.5, null, 104.5, 104.5],
    [null, 110, 110, 110],
    [104.5, undefined, 104.5, 104.5],
    [undefined, 110, 110, 110],
    [0, 110, 0, 110],
    [104.5, 0, 104.5, 0],
    [null, null, 0, 0],
    [undefined, undefined, 0, 0],
  ])("createShipmentRateRequest_OptionalCosts_NormalizesOnlyMissingValues_%s_%s", (ratedCost, billedCost, expectedRated, expectedBilled) => {
    // Undefined models omitted fields in an incoming API response.
    const source = { ...rate(), accesorialCostDetails: [{ accCode: "MIS", description: "Charge", ratedCost, billedCost }] } as ShipmentRate;
    expect(createShipmentRateRequest(source).accesorialCostDetails[0]).toEqual({
      accCode: "MIS", description: "Charge", ratedCost: expectedRated, billedCost: expectedBilled,
    });
  });

  it("createShipmentRateRequest_NullRate_ReturnsZeroAmountsAndEmptyAccessorials", () => {
    expect(createShipmentRateRequest(null)).toEqual({ freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] });
  });

  it.each(["freight", "fuel", "discount", "ratedCost", "billedCost"] as const)("createShipmentRateRequest_NonFiniteAmount_Rejects_%s", (field) => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const source = rate();
      if (field === "ratedCost" || field === "billedCost") source.accesorialCostDetails![0][field] = value;
      else source[field] = value;
      expect(() => createShipmentRateRequest(source)).toThrow("Shipment amounts must be finite numbers.");
    }
  });

  it("createShipmentRateRequest_SourceRate_ReturnsDetachedValuesWithoutMutatingInput", () => {
    const source = rate();
    const original = structuredClone(source);
    const result = createShipmentRateRequest(source);
    expect(source).toEqual(original);
    expect(result).not.toBe(source);
    expect(result.accesorialCostDetails).not.toBe(source.accesorialCostDetails);
    expect(result.accesorialCostDetails[0]).not.toBe(source.accesorialCostDetails![0]);
  });
});
