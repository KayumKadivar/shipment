// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import type { EditShipmentRequest } from "../types/editShipment.types";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ClientOption } from "../store/customerLocationSlice";
import { act } from "@testing-library/react";
import type { ShipmentRerateRate } from "../store/shipmentRerateSlice";
import type { ShipmentDetails } from "../types/shipment.types";
import type { CarrierRate } from "./Rate";
import ShipmentDetail from "./ShipmentDetail";

const { editState, editShipmentMock, dispatchMock, shipmentState, rerateState, rerateShipmentMock, lookupUnwrapMock, lookupAbortMock, lookupMock } =
  vi.hoisted(() => ({
  editState: { saving: false, error: null as string | null, successMessage: null as string | null },
  editShipmentMock: vi.fn((payload: EditShipmentRequest) => ({ type: "editShipment/request", payload })),
  dispatchMock: vi.fn(),
  lookupUnwrapMock: vi.fn<() => Promise<ClientOption[]>>(),
  lookupAbortMock: vi.fn(),
  lookupMock: vi.fn((clientCode: string) => ({ type: "customerLocation/request", payload: clientCode })),
  shipmentState: {
    currentShipment: null as ShipmentDetails | null,
    loading: false,
    error: null as string | null,
    requestedLoadNumber: "LOAD-100" as string | null,
  },
  rerateState: {
    rates: [] as ShipmentRerateRate[],
    rate: null as ShipmentRerateRate | null,
    loading: false,
    error: null as string | null,
  },
  rerateShipmentMock: vi.fn((payload: unknown) => ({
    payload,
    type: "shipmentRerate/request",
  })),
}));

vi.mock("../app/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: {
    editShipment: typeof editState;
    shipment: typeof shipmentState;
    app: { profileCode: string; ratingProfileCode: string; ratingClientCode: string };
    customerLocation: { clients: { clientCode: string; ratingProfileCode: string; ratingClientCode: string }[] };
    shipmentRerate: typeof rerateState;
  }) => unknown) =>
    selector({
      editShipment: editState,
      shipment: shipmentState,
      app: { profileCode: "PROFILE-42", ratingProfileCode: "APP-PROFILE", ratingClientCode: "APP-CLIENT" },
      customerLocation: { clients: [{ clientCode: "CLIENT-42", ratingProfileCode: "CLIENT-BUY-PROFILE", ratingClientCode: "CLIENT-BUY-CODE" }] },
      shipmentRerate: rerateState,
    }),
}));

vi.mock("../store/customerLocationSlice", () => ({ fetchClientsAndSubclients: lookupMock }));

vi.mock("../store/editShipmentSlice", () => ({
  resetEditShipment: vi.fn(() => ({ type: "editShipment/reset" })),
  editShipment: Object.assign(editShipmentMock, {
    fulfilled: { match: (action: { type?: string }) => action.type === "editShipment/save/fulfilled" },
    rejected: { match: (action: { type?: string }) => action.type === "editShipment/save/rejected" },
  }),
}));

