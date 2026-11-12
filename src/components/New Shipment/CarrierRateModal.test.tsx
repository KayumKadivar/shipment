// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CarrierRate } from "../../pages/Rate";
import CarrierRateModal from "./CarrierRateModal";
import { useAppSelector } from "../../app/hooks";

const { dispatchMock, fetchCarrierLogoMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  fetchCarrierLogoMock: vi.fn((scac: string) => ({
    payload: scac,
    type: "customerRate/fetchCarrierLogo",
  })),
}));

vi.mock("../../app/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: vi.fn(),
}));

vi.mock("../../store/customerRateSlice", () => ({
  clearQuoteFormData: vi.fn(),
  fetchCarrierLogo: fetchCarrierLogoMock,
  saveCustomerQuote: vi.fn(),
}));

const rate: CarrierRate = {
  id: "FXFE-0-52246240",
  name: "FEDEX FREIGHT-PRIORITY",
  code: "FXFE",
  service: "Flat",
  price: 110,
  transitDays: 2,
  estimatedDelivery: "N/A",
  logoKind: "image",
  warning: "",
  quoteExpiry: "2026-10-26T00:00:00",
  liabilityNew: "",
  liabilityUsed: "",
  grossCharge: 100,
  discount: 0,
  fuelSurcharge: 0,
  accessorialCharges: [
    {
      accessorialDescription: "INSIDE DELIVERY",
      accessorialCharge: 10,
    },
  ],
};

/** Supplies the distinct buy and sell values returned for the SAIA regression. */
const sellRate: CarrierRate = {
  ...rate,
  name: "SAIA LTL FREIGHT", code: "SAIA", price: 407.15,
  grossCharge: 3474.72, discount: 3320.09, fuelSurcharge: 148.02,
  grossSell: 3513.38, discountSell: 3320.09, fuelSell: 185.03, sellPrice: 482.81,
};

function renderModal(actionLabel?: string, modalRates: CarrierRate[] = [rate]) {
  return render(
    <CarrierRateModal
      open
      onClose={vi.fn()}
      rates={modalRates}
      loading={false}
      onSelectRate={vi.fn()}
      actionLabel={actionLabel}
    />,
  );
}

describe("CarrierRateModal", () => {
  beforeEach(() => {
    vi.mocked(useAppSelector).mockReset();
    fetchCarrierLogoMock.mockClear();
    dispatchMock.mockReset();
    dispatchMock.mockReturnValue({
      unwrap: () => Promise.resolve({ scac: "FXFE", logo: "logo-url" }),
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("CarrierRateModal_whenSellAmountsDiffer_displaysSellCharges", () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    renderModal(undefined, [sellRate]);
    const buyColumn = within(document.querySelector(".rate-detail-charges:not(.rate-detail-charges-sell)") as HTMLElement);
    const sellColumn = within(document.querySelector(".rate-detail-charges-sell") as HTMLElement);
    expect(buyColumn.getByText("Gross Charge : 3474.72")).toBeTruthy();
    expect(buyColumn.getByText("Discount : 3320.09")).toBeTruthy();
    expect(buyColumn.getByText("Fuel Surcharge : 148.02")).toBeTruthy();
    expect(sellColumn.getByText("Gross Charge : 3513.38")).toBeTruthy();
    expect(sellColumn.getByText("Discount : 3320.09")).toBeTruthy();
    expect(sellColumn.getByText("Fuel Surcharge : 185.03")).toBeTruthy();
  });

  it("CarrierRateModal_whenSellTotalIsReturned_displaysTheApiSellTotal", () => {
    renderModal(undefined, [sellRate]);
    expect(screen.getByText("$482.81")).toBeTruthy();
    expect(screen.queryByText("$407.15")).toBeNull();
    expect(screen.getByText("2 business days")).toBeTruthy();
  });

  it("CarrierRateModal_whenOnlySellDiscountExists_displaysSellDiscount", () => {
    renderModal(undefined, [{ ...rate, discountSell: 25 }]);
    const sellColumn = within(document.querySelector(".rate-detail-charges-sell") as HTMLElement);
    expect(sellColumn.getByText("Discount : 25")).toBeTruthy();
    expect(sellColumn.getByText("Gross Charge : 100")).toBeTruthy();
  });

  it("CarrierRateModal_whenSellAmountsAreZero_displaysZeroValues", () => {
    renderModal(undefined, [{ ...rate, grossSell: 0, discountSell: 0, fuelSell: 0, sellPrice: 0 }]);
    const sellColumn = within(document.querySelector(".rate-detail-charges-sell") as HTMLElement);
    expect(sellColumn.getByText("Gross Charge : 0")).toBeTruthy();
    expect(sellColumn.getByText("Discount : 0")).toBeTruthy();
    expect(sellColumn.getByText("Fuel Surcharge : 0")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
  });

  it("CarrierRateModal_whenSellAmountsAreMissing_displaysBuyFallback", () => {
    renderModal();
    const sellColumn = within(document.querySelector(".rate-detail-charges-sell") as HTMLElement);
    expect(sellColumn.getByText("Gross Charge : 100")).toBeTruthy();
    expect(sellColumn.getByText("Discount : 0")).toBeTruthy();
    expect(sellColumn.getByText("Fuel Surcharge : 0")).toBeTruthy();
    expect(screen.getByText("$110.00")).toBeTruthy();
  });

  it("CarrierRateModal_whenRerateActionLabelIsProvided_displaysSelect", () => {
    renderModal("Select");

    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ship It" })).toBeNull();
  });

  it("CarrierRateModal_whenNoActionLabelIsProvided_preservesShipIt", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Ship It" })).toBeTruthy();
  });

  it("CarrierRateModal_whenCarrierCardIsRendered_requestsLogoByScac", async () => {
    renderModal("Select");

    await waitFor(() => {
      expect(fetchCarrierLogoMock).toHaveBeenCalledWith("FXFE");
    });
    expect(dispatchMock).toHaveBeenCalledWith({
      payload: "FXFE",
      type: "customerRate/fetchCarrierLogo",
    });
  });
});
