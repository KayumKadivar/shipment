import { describe, expect, it } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import { createShipmentDetailEditValues } from "./detailEditValues";

describe("createShipmentDetailEditValues", () => {
  it("createShipmentDetailEditValues_whenBillToValuesAreReturned_mapsTrimmedEditableValues", () => {
    const shipment = {
      loadNumber: "LOAD-100",
      billToName: "  Billing Company  ",
      billToAddress1: "  10 Main Street  ",
      billToAddress2: "  Suite 200  ",
      billToCityName: "  Chicago  ",
      billToStateCode: " IL ",
      billToPostalCode: " 60606 ",
      billToCountryCode: " USA ",
      billToFaxNo: " 3125550100 ",
    } as ShipmentDetails;

    const values = createShipmentDetailEditValues(shipment);

    expect({
      billToName: values.billToName,
      billToAddress1: values.billToAddress1,
      billToAddress2: values.billToAddress2,
      billToCityName: values.billToCityName,
      billToStateCode: values.billToStateCode,
      billToPostalCode: values.billToPostalCode,
      billToCountryCode: values.billToCountryCode,
      billToFaxNo: values.billToFaxNo,
    }).toEqual({
      billToName: "Billing Company",
      billToAddress1: "10 Main Street",
      billToAddress2: "Suite 200",
      billToCityName: "Chicago",
      billToStateCode: "IL",
      billToPostalCode: "60606",
      billToCountryCode: "USA",
      billToFaxNo: "3125550100",
    });
  });

  it("createShipmentDetailEditValues_whenBillToValuesAreNull_mapsEmptyEditableValues", () => {
    const shipment = {
      loadNumber: "LOAD-100",
      billToName: null,
      billToAddress1: null,
      billToAddress2: null,
      billToCityName: null,
      billToStateCode: null,
      billToPostalCode: null,
      billToCountryCode: null,
      billToFaxNo: null,
    } as ShipmentDetails;

    const values = createShipmentDetailEditValues(shipment);

    expect({
      billToName: values.billToName,
      billToAddress1: values.billToAddress1,
      billToAddress2: values.billToAddress2,
      billToCityName: values.billToCityName,
      billToStateCode: values.billToStateCode,
      billToPostalCode: values.billToPostalCode,
      billToCountryCode: values.billToCountryCode,
      billToFaxNo: values.billToFaxNo,
    }).toEqual({
      billToName: "",
      billToAddress1: "",
      billToAddress2: "",
      billToCityName: "",
      billToStateCode: "",
      billToPostalCode: "",
      billToCountryCode: "",
      billToFaxNo: "",
    });
  });

  it("createShipmentDetailEditValues_whenNotesAreReturned_mapsTheDisplayedNoteValues", () => {
    const shipment = {
      loadNumber: "LOAD-100",
      originNote: null,
      carrierNote: "  Pickup instructions  ",
      destNote: "  Delivery instructions  ",
    } as ShipmentDetails;

    const values = createShipmentDetailEditValues(shipment);

    expect({
      pickupNote: values.pickupNote,
      deliveryNote: values.deliveryNote,
    }).toEqual({
      pickupNote: "Pickup instructions",
      deliveryNote: "Delivery instructions",
    });
  });
});
