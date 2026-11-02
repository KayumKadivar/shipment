// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CarrierRate } from "../../pages/Rate";
import CarrierRateModal from "./CarrierRateModal";

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

function renderModal(actionLabel?: string) {
  return render(
    <CarrierRateModal
      open
      onClose={vi.fn()}
      rates={[rate]}
      loading={false}
      onSelectRate={vi.fn()}
      actionLabel={actionLabel}
    />,
  );
}

describe("CarrierRateModal", () => {
  beforeEach(() => {
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
