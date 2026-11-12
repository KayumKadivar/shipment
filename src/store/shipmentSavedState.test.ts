import { describe, expect, it } from "vitest";
import type { ShipmentDetails } from "../types/shipment.types";
import reducer, { applySavedShipment, fetchShipmentByLoadNumber } from "./shipmentSlice";

const shipment = { loadNumber: "LOAD-100", proNumber: "PRO-1", products: [{ skuNumber: "SKU-42" }] } as ShipmentDetails;

/** Creates a loaded detail state using the public read actions. */
function loadedState() {
  const pending = reducer(undefined, fetchShipmentByLoadNumber.pending("read-1", "LOAD-100"));
  return reducer(pending, fetchShipmentByLoadNumber.fulfilled(shipment, "read-1", "LOAD-100"));
}

describe("applySavedShipment", () => {
  it("applySavedShipment_CurrentShipment_UpdatesTheFullSavedBaseline", () => {
    const saved = { ...shipment, proNumber: "PRO-2" };
    const state = reducer(loadedState(), applySavedShipment(saved));
    expect(state.currentShipment).toEqual(saved);
    expect(state.currentShipment?.products[0].skuNumber).toBe("SKU-42");
  });

  it("applySavedShipment_DifferentShipmentRequested_IgnoresPreviousSave", () => {
    const next = reducer(loadedState(), fetchShipmentByLoadNumber.pending("read-2", "LOAD-200"));
    const state = reducer(next, applySavedShipment({ ...shipment, proNumber: "STALE-PRO" }));
    expect(state.currentShipment).toBeNull();
    expect(state.requestedLoadNumber).toBe("LOAD-200");
  });
});
