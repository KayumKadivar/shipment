import { describe, expect, it } from "vitest";
import { editedChargeRates } from "./editedChargeRates";

const previous = {
  buyRate: { freight: 100, fuel: 20, discount: -10, accesorialCostDetails: [
    { accCode: "LFG", description: "Lift gate", ratedCost: 12, billedCost: 14 },
  ] },
  sellRate: { freight: 120, fuel: 30, discount: -15, accesorialCostDetails: [
    { accCode: "LFG", description: "Lift gate", ratedCost: 18, billedCost: 21 },
  ] },
};
const line = { id: "acc-1", code: "LFG", description: "Lift gate", buyCost: 14, sellCost: 21 };

describe("editedChargeRates", () => {
  it("editedChargeRates_CoreRows_MapsDedicatedRateProperties", () => {
    expect(editedChargeRates([
      { id: "freight", code: "FRT", description: "Freight", buyCost: 150, sellCost: 180 },
      { id: "fuel", code: "FSC", description: "Fuel surcharge", buyCost: 0, sellCost: 0 },
      { id: "discount", code: "DSC", description: "Discount", buyCost: -25, sellCost: -30 },
    ], previous)).toEqual({
      buyRate: { freight: 150, fuel: 0, discount: -25, accesorialCostDetails: [] },
      sellRate: { freight: 180, fuel: 0, discount: -30, accesorialCostDetails: [] },
    });
  });

  it("editedChargeRates_UnchangedAccessorial_PreservesBilledAmounts", () => {
    const result = editedChargeRates([line], previous);
    expect(result.buyRate.accesorialCostDetails![0].billedCost).toBe(14);
    expect(result.buyRate.accesorialCostDetails![0].ratedCost).toBe(12);
    expect(result.sellRate.accesorialCostDetails![0].billedCost).toBe(21);
    expect(result.sellRate.accesorialCostDetails![0].ratedCost).toBe(18);
  });

  it("editedChargeRates_ChangedAccessorial_UpdatesRatedAndBilledAmountForThatSide", () => {
    const result = editedChargeRates([{ ...line, sellCost: 25 }], previous);
    expect(result.buyRate.accesorialCostDetails![0].billedCost).toBe(14);
    expect(result.sellRate.accesorialCostDetails![0]).toMatchObject({ ratedCost: 25, billedCost: 25 });
  });

  it("editedChargeRates_DeletedAccessorial_RemovesItFromBothSides", () => {
    const result = editedChargeRates([], previous);
    expect(result.buyRate.accesorialCostDetails).toEqual([]);
    expect(result.sellRate.accesorialCostDetails).toEqual([]);
  });
});
