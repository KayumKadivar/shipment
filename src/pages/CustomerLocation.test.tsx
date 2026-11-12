// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { ConfigProvider } from "antd";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import appReducer, { login } from "../store/appSlice";
import clientContextReducer from "../store/clientContextSlice";
import customerLocationReducer from "../store/customerLocationSlice";
import type { CustomerLocation } from "../types/customerLocation.types";
import CustomerLocationPage from "./CustomerLocation";

/** Creates a location with valid edit-form fields and optional business hours. */
function createLocation(locationId: number, times: Partial<CustomerLocation> = {}): CustomerLocation {
  return {
    key: String(locationId), locationID: locationId,
    locationName: `Location ${locationId}`, isActive: true,
    address1: "123 Main St", address2: "Suite 2", country: "USA",
    state: "CO", city: "Denver", postal: "80201", contactName: "Receiving",
    phone: "", email: "", activateDate: "", deactivateDate: "",
    group: "STANDARD", locationType: "All", ...times,
  };
}

/** Mounts the real location page and Redux thunks against mocked HTTP responses. */
function renderLocations() {
  const locations = [
    createLocation(42, { openTime: "08:00", closeTime: "17:30" }),
    createLocation(43),
  ];
  vi.spyOn(axios, "get").mockImplementation(async (url) => ({ data: {
    isSuccess: true,
    data: String(url).includes("GetClientAndSubclientWithProfiles")
      ? [{ clientCode: "TEST", clientName: "Test Customer" }]
      : String(url).endsWith("/42") ? locations[0]
      : String(url).endsWith("/43") ? { ...locations[1], openTime: null, closeTime: null }
      : locations,
  } }));
  const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
  const store = configureStore({ reducer: {
    app: appReducer, clientContext: clientContextReducer, customerLocation: customerLocationReducer,
  } });
  store.dispatch(login({ token: "test-token", clientCode: "TEST" }));
  render(<Provider store={store}><MemoryRouter><ConfigProvider virtual={false} theme={{ token: { motion: false } }}>
    <CustomerLocationPage locations={locations} setLocations={vi.fn()} />
  </ConfigProvider></MemoryRouter></Provider>);
  return { put };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("CustomerLocation_whenEditOpens_displaysSavedTimeLabels", async () => {
  renderLocations();
  fireEvent.click(screen.getByLabelText("Edit Location 42"));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("8:00 AM")).toBeTruthy();
  expect(dialog.getByText("5:30 PM")).toBeTruthy();
}, 20_000);

it("CustomerLocation_whenTimeSelectionChanges_sendsSelectedTimes", async () => {
  const { put } = renderLocations();
  fireEvent.click(screen.getByLabelText("Edit Location 42"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.mouseDown(dialog.getByLabelText("Close Time"));
  fireEvent.click(await screen.findByText("6:00 PM"));
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(put).toHaveBeenCalledWith(
    expect.stringContaining("/Location"),
    expect.objectContaining({ openTime: "08:00", closeTime: "18:00" }),
    expect.any(Object),
  ));
}, 20_000);

it("CustomerLocation_whenAnotherLocationHasNoTimes_doesNotRetainPreviousTimes", async () => {
  renderLocations();
  fireEvent.click(screen.getByLabelText("Edit Location 42"));
  let dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("8:00 AM")).toBeTruthy();
  fireEvent.click(dialog.getByText("Cancel"));
  fireEvent.click(screen.getByLabelText("Edit Location 43"));
  await waitFor(() => {
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByDisplayValue("Location 43")).toBeTruthy();
  });
  expect(dialog.queryByText("8:00 AM")).toBeNull();
  expect(dialog.queryByText("5:30 PM")).toBeNull();
  expect(dialog.getAllByText("-- Select --")).toHaveLength(2);
}, 20_000);

it("CustomerLocation_whenOpenTimeChanges_sendsSelectedOpenTime", async () => {
  const { put } = renderLocations();
  fireEvent.click(screen.getByLabelText("Edit Location 42"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.mouseDown(dialog.getByLabelText("Open Time"));
  fireEvent.click(await screen.findByText("9:00 AM"));
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(put).toHaveBeenCalledWith(
    expect.stringContaining("/Location"),
    expect.objectContaining({ openTime: "09:00", closeTime: "17:30" }),
    expect.any(Object),
  ));
}, 20_000);

it.each(["Open Time", "Close Time"] as const)(
  "CustomerLocation_when%sIsCleared_sendsNull",
  async (label) => {
    const { put } = renderLocations();
    fireEvent.click(screen.getByLabelText("Edit Location 42"));
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByLabelText(label).closest(".ant-select");
    expect(field).toBeTruthy();
    fireEvent.click(within(field as HTMLElement).getByLabelText("Clear"));
    fireEvent.click(dialog.getByText("Save Changes"));
    await waitFor(() => expect(put).toHaveBeenCalledWith(
      expect.stringContaining("/Location"),
      expect.objectContaining(label === "Open Time"
        ? { openTime: null, closeTime: "17:30" }
        : { openTime: "08:00", closeTime: null }),
      expect.any(Object),
    ));
  },
  20_000,
);
