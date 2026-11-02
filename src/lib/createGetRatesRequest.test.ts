import { describe, expect, it } from "vitest";
import { createGetRatesRequest } from "./createGetRatesRequest";

describe("GetRates DTO mapping", () => {
  it("createGetRatesRequest_whenInputContainsLegacyFields_emitsOnlyContractKeys", () => {
    const shipments = [{ class: "70", weight: 500, hazMat: true, weightUnit: "Lbs" }];
    const result = createGetRatesRequest({
      profileCode: "OLD", codAmount: 25, isAudit: false,
      shipments,
    });
    expect(Object.keys(result).sort()).toEqual([
      "serviceToken", "origZip", "origCity", "origState", "origCountry",
      "destZip", "destCity", "destState", "destCountry", "shipments",
      "accessorialCodes", "clientCode", "scac", "shipmentDate", "miles",
      "serviceLevelCode", "mode", "resultCount", "totalLength", "totalWidth",
      "totalHeight", "shipmentValue", "originPortCode", "destPortCode",
      "equipment", "totalLinearFeet", "ratingProfileCode", "ratingClientCode", "clientName",
    ].sort());
    expect(Object.keys(result.shipments[0]).sort()).toEqual([
      "class", "weight", "units", "cubicFeet", "hazMat", "nmfc", "pallets",
      "pieces", "length", "width", "height", "packageType", "linearFeet",
      "stackable", "description",
    ].sort());
  });

  it("createGetRatesRequest_whenValuesAreMissing_usesContractDefaults", () => {
    const result = createGetRatesRequest({ shipments: [{}] });
    expect(result.origCity).toBe("");
    expect(result.totalWidth).toBe(0);
    expect(result.accessorialCodes).toEqual([]);
    expect(result.shipments[0]).toEqual({
      class: "", weight: 0, units: 0, cubicFeet: 0, hazMat: false,
      nmfc: "", pallets: 0, pieces: 0, length: 0, width: 0, height: 0,
      packageType: "", linearFeet: 0, stackable: false, description: "",
    });
  });

  it("createGetRatesRequest_whenValuesAreSupplied_preservesNumbersZeroAndFalse", () => {
    const result = createGetRatesRequest({
      shipmentValue: 125, totalLinearFeet: 0,
      shipments: [{ weight: "500", units: 0, hazMat: false, stackable: true }],
    });
    expect(result).toMatchObject({ shipmentValue: 125, totalLinearFeet: 0 });
    expect(result.shipments[0]).toMatchObject({ weight: 500, units: 0, hazMat: false, stackable: true });
  });

  it("createGetRatesRequest_whenSourceCollectionsChange_keepsAnIndependentSnapshot", () => {
    const payload = { accessorialCodes: ["LIFT"], shipments: [{ weight: 500 }] };
    const result = createGetRatesRequest(payload);
    payload.accessorialCodes.push("RES");
    payload.shipments[0].weight = 900;
    expect(result.accessorialCodes).toEqual(["LIFT"]);
    expect(result.shipments[0].weight).toBe(500);
  });
});
