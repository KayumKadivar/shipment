import type { ShipmentRate } from "../../types/shipment.types";
import { chargePricingKind } from "./chargePricing";

/** One accepted table row, independent of the table's editor state. */
type AcceptedChargeLine = {
  id: string;
  code: string;
  description: string;
  buyCost: number | null;
  sellCost: number | null;
};

/** Serializes current rows, preserving billed values for untouched accessorial amounts. */
export function editedChargeRates(
  lines: readonly AcceptedChargeLine[],
  previous: { buyRate: ShipmentRate | null; sellRate: ShipmentRate | null },
): { buyRate: ShipmentRate; sellRate: ShipmentRate } {
  const side = (field: "buyCost" | "sellCost", original: ShipmentRate | null): ShipmentRate => {
    const rate: ShipmentRate = { freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] };
    for (const line of lines) {
      const kind = chargePricingKind(line);
      const value = line[field];
      if (kind !== "accessorial") {
        rate[kind] = (rate[kind] ?? 0) + (value ?? 0);
        continue;
      }
      const existing = original?.accesorialCostDetails?.find((detail) =>
        detail.accCode?.trim().toUpperCase() === line.code.trim().toUpperCase()
        && (detail.description ?? "").trim().toLowerCase() === line.description.trim().toLowerCase());
      // The table displays billed cost when present, falling back to rated cost.
      const unchanged = existing && (existing.billedCost ?? existing.ratedCost) === value;
      rate.accesorialCostDetails!.push({
        accCode: line.code, description: line.description,
        ratedCost: unchanged ? existing.ratedCost : value,
        billedCost: unchanged ? existing.billedCost : value,
      });
    }
    return rate;
  };
  return { buyRate: side("buyCost", previous.buyRate), sellRate: side("sellCost", previous.sellRate) };
}
