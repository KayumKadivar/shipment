import { describe, expect, it } from "vitest";
import { mapShipmentListItem } from "./shipmentListMapping";
import type { ShipmentListItem } from "../types/shipment.types";

describe("shipment row client context", () => {
  it("mapShipmentListItem_whenApiClientCodeHasWhitespace_preservesItsTrimmedValue", () => {
    const result = mapShipmentListItem({ bolNo: "LOAD", clientCode: " CLIENT-A " } as ShipmentListItem);
    expect(result.clientCode).toBe("CLIENT-A");
  });

  it.each([null, "", "   "])("mapShipmentListItem_whenClientCodeIsMissing_keepsItNull (%s)", (clientCode) => {
    const result = mapShipmentListItem({ bolNo: "LOAD", clientCode } as ShipmentListItem);
    expect(result.clientCode).toBeNull();
  });
});
