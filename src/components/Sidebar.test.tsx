// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";

function CurrentLocation() {
  const location = useLocation();

  return <output aria-label='Current location'>{location.pathname}</output>;
}

describe("Sidebar", () => {
  beforeEach(() => {
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

  it("Sidebar_whenRendered_usesConfiguredSvgBrandImage", () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onCollapsedChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("img", { name: "NICO Power of Electricals" })
        .getAttribute("src"),
    ).toContain("sideheadig.svg");
  });

  it("Sidebar_whenNicoTmsPortalIsClicked_keepsCurrentLocation", () => {
    render(
      <MemoryRouter initialEntries={["/shipments"]}>
        <Sidebar collapsed={false} onCollapsedChange={vi.fn()} />
        <CurrentLocation />
      </MemoryRouter>,
    );

    const menuItems = screen.getAllByRole("menuitem");
    const portalItem = screen.getByRole("menuitem", {
      name: /NICO TMS Portal/i,
    });

    expect(menuItems.at(-2)?.textContent).toContain("Customer Products");
    expect(menuItems.at(-1)).toBe(portalItem);
    expect(portalItem.getAttribute("aria-disabled")).toBeNull();
    expect(
      within(portalItem).getByRole("img", { name: "global" }),
    ).toBeTruthy();

    fireEvent.click(portalItem);

    expect(screen.getByLabelText("Current location").textContent).toBe(
      "/shipments",
    );
  });
});
