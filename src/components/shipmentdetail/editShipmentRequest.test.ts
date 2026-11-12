import { describe, expect, it } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import { createShipmentDetailEditValues } from "./detailEditValues";
import { createEditShipmentRequest } from "./editShipmentRequest";

/** Loaded values deliberately include metadata unavailable in the page editors. */
const shipment = {
  loadNumber: "LOAD-100", clientCode: "CLIENT-42", bolStatus: "Booked",
  originName: "Warehouse", orgCityName: "Atlanta", orgStateCode: "GA", orgPostalCode: "30303",
  destCityName: "Chicago", destStateCode: "IL", destPostalCode: "60606",
  pickupdate: "2026-11-06T14:30:00Z", expectedShipDate: "2026-11-06T14:30:00Z",
  requestedDeliveryDate: "2026-11-10T12:00:00Z", userName: "creator", ref1Value: "hidden-reference",
  products: [{ productDescription: "Freight", productWeight: 100, skuNumber: "SKU-42", accountNumber: "ACCOUNT-1", pcf: 12.5 }],
  bolDispatchNotes: ["Use dock 3"], accessorials: ["LFG"],
  buyRate: { freight: 150, fuel: 0, discount: -25, accesorialCostDetails: [] },
  sellRate: { freight: 180, fuel: 0, discount: -30, accesorialCostDetails: [
    { accCode: "LFG", description: "Lift gate", ratedCost: 12, billedCost: 14 },
  ] },
} as unknown as ShipmentDetails;

describe("createEditShipmentRequest", () => {
  it("createEditShipmentRequest_UneditedMetadata_PreservesHiddenFields", () => {
    const result = createEditShipmentRequest({ shipment, detailValues: createShipmentDetailEditValues(shipment), username: null });
    expect(result).toMatchObject({ ref1Value: "hidden-reference", expectedShipDate: shipment.expectedShipDate, userName: "creator" });
    expect(result.products[0]).toMatchObject({ skuNumber: "SKU-42", accountNumber: "ACCOUNT-1", pcf: 12.5 });
    expect(result).not.toHaveProperty("saasQuoteNumber");
  });

  it("createEditShipmentRequest_EditedPickupAddress_MapsApiLocationFields", () => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), pickupCityStateZip: "Austin, TX, 78701", pickupAddressLine1: "20 Main St" };
    expect(createEditShipmentRequest({ shipment, detailValues, username: "editor" })).toMatchObject({
      orgCityName: "Austin", orgStateCode: "TX", orgPostalCode: "78701", originAddress1: "20 Main St", userName: "editor",
    });
  });

  it.each(["11/7/2026", "11/7/26"])("createEditShipmentRequest_EditedCalendarDate_PreservesSelectedDay_%s", (date) => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), schedulePickupDate: date };
    expect(createEditShipmentRequest({ shipment, detailValues, username: null }).pickupdate).toBe("2026-11-07T00:00:00.000Z");
  });

  it("createEditShipmentRequest_UneditedDate_RetainsOriginalTimestamp", () => {
    expect(createEditShipmentRequest({ shipment, detailValues: createShipmentDetailEditValues(shipment), username: null }).pickupdate).toBe(shipment.pickupdate);
  });

  it("createEditShipmentRequest_ClearedDeliveryDate_SendsNull", () => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), scheduleDeliveryDate: "" };
    expect(createEditShipmentRequest({ shipment, detailValues, username: null }).requestedDeliveryDate).toBeNull();
  });

  it.each(["2/30/2026", "not-a-date"])("createEditShipmentRequest_InvalidDate_Rejects_%s", (date) => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), schedulePickupDate: date };
    expect(() => createEditShipmentRequest({ shipment, detailValues, username: null })).toThrow("valid calendar date");
  });

  it("createEditShipmentRequest_MalformedLocation_RejectsBeforePosting", () => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), deliveryCityStateZip: "Chicago" };
    expect(() => createEditShipmentRequest({ shipment, detailValues, username: null })).toThrow("City, State, ZIP");
  });

  it.each(["8:00 AM\u20145:00 PM", "8:00 AM\u00e2\u20ac\u201d5:00 PM"])("createEditShipmentRequest_EditedTimeRange_MapsBothEndpoints_%s", (time) => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), schedulePickupTime: time };
    expect(createEditShipmentRequest({ shipment, detailValues, username: null })).toMatchObject({ pickUpReadyTime: "8:00 AM", pickUpCloseTime: "5:00 PM", pickupTime: "8:00 AM" });
  });

  it("createEditShipmentRequest_InvalidTime_RejectsBeforePosting", () => {
    const detailValues = { ...createShipmentDetailEditValues(shipment), scheduleDeliveryTime: "25:61" };
    expect(() => createEditShipmentRequest({ shipment, detailValues, username: null })).toThrow("valid times");
  });

  it("createEditShipmentRequest_AcceptedRates_PreservesZeroDiscountAndBilledAmounts", () => {
    const result = createEditShipmentRequest({ shipment, detailValues: createShipmentDetailEditValues(shipment), username: null });
    expect(result.sellRate).toEqual({ freight: 180, fuel: 0, discount: -30, accesorialCostDetails: [
      { accCode: "LFG", description: "Lift gate", ratedCost: 12, billedCost: 14 },
    ] });
  });

  it("createEditShipmentRequest_NotesAndAccessorials_CreatesDetachedCollections", () => {
    const result = createEditShipmentRequest({ shipment, detailValues: createShipmentDetailEditValues(shipment), username: null });
    expect(result.bolDispatchNotes).toEqual(["Use dock 3"]);
    expect(result.bolDispatchNotes).not.toBe(shipment.bolDispatchNotes);
    expect(result.accessorials).toEqual(["LFG"]);
    expect(result.accessorials).not.toBe(shipment.accessorials);
  });
});
