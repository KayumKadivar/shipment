// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import Tracking from "./Tracking";

const trackingState = {
  data: null,
  loading: false,
  error: null,
  requestedLoadNumber: null,
  loadedLoadNumber: null,
};

vi.mock("../../app/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (
    selector: (state: { carrierTracking: typeof trackingState }) => unknown,
  ) => selector({ carrierTracking: trackingState }),
}));

const shipment = {
  loadNumber: "LOAD-100",
  clientCode: "CLIENT",
  userName: "Test User",
} as ShipmentDetails;

describe("Tracking", () => {
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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("Tracking_whenChangedNotificationsAreAccepted_notifiesTheParent", () => {
    const onChangeCommitted = vi.fn();
    const { container } = render(
      <Tracking
        shipment={shipment}
        onChangeCommitted={onChangeCommitted}
        onEditorStateChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit notification settings" }),
    );
    const emailInput = container.querySelector<HTMLInputElement>(
      ".shipment-notification-edit-fields input[type='email']",
    );
    expect(emailInput).not.toBeNull();
    fireEvent.change(emailInput!, {
      target: { value: "notify@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save notification settings" }),
    );

    expect(onChangeCommitted).toHaveBeenCalledTimes(1);
  });
});
