// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ShipmentDetails } from "../types/shipment.types";
import ShipmentDetail from "./ShipmentDetail";

const { dispatchMock, shipmentState } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  shipmentState: {
    currentShipment: null as ShipmentDetails | null,
    loading: false,
    error: null as string | null,
    requestedLoadNumber: "LOAD-100" as string | null,
  },
}));

vi.mock("../app/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: { shipment: typeof shipmentState }) => unknown) =>
    selector({ shipment: shipmentState }),
}));

vi.mock("../store/shipmentSlice", () => ({
  fetchShipmentByLoadNumber: vi.fn((loadNumber: string) => ({
    payload: loadNumber,
    type: "shipment/fetchByLoadNumber",
  })),
}));

vi.mock("../store/carrierTrackingSlice", () => ({
  fetchCarrierTracking: vi.fn((payload: { loadNumber: string }) => ({
    payload,
    type: "carrierTracking/fetch",
  })),
}));

vi.mock("@react-google-maps/api", () => ({
  GoogleMap: () => null,
  PolylineF: () => null,
  useLoadScript: () => ({ isLoaded: false, loadError: undefined }),
}));

vi.mock("../components/shipmentdetail/LoadTab", () => ({
  default: ({
    onChangeCommitted,
    onEditorStateChange,
  }: {
    onChangeCommitted: () => void;
    onEditorStateChange: (isEditing: boolean) => void;
  }) => (
    <>
      <button type='button' onClick={onChangeCommitted}>
        Commit load change
      </button>
      <button type='button' onClick={() => onEditorStateChange(true)}>
        Open load editor
      </button>
    </>
  ),
}));

vi.mock("../components/shipmentdetail/Charges", () => ({
  default: () => null,
}));

vi.mock("../components/shipmentdetail/Tracking", () => ({
  default: () => null,
}));

const shipment = {
  loadNumber: "LOAD-100",
  proNumber: "PRO-100",
  bolStatus: "In Transit",
  equipment: "LTL",
  products: [],
  userName: "Created User",
  orgWhoEntered: "Tendered User",
  clientEmail: "client@example.com",
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
} as unknown as ShipmentDetails;