vi.mock("../store/shipmentSlice", () => ({
  applySavedShipment: vi.fn((payload: ShipmentDetails) => ({ type: "shipment/applySavedShipment", payload })),
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

vi.mock("../store/shipmentRerateSlice", () => ({
  clearShipmentRerate: vi.fn(() => ({
    type: "shipmentRerate/clearShipmentRerate",
  })),
  selectShipmentRerateRate: vi.fn((rateId: string) => ({
    payload: rateId,
    type: "shipmentRerate/selectShipmentRerateRate",
  })),
  rerateShipment: Object.assign(rerateShipmentMock, {
    fulfilled: {
      match: (action: { type?: string }) =>
        action.type === "shipmentRerate/rerateShipment/fulfilled",
    },
  }),
}));

vi.mock("../components/New Shipment/CarrierRateModal", () => ({
  default: ({
    open,
    onClose,
    rates,
    onSelectRate,
    actionLabel,
  }: {
    open: boolean;
    onClose: () => void;
    rates: CarrierRate[];
    onSelectRate: (rate: CarrierRate) => void;
    actionLabel?: string;
  }) =>
    open ? (
      <div role='dialog' aria-label='Quote Results'>
        {rates.map((rate) => (
          <div key={rate.id}>
            <span>{rate.name}</span>
            <span>{rate.code}</span>
            <span>{rate.service}</span>
            <span>{rate.price}</span>
            <output data-testid='modal-charge-values'>{JSON.stringify({
              price: rate.price, grossCharge: rate.grossCharge, discount: rate.discount,
              fuelSurcharge: rate.fuelSurcharge, sellPrice: rate.sellPrice,
              grossSell: rate.grossSell, discountSell: rate.discountSell, fuelSell: rate.fuelSell,
            })}</output>
            <span>{rate.transitDays} business days</span>
            <span>{rate.estimatedDelivery}</span>
            <span>{rate.quoteExpiry}</span>
            <button type='button' onClick={() => onSelectRate(rate)}>
              {actionLabel ?? "Ship It"}
            </button>
          </div>
        ))}
        <button type='button' onClick={onClose}>
          Close quote results
        </button>
      </div>
    ) : null,
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
    onValuesChange,
    shipment,
  }: {
    onChangeCommitted: (requiresRerate?: boolean) => void;
    onEditorStateChange: (isEditing: boolean) => void;
    shipment: ShipmentDetails;
    onValuesChange?: (values: Pick<ShipmentDetails, "products" | "accessorials" | "bolDispatchNotes">) => void;
  }) => (
    <>
      <button type='button' onClick={() => onChangeCommitted()}>
        Commit load change
      </button>
      <button type='button' onClick={() => {
        onValuesChange?.({
          products: shipment.products.map((product) => ({ ...product, productDescription: "Updated freight" })),
          accessorials: ["LFG"], bolDispatchNotes: ["Accepted internal note"],
        });
        onChangeCommitted();
      }}>Commit accepted load values</button>
      <button type='button' onClick={() => onChangeCommitted(true)}>
        Commit rate-affecting load change
      </button>
      <button type='button' onClick={() => onEditorStateChange(true)}>
        Open load editor
      </button>
    </>
  ),
}));

vi.mock("../components/shipmentdetail/Charges", () => ({
  default: ({ reratedRate, onValuesChange }: {
    reratedRate?: ShipmentRerateRate | null;
    onValuesChange?: (values: Pick<ShipmentDetails, "buyRate" | "sellRate">) => void;
  }) => {
    useEffect(() => {
      if (!reratedRate) return;
      onValuesChange?.({
        buyRate: { freight: reratedRate.grossCharge, fuel: reratedRate.fuelSurcharge, discount: -Math.abs(reratedRate.discount), accesorialCostDetails: [] },
        sellRate: { freight: reratedRate.sellGrossCharge ?? reratedRate.grossCharge, fuel: reratedRate.sellFuelSurcharge ?? reratedRate.fuelSurcharge, discount: -Math.abs(reratedRate.sellDiscount ?? reratedRate.discount), accesorialCostDetails: [] },
      });
    }, [reratedRate, onValuesChange]);
    return <div data-testid='charges-rerated-rate'>{reratedRate ? `${reratedRate.scac}:${reratedRate.grossCharge}` : "none"}</div>;
  },
}));

vi.mock("../components/shipmentdetail/Tracking", () => ({
  default: () => null,
}));

const shipment = {
  loadNumber: "LOAD-100",
  proNumber: "PRO-100",
  bolStatus: "In Transit",
  equipment: "LTL",
  pickupdate: "2026-10-15",
  scac: "FXFE",
  clientCode: "CLIENT-42",
  clientName: "Test Client",
  orgCityName: "Atlanta",
  orgStateCode: "GA",
  orgPostalCode: "30303",
  orgCountryCode: "USA",
  destCityName: "Chicago",
  destStateCode: "IL",
  destPostalCode: "60606",
  destCountryCode: "USA",
  products: [
    {
      productDescription: "Freight",
      productClass: "70",
      productWeight: 100,
      pallets: 1,
      pieces: 1,
      hazMat: false,
    },
  ],
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

const returnedRerate: ShipmentRerateRate = {
  id: "FXFE-0-52246240",
  carrierName: "FEDEX FREIGHT-PRIORITY",
  scac: "FXFE",
  rateType: "Flat",
  statusCode: 1,
  errorMessage: null,
  totalShipmentCost: 110,
  transitDays: 2,
  deliveryDate: "0001-01-01T00:00:00",
  quoteExpirationDate: "2026-10-26T00:00:00",
  grossCharge: 100,
  fuelSurcharge: 0,
  discount: 0,
  accessorialCharges: [
    {
      accessorialCode: "INS",
      accessorialDescription: "INSIDE DELIVERY",
      accessorialCharge: 10,
    },
  ],
};

function renderShipmentDetail(state?: unknown) {
  const createView = () => (
    <MemoryRouter initialEntries={[{ pathname: "/shipments/LOAD-100", state }]}>
      <Routes>
        <Route path='/shipments/:shipmentId' element={<ShipmentDetail />} />
        <Route path='/shipments' element={<div>Shipments list</div>} />
      </Routes>
    </MemoryRouter>
  );
  const view = render(createView());
  return { ...view, refresh: () => view.rerender(createView()) };
}

/** Commits a load change and starts the public rerate action. */
function requestRerate() {
  fireEvent.click(screen.getByRole("tab", { name: "Load" }));
  fireEvent.click(screen.getByRole("button", { name: "Commit rate-affecting load change" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));
}

describe("ShipmentDetail", { timeout: 20_000 }, () => {
  beforeEach(() => {
    editShipmentMock.mockClear();
    editState.saving = false;
    editState.error = null;
    editState.successMessage = null;
    lookupMock.mockClear();
    lookupAbortMock.mockReset();
    lookupUnwrapMock.mockReset().mockResolvedValue([
      { clientCode: "CLIENT-42", clientName: "Client", ratingProfileCode: "CLIENT-BUY-PROFILE", ratingClientCode: "CLIENT-BUY-CODE" },
    ]);
    rerateShipmentMock.mockClear();
    shipmentState.currentShipment = shipment;
    shipmentState.loading = false;
    shipmentState.error = null;
    shipmentState.requestedLoadNumber = "LOAD-100";
    rerateState.rates = [];
    rerateState.rate = null;
    rerateState.loading = false;
    rerateState.error = null;
    dispatchMock.mockImplementation(
      (action: { type?: string; payload?: string }) => {
        if (action.type === "editShipment/request") {
          editState.successMessage = "Shipment saved.";
          return Promise.resolve({ type: "editShipment/save/fulfilled", payload: {
            isSuccess: true, message: "", data: { bolNo: "LOAD-100", proNumber: "PRO-200", shipmentStatus: "Booked" },
          } });
        }
        if (action.type === "customerLocation/request") {
          return { unwrap: lookupUnwrapMock, abort: lookupAbortMock };
        }
        if (action.type === "shipmentRerate/request") {
          rerateState.rates = [returnedRerate];
          rerateState.rate = null;
          return Promise.resolve({
            type: "shipmentRerate/rerateShipment/fulfilled",
            payload: [returnedRerate],
          });
        }

        if (action.type === "shipmentRerate/selectShipmentRerateRate") {
          rerateState.rate =
            rerateState.rates.find((rate) => rate.id === action.payload) ??
            null;
        }
        if (action.type === "shipmentRerate/clearShipmentRerate") {
          rerateState.rate = null;
          rerateState.rates = [];
        }

        return { abort: vi.fn() };
      },
    );
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
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
      "disabled",
      true,
    );
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

  it("ShipmentDetail_whenGlobalSaveIsClicked_keepsValuesAndClearsDirtyState", async () => {
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
    await waitFor(() => expect(screen.queryByText("Screen has some unsaved data!!")).toBeNull());
    expect(editShipmentMock).toHaveBeenCalledWith(expect.objectContaining({ billToName: "Session Company" }));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByText("Shipment Need to be re rated !")).toBeNull();
    expect(await screen.findByText("Shipments list")).toBeTruthy();
  });

  it("ShipmentDetail_whenRateAffectingLoadChangeIsGloballySaved_enablesRerateReminder", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Commit rate-affecting load change",
      }),
    );

    expect(screen.getByText("Screen has some unsaved data!!")).toBeTruthy();
    expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(editShipmentMock).not.toHaveBeenCalled();
    expect(screen.getByText("Screen has some unsaved data!!")).toBeTruthy();
    expect(screen.getByText("Shipment Need to be re rated !")).toHaveProperty(
      "className",
      "shipment-detail-rerate-message",
    );
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("ShipmentDetail_whenRowClientDiffersFromLogin_usesTheRowClientRatingCodes", async () => {
    lookupUnwrapMock.mockResolvedValue([
      { clientCode: "OTHER", clientName: "Other", ratingClientCode: "WRONG", ratingProfileCode: "WRONG" },
      { clientCode: "ROW-CLIENT", clientName: "Row", ratingClientCode: "ROW-BUY", ratingProfileCode: "ROW-PROFILE" },
    ]);
    renderShipmentDetail({ loadNumber: "LOAD-100", clientCode: "ROW-CLIENT" });
    requestRerate();
    await waitFor(() => expect(rerateShipmentMock).toHaveBeenCalledWith(expect.objectContaining({
      clientCode: "ROW-CLIENT", ratingClientCode: "ROW-BUY", ratingProfileCode: "ROW-PROFILE",
    })));
    expect(lookupMock).toHaveBeenCalledWith("ROW-CLIENT");
  });

  it("ShipmentDetail_whenDirectLinkHasNoRowContext_looksUpTheShipmentClient", async () => {
    renderShipmentDetail();
    requestRerate();
    await waitFor(() => expect(rerateShipmentMock).toHaveBeenCalledTimes(1));
    expect(lookupMock).toHaveBeenCalledWith("CLIENT-42");
  });

  it("ShipmentDetail_whenRowContextBelongsToAnotherLoad_usesTheShipmentClient", async () => {
    renderShipmentDetail({ loadNumber: "OTHER-LOAD", clientCode: "WRONG" });
    requestRerate();
    await waitFor(() => expect(rerateShipmentMock).toHaveBeenCalledTimes(1));
    expect(lookupMock).toHaveBeenCalledWith("CLIENT-42");
  });

  it("ShipmentDetail_whenRowClientIsMissing_doesNotLookupOrRequestRates", async () => {
    renderShipmentDetail({ loadNumber: "LOAD-100", clientCode: null });
    requestRerate();
    expect(await screen.findByText("A shipment client code is required to re-rate the shipment.")).toBeTruthy();
    expect(lookupMock).not.toHaveBeenCalled();
    expect(rerateShipmentMock).not.toHaveBeenCalled();
  });

  it("ShipmentDetail_whenClientLookupFails_doesNotRequestRates", async () => {
    lookupUnwrapMock.mockRejectedValue("Client lookup unavailable");
    renderShipmentDetail();
    requestRerate();
    expect(await screen.findByText("Client lookup unavailable")).toBeTruthy();
    expect(rerateShipmentMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty("disabled", false);
  });

  it("ShipmentDetail_whenMatchingClientIsMissing_doesNotRequestRates", async () => {
    lookupUnwrapMock.mockResolvedValue([{ clientCode: "OTHER", clientName: "Other", ratingClientCode: "WRONG", ratingProfileCode: "WRONG" }]);
    renderShipmentDetail();
    requestRerate();
    expect(await screen.findByText("Rating client and profile codes are unavailable for client CLIENT-42.")).toBeTruthy();
    expect(rerateShipmentMock).not.toHaveBeenCalled();
  });

  it.each(["ratingClientCode", "ratingProfileCode"])(
    "ShipmentDetail_whenEitherRatingCodeIsBlank_doesNotRequestRates (%s)", async (field) => {
      lookupUnwrapMock.mockResolvedValue([{ clientCode: "CLIENT-42", clientName: "Client", ratingClientCode: "BUY", ratingProfileCode: "PROFILE", [field]: "  " }]);
      renderShipmentDetail();
      requestRerate();
      expect(await screen.findByText("Rating client and profile codes are unavailable for client CLIENT-42.")).toBeTruthy();
      expect(rerateShipmentMock).not.toHaveBeenCalled();
    },
  );

  it("ShipmentDetail_whenLookupIsPending_disablesDuplicateRerates", async () => {
    lookupUnwrapMock.mockReturnValue(new Promise(() => {}));
    renderShipmentDetail();
    requestRerate();
    const button = screen.getByRole("button", { name: /Re-Rate$/ });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(lookupMock).toHaveBeenCalledTimes(1);
    expect(rerateShipmentMock).not.toHaveBeenCalled();
  });

  it("ShipmentDetail_whenUnmountedDuringLookup_abortsAndDoesNotRequestRates", async () => {
    let resolveLookup: (clients: ClientOption[]) => void = () => {};
    lookupUnwrapMock.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve; }));
    const view = renderShipmentDetail();
    requestRerate();
    view.unmount();
    expect(lookupAbortMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveLookup([{ clientCode: "CLIENT-42", clientName: "Client", ratingClientCode: "BUY", ratingProfileCode: "PROFILE" }]));
    expect(rerateShipmentMock).not.toHaveBeenCalled();
  });

  it("ShipmentDetail_whenClientHasRatingCodes_usesThemBeforeAppDefaults", async () => {
    renderShipmentDetail();
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit rate-affecting load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));
    await waitFor(() => expect(rerateShipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ ratingProfileCode: "CLIENT-BUY-PROFILE", ratingClientCode: "CLIENT-BUY-CODE" }),
    ));
  });

  it("ShipmentDetail_whenRerateHasSellAmounts_mapsThemToModalFields", async () => {
    const sellRate = {
      ...returnedRerate,
      carrierName: "SAIA LTL FREIGHT", scac: "SAIA", grossCharge: 3474.72,
      discount: 3320.09, fuelSurcharge: 148.02, totalShipmentCost: 407.15,
      sellGrossCharge: 3513.38, sellDiscount: 3320.09, sellFuelSurcharge: 185.03,
      sellTotalShipmentCost: 482.81,
    };
    const previousDispatch = dispatchMock.getMockImplementation()!;
    dispatchMock.mockImplementation((action: { type?: string; payload?: string }) => {
      if (action.type === "shipmentRerate/request") {
        rerateState.rates = [sellRate];
        return Promise.resolve({ type: "shipmentRerate/rerateShipment/fulfilled", payload: [sellRate] });
      }
      return previousDispatch(action);
    });
    renderShipmentDetail();
    requestRerate();
    const dialog = within(await screen.findByRole("dialog", { name: "Quote Results" }));
    expect(JSON.parse(dialog.getByTestId("modal-charge-values").textContent!)).toEqual({
      price: 407.15, grossCharge: 3474.72, discount: 3320.09, fuelSurcharge: 148.02,
      sellPrice: 482.81, grossSell: 3513.38, discountSell: 3320.09, fuelSell: 185.03,
    });
  });

  it("ShipmentDetail_whenRerateSucceeds_opensResultsWithoutChangingCharges", async () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Commit rate-affecting load change",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Quote Results",
    });

    expect(within(dialog).getByText("FEDEX FREIGHT-PRIORITY")).toBeTruthy();
    expect(within(dialog).getByText("FXFE")).toBeTruthy();
    expect(within(dialog).getByText("Flat")).toBeTruthy();
    expect(within(dialog).getByText("110")).toBeTruthy();
    expect(within(dialog).getByText("2 business days")).toBeTruthy();
    expect(within(dialog).getByText("N/A")).toBeTruthy();
    expect(within(dialog).getByText("2026-10-26T00:00:00")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    expect(rerateShipmentMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("tab", { name: "Charges" }).getAttribute("aria-selected"),
    ).toBe("false");
    expect(screen.getByTestId("charges-rerated-rate").textContent).toBe("none");
  });

  it("ShipmentDetail_whenRerateModalIsClosed_keepsTheRerateReminder", async () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Commit rate-affecting load change",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Close quote results" }),
    );

    expect(screen.queryByRole("dialog", { name: "Quote Results" })).toBeNull();
    expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    expect(screen.getByTestId("charges-rerated-rate").textContent).toBe("none");
  });

  it("ShipmentDetail_whenRateIsSelected_appliesItAndShowsCharges", async () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Commit rate-affecting load change",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select" }));

    expect(screen.queryByRole("dialog", { name: "Quote Results" })).toBeNull();
    expect(screen.queryByText("Shipment Need to be re rated !")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Charges" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByTestId("charges-rerated-rate").textContent).toBe(
      "FXFE:100",
    );
  });

  it("ShipmentDetail_whenRerateRequestFails_keepsRerateReminder", async () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Commit rate-affecting load change",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    dispatchMock.mockImplementation((action: { type?: string }) =>
      action.type === "shipmentRerate/request"
        ? Promise.resolve({
            type: "shipmentRerate/rerateShipment/rejected",
            payload: "Rating failed",
          })
        : { abort: vi.fn() },
    );

    fireEvent.click(screen.getByRole("button", { name: "Re-Rate" }));

    await waitFor(() => {
      expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it.each([
    ["Pickup", "Denver, CO, 80202"],
    ["Delivery", "Austin, TX, 78701"],
  ])(
    "ShipmentDetail_when%sCityStateZipIsGloballySaved_enablesRerateReminder",
    (section, value) => {
      renderShipmentDetail();

      fireEvent.click(
        screen.getByRole("button", { name: `Edit ${section}` }),
      );
      const card = screen
        .getByRole("heading", { name: section })
        .closest("article") as HTMLElement;
      fireEvent.change(within(card).getByLabelText("City/state/zip"), {
        target: { value },
      });
      fireEvent.click(
        screen.getByRole("button", { name: `Save ${section}` }),
      );

      expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
        "disabled",
        false,
      );
    },
  );

  it("ShipmentDetail_whenPickupDateIsGloballySaved_enablesRerateReminder", () => {
    renderShipmentDetail();

    fireEvent.click(screen.getByRole("button", { name: "Edit Schedule" }));
    const scheduleCard = screen
      .getByRole("heading", { name: "Schedule" })
      .closest("article") as HTMLElement;
    const pickupDateInput = within(scheduleCard).getAllByPlaceholderText(
      "M/D/YY",
    )[0];
    fireEvent.change(pickupDateInput, {
      target: { value: "10/20/26" },
    });
    fireEvent.keyDown(pickupDateInput, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save Schedule" }));

    expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Shipment Need to be re rated !")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-Rate" })).toHaveProperty(
      "disabled",
      false,
    );
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

    expect(controls).toHaveLength(3);
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

  it("ShipmentDetail_SaveAfterRateSelection_SubmitsSelectedSellFreight", async () => {
    renderShipmentDetail();
    requestRerate();
    await screen.findByRole("dialog", { name: "Quote Results" });
    rerateState.rates[0] = { ...returnedRerate, grossCharge: 150, sellGrossCharge: 180 };
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(editShipmentMock).toHaveBeenCalled());
    expect(editShipmentMock.mock.calls[0][0]).toMatchObject({
      scac: "FXFE", sellSCAC: "FXFE", sellCarrierName: "FEDEX FREIGHT-PRIORITY",
      buyRate: { freight: 150 }, sellRate: { freight: 180 },
    });
  });

  it("ShipmentDetail_SaveAfterLoadCommit_SubmitsAcceptedProductsAndNotes", async () => {
    renderShipmentDetail();
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit accepted load values" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editShipmentMock).toHaveBeenCalledTimes(1));
    expect(editShipmentMock.mock.calls[0][0]).toMatchObject({
      products: [expect.objectContaining({ productDescription: "Updated freight" })],
      bolDispatchNotes: ["Accepted internal note"], accessorials: ["LFG"],
    });
  });

  it("ShipmentDetail_SaveFailure_KeepsAcceptedEditsForRetry", async () => {
    renderShipmentDetail();
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    dispatchMock.mockImplementation((action: { type?: string }) => {
      if (action.type === "editShipment/request") {
        return Promise.resolve({ type: "editShipment/save/rejected", payload: "Server unavailable" });
      }
      return { abort: vi.fn() };
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editShipmentMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Server unavailable")).toBeTruthy();
    expect(screen.getByText("Screen has some unsaved data!!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editShipmentMock).toHaveBeenCalledTimes(2));
    expect(editShipmentMock.mock.calls[1][0]).toEqual(editShipmentMock.mock.calls[0][0]);
  });

  it("ShipmentDetail_ReferenceEditing_KeepsUnsupportedFieldsReadOnly", () => {
    renderShipmentDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit Reference Numbers" }));
    expect(screen.queryByLabelText("Carrier Quote Number")).toBeNull();
    expect(screen.queryByLabelText("Load")).toBeNull();
  });




  it("ShipmentDetail_PostSaveRefresh_FailedWriteKeepsDraftWithoutReading", async () => {
    renderShipmentDetail();
    dispatchMock.mockClear();
    const dispatch = dispatchMock.getMockImplementation()!;
    dispatchMock.mockImplementation((action) => action.type === "editShipment/request"
      ? Promise.resolve({ type: "editShipment/save/rejected", payload: "Shipment was modified" })
      : dispatch(action));
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Shipment was modified")).toBeTruthy();
    expect(screen.getByText("Screen has some unsaved data!!")).toBeTruthy();
    expect(dispatchMock.mock.calls.filter(([action]) => action.type === "shipment/fetchByLoadNumber")).toHaveLength(0);
    expect(screen.queryByText("Shipments list")).toBeNull();
  });

  it("ShipmentDetail_SuccessfulSave_RedirectsWithoutRefreshingDetail", async () => {
    renderShipmentDetail();
    dispatchMock.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Shipments list")).toBeTruthy();
    expect(editShipmentMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls.filter(([action]) => action.type === "shipment/fetchByLoadNumber")).toHaveLength(0);
  });

  it("ShipmentDetail_PendingSave_WaitsForSuccessBeforeRedirecting", async () => {
    renderShipmentDetail();
    const dispatch = dispatchMock.getMockImplementation()!;
    let complete!: (result: unknown) => void;
    const pending = new Promise((resolve) => { complete = resolve; });
    dispatchMock.mockImplementation((action) => action.type === "editShipment/request" ? pending : dispatch(action));
    fireEvent.click(screen.getByRole("tab", { name: "Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit load change" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByText("Shipments list")).toBeNull();
    expect(screen.getByText("Screen has some unsaved data!!")).toBeTruthy();
    await act(async () => { complete({ type: "editShipment/save/fulfilled", payload: { data: null } }); });
    expect(await screen.findByText("Shipments list")).toBeTruthy();
  });

  it("ShipmentDetail_SuccessfulRerateSave_ClearsSelectedRateBeforeRedirecting", async () => {
    renderShipmentDetail();
    requestRerate();
    fireEvent.click(await screen.findByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Shipments list")).toBeTruthy();
    expect(rerateState.rate).toBeNull();
  });


});
