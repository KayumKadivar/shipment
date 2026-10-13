// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import Details from "./Details";
import { createShipmentDetailEditValues } from "./detailEditValues";

const shipment = {
  loadNumber: "LOAD-100",
  billToName: "Billing Company",
  billToAddress1: "10 Main Street",
  billToAddress2: "Suite 200",
  billToCityName: "Chicago",
  billToStateCode: "IL",
  billToPostalCode: "60606",
  billToCountryCode: "USA",
  billToFaxNo: "3125550100",
  originNote: "Pickup instructions",
  destNote: "Delivery instructions",
} as ShipmentDetails;

describe("Details", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Details_whenRendered_showsBillToApiValuesInsteadOfBookingInfo", () => {
    render(
      <Details
        shipment={shipment}
        activeEditor={null}
        values={createShipmentDetailEditValues(shipment)}
        onFieldChange={vi.fn()}
        onBeginEditing={vi.fn()}
        onSaveEditing={vi.fn()}
        onCancelEditing={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Bill To" });
    const card = heading.closest("article");

    expect(card).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Booking Info" })).toBeNull();
    expect(within(card!).getByText("Billing Company")).toBeTruthy();
    expect(within(card!).getByText("10 Main Street")).toBeTruthy();
    expect(within(card!).getByText("Suite 200")).toBeTruthy();
    expect(within(card!).getByText("Chicago")).toBeTruthy();
    expect(within(card!).getByText("IL")).toBeTruthy();
    expect(within(card!).getByText("60606")).toBeTruthy();
    expect(within(card!).getByText("USA")).toBeTruthy();
    expect(within(card!).getByText("3125550100")).toBeTruthy();
  });

  it("Details_whenEditing_exposesEveryBillToFieldAndForwardsChanges", () => {
    const onFieldChange = vi.fn();
    render(
      <Details
        shipment={shipment}
        activeEditor='billTo'
        values={createShipmentDetailEditValues(shipment)}
        onFieldChange={onFieldChange}
        onBeginEditing={vi.fn()}
        onSaveEditing={vi.fn()}
        onCancelEditing={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Bill To" });
    const card = heading.closest("article");

    expect(card).not.toBeNull();
    [
      "Company name",
      "Address Line 1",
      "Address Line 2",
      "City",
      "State",
      "Postal code",
      "Country",
      "Fax",
    ].forEach((label) => {
      expect(within(card!).getByLabelText(label)).toBeTruthy();
    });

    fireEvent.change(within(card!).getByLabelText("City"), {
      target: { value: "Atlanta" },
    });

    expect(onFieldChange).toHaveBeenCalledWith("billToCityName", "Atlanta");
  });

  it("Details_whenEditing_appliesAlignedLayoutToEveryEditableControl", () => {
    const { container } = render(
      <Details
        shipment={shipment}
        activeEditor='billTo'
        values={createShipmentDetailEditValues(shipment)}
        onFieldChange={vi.fn()}
        onBeginEditing={vi.fn()}
        onSaveEditing={vi.fn()}
        onCancelEditing={vi.fn()}
      />,
    );

    const controls = container.querySelectorAll(
      ".shipment-detail-field__input, .shipment-detail-field__picker",
    );
    const alignedRows = container.querySelectorAll(
      ".shipment-detail-field--editing",
    );

    expect(controls.length).toBeGreaterThan(0);
    expect(alignedRows).toHaveLength(controls.length);

    controls.forEach((control) => {
      expect(
        control.closest(".shipment-detail-field--editing"),
      ).not.toBeNull();
    });
  });

  it("Details_whenNoteIsEditing_exposesBothNoteFieldsAndForwardsChanges", () => {
    const onFieldChange = vi.fn();
    render(
      <Details
        shipment={shipment}
        activeEditor='note'
        values={createShipmentDetailEditValues(shipment)}
        onFieldChange={onFieldChange}
        onBeginEditing={vi.fn()}
        onSaveEditing={vi.fn()}
        onCancelEditing={vi.fn()}
      />,
    );

    const noteCard = screen
      .getByRole("heading", { name: "Note" })
      .closest("article");

    expect(noteCard).not.toBeNull();
    expect(within(noteCard!).getByLabelText("Pickup Note")).toBeTruthy();
    expect(within(noteCard!).getByLabelText("Delivery Note")).toBeTruthy();

    fireEvent.change(within(noteCard!).getByLabelText("Pickup Note"), {
      target: { value: "Updated pickup instructions" },
    });

    expect(onFieldChange).toHaveBeenCalledWith(
      "pickupNote",
      "Updated pickup instructions",
    );
  });
});