function renderShipmentDetail() {
  return render(
    <MemoryRouter initialEntries={["/shipments/LOAD-100"]}>
      <Routes>
        <Route path='/shipments/:shipmentId' element={<ShipmentDetail />} />
        <Route path='/shipments' element={<div>Shipments list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ShipmentDetail", () => {
  beforeEach(() => {
    shipmentState.currentShipment = shipment;
    shipmentState.loading = false;
    shipmentState.error = null;
    shipmentState.requestedLoadNumber = "LOAD-100";
    dispatchMock.mockReturnValue({ abort: vi.fn() });
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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("ShipmentDetail_whenRendered_placesReadOnlyBookingInfoAfterReferenceNumbers", () => {
    const { container } = renderShipmentDetail();
    const sideCard = container.querySelector<HTMLElement>(
      ".shipment-detail-side-card",
    );

    expect(sideCard).not.toBeNull();
    expect(
      within(sideCard!).getAllByRole("heading", { level: 3 }).map((heading) =>
        heading.textContent,
      ),
    ).toEqual(["Reference Numbers", "Booking Info"]);
    expect(within(sideCard!).getByText("Created User")).toBeTruthy();
    expect(within(sideCard!).getByText("Tendered User")).toBeTruthy();
    expect(within(sideCard!).queryByLabelText("Created By")).toBeNull();
    expect(within(sideCard!).queryByLabelText("Tendered By")).toBeNull();
  });

  it("ShipmentDetail_whenRendered_showsAnEditActionForEveryEditableSection", () => {
    renderShipmentDetail();

    [
      "Reference Numbers",
      "Pickup",
      "Delivery",
      "Schedule",
      "Bill To",
      "Note",
    ].forEach((label) => {
      expect(
        screen.getByRole("button", { name: `Edit ${label}` }),
      ).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("ShipmentDetail_whenBillToEditingIsCancelled_restoresTheSavedValue", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Bill To" }));
    const billToCard = screen
      .getByRole("heading", { name: "Bill To" })
      .closest("article") as HTMLElement | null;
    fireEvent.change(within(billToCard!).getByLabelText("Company name"), {
      target: { value: "Cancelled Company" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel Bill To editing" }),
    );

    expect(within(billToCard!).getByText("Billing Company")).toBeTruthy();
    expect(
      screen.queryByText("Screen has some unsaved data!!"),
    ).toBeNull();
  });

  it("ShipmentDetail_whenBillToEditingIsSaved_keepsTheValueForTheSession", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Bill To" }));
    const billToCard = screen
      .getByRole("heading", { name: "Bill To" })
      .closest("article") as HTMLElement | null;
    fireEvent.change(within(billToCard!).getByLabelText("Company name"), {
      target: { value: "Saved Company" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Bill To" }));

    expect(within(billToCard!).getByText("Saved Company")).toBeTruthy();
  });

  it("ShipmentDetail_whenChangedInlineEditIsAccepted_showsGlobalUnsavedActions", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Bill To" }));
    const billToCard = screen
      .getByRole("heading", { name: "Bill To" })
      .closest("article") as HTMLElement | null;
    fireEvent.change(within(billToCard!).getByLabelText("Company name"), {
      target: { value: "Pending Company" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Bill To" }));

    expect(screen.getByText("Screen has some unsaved data!!")).toHaveProperty(
      "className",
      "shipment-detail-unsaved-message",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("ShipmentDetail_whenUnsavedAndTabsChange_keepsGlobalActionsVisible", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));

    ["Charges", "Tracking", "Documents", "Audit", "Details"].forEach(
      (tab) => {
        fireEvent.click(screen.getByRole("tab", { name: tab }));
        expect(
          screen.getByText("Screen has some unsaved data!!"),
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
      },
    );
  });

  it("ShipmentDetail_whenGlobalSaveIsClicked_keepsValuesAndClearsDirtyState", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Bill To" }));
    const billToCard = screen
      .getByRole("heading", { name: "Bill To" })
      .closest("article") as HTMLElement | null;
    fireEvent.change(within(billToCard!).getByLabelText("Company name"), {
      target: { value: "Session Company" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Bill To" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(within(billToCard!).getByText("Session Company")).toBeTruthy();
    expect(
      screen.queryByText("Screen has some unsaved data!!"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("ShipmentDetail_whenGlobalCancelIsClicked_navigatesToShipments", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Shipments list")).toBeTruthy();
  });

  it("ShipmentDetail_whenDirtyEditorIsOpen_disablesGlobalSave", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Open load editor" }));

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("ShipmentDetail_whenInlineCheckHasNoChanges_doesNotShowDirtyState", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Bill To" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Bill To" }));

    expect(
      screen.queryByText("Screen has some unsaved data!!"),
    ).toBeNull();
  });

  it("ShipmentDetail_whenDetailsEditing_alignsEveryReferenceNumberInput", () => {
    const { container } = renderShipmentDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Reference Numbers" }),
    );

    const referenceFields = container.querySelector(
      ".shipment-detail-reference-fields",
    );
    const controls = referenceFields!.querySelectorAll(
      ".shipment-detail-field__input",
    );
    const alignedRows = referenceFields!.querySelectorAll(
      ".shipment-detail-field--editing",
    );

    expect(controls).toHaveLength(5);
    expect(alignedRows).toHaveLength(controls.length);
    controls.forEach((control) => {
      expect(
        control.closest(".shipment-detail-field--editing"),
      ).not.toBeNull();
    });
  });

  it("ShipmentDetail_whenDetailsEditing_keepsClientEmailReadOnly", () => {
    const { container } = renderShipmentDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Reference Numbers" }),
    );

    const sideCard = container.querySelector<HTMLElement>(
      ".shipment-detail-side-card",
    );

    expect(sideCard).not.toBeNull();
    expect(within(sideCard!).queryByLabelText("Client Email")).toBeNull();
    expect(within(sideCard!).getByText("client@example.com")).toBeTruthy();
  });

  it("ShipmentDetail_whenASectionIsEditing_disablesOtherSectionEditActions", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Pickup" }));

    expect(
      screen.getByRole("button", { name: "Edit Delivery" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Edit Reference Numbers" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Save Pickup" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cancel Pickup editing" }),
    ).toBeTruthy();
  });

  it("ShipmentDetail_whenNoteIsEdited_savesTheChangedNotesLocally", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    const noteCard = screen
      .getByRole("heading", { name: "Note" })
      .closest("article") as HTMLElement | null;
    fireEvent.change(within(noteCard!).getByLabelText("Pickup Note"), {
      target: { value: "Updated pickup instructions" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    expect(
      within(noteCard!).getByText("Updated pickup instructions"),
    ).toBeTruthy();
    expect(within(noteCard!).getByText("Delivery instructions")).toBeTruthy();
  });
});
