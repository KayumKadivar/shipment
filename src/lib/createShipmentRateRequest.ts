import type { EditShipmentRateRequest } from "../types/editShipment.types";
import type { ShipmentRate } from "../types/shipment.types";

/** Converts an optional amount and rejects values JSON cannot represent. */
function finiteAmount(value: number | null | undefined): number {
  if (value == null) return 0;
  if (!Number.isFinite(value)) throw new Error("Shipment amounts must be finite numbers.");
  return value;
}

/** Creates a detached shipment rate with an absolute discount and both accessorial costs. */
export function createShipmentRateRequest(rate: ShipmentRate | null): EditShipmentRateRequest {
  return {
    freight: finiteAmount(rate?.freight),
    fuel: finiteAmount(rate?.fuel),
    discount: Math.abs(finiteAmount(rate?.discount)),
    accesorialCostDetails: (rate?.accesorialCostDetails ?? []).map((detail) => ({
      accCode: detail.accCode ?? "",
      description: detail.description ?? "",
      ratedCost: finiteAmount(detail.ratedCost ?? detail.billedCost),
      billedCost: finiteAmount(detail.billedCost ?? detail.ratedCost),
    })),
  };
}
