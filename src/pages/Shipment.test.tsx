// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import shipmentReducer from "../store/shipmentSlice";
import shipmentStatusCountsReducer from "../store/shipmentStatusCountsSlice";
import shipmentStatusSearchReducer from "../store/shipmentStatusSearchSlice";
import type { ShipmentRecord } from "../types/shipment.types";
import Shipment from "./Shipment";

// Keep these tests focused on page orchestration rather than Ant Design internals.
vi.mock("antd", () => ({
  Alert: ({ title, description, action }: { title: ReactNode; description: ReactNode; action: ReactNode }) => (
    <div role="alert"><span>{title}</span><span>{description}</span>{action}</div>
  ),
  Button: ({ children, onClick, loading, className, "aria-pressed": pressed }: {
    children: ReactNode; onClick?: () => void; loading?: boolean; className?: string;
    "aria-pressed"?: ButtonHTMLAttributes<HTMLButtonElement>["aria-pressed"];
  }) => (
    <button onClick={onClick} disabled={loading} className={className} aria-pressed={pressed}>{children}</button>
  ),
  Card: ({ children, className }: { children: ReactNode; className: string }) => <div className={className}>{children}</div>,
  Space: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Spin: () => <span />,
  Typography: {
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock("@ant-design/icons", () => Object.fromEntries([
  "CheckOutlined", "ClockCircleOutlined", "ExclamationCircleOutlined", "FileTextOutlined",
  "FlagOutlined", "ReloadOutlined", "TruckOutlined", "WarningOutlined",
].map((name) => [name, () => <span />])));

vi.mock("../components/shipment/ShipmentTable", () => ({
  default: ({ onPageChange, shipments, currentPage, loading, hasNextPage, onOpenShipment, onShipmentSelected }: {
    onPageChange: (page: number) => void; shipments: ShipmentRecord[]; currentPage: number;
    loading: boolean; hasNextPage: boolean; onOpenShipment: (key: string, clientCode?: string | null) => void;
    onShipmentSelected: (key: string, selected: boolean) => void;
  }) => (
    <div aria-label="Shipment table">
      <span>Table page {currentPage}</span>
      {shipments.map((shipment) => <div key={shipment.key}>
        <button onClick={() => onOpenShipment(shipment.loadNumber, shipment.clientCode)}>Open {shipment.loadNumber}</button>
        <span>{shipment.customer}</span><span>{shipment.status}</span>
        <input type="checkbox" aria-label={`Select ${shipment.loadNumber}`} checked={Boolean(shipment.selected)}
          onChange={(event) => onShipmentSelected(shipment.key, event.target.checked)} />
      </div>)}
      <button disabled={loading || !hasNextPage} onClick={() => onPageChange(currentPage + 1)}>Next table page</button>
    </div>
  ),
}));

const counts = [
  { shipmentStatus: "Expired", shipmentCount: 0 },
  { shipmentStatus: "In Transit", shipmentCount: 2 },
  { shipmentStatus: "Booked", shipmentCount: 20 },
  { shipmentStatus: "Delivered", shipmentCount: 0 },
  { shipmentStatus: "Out For Delivery", shipmentCount: 2 },
  { shipmentStatus: "Pickup Requested", shipmentCount: 1 },
  { shipmentStatus: "Pickup Failed", shipmentCount: 12 },
  { shipmentStatus: "Pickup Succeed", shipmentCount: 13 },
];

/** Mounts the page with real reducers and mocked HTTP boundaries. */
function renderShipment() {
  const store = configureStore({ reducer: { shipment: shipmentReducer, shipmentStatusCounts: shipmentStatusCountsReducer, shipmentStatusSearch: shipmentStatusSearchReducer } });
  return render(<Provider store={store}><MemoryRouter><Shipment /><CurrentPath /></MemoryRouter></Provider>);
}

/** Exposes navigation so row links can be verified without rendering the details page. */
function CurrentPath() {
  const location = useLocation();
  return <><span aria-label="Current path">{location.pathname}</span><span aria-label="Row context">{JSON.stringify(location.state)}</span></>;
}

const shipmentItem = { clientCode: "ROW-CLIENT", bolNo: "LOAD-1", customerName: "Customer", shipmentStatus: "Booked", statusId: 2, pallets: 1, weight: 1500 };

/** Creates a full page so pagination can be exercised without external data. */
function fullShipmentPage() {
  return Array.from({ length: 20 }, (_, index) => ({ ...shipmentItem, bolNo: `LOAD-${index + 1}` }));
}

/** Returns the displayed values without matching the independent filter buttons. */
function cardValues() {
  return Array.from(screen.getByLabelText("Shipment status counts").querySelectorAll(".shipment-stat-card strong"))
    .map((element) => element.textContent);
}

describe("Shipment status cards", () => {
  beforeEach(() => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: [] } });
    vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [] } });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Shipment_whenCountsLoad_mapsEightCardsByStatusInsteadOfResponseOrder", async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({ data: { isSuccess: true, data: String(url).includes("GetShipmentStatusCounts") ? [...counts].reverse() : [] } }));
    renderShipment();
    await waitFor(() => expect(cardValues()).toEqual(["0", "2", "20", "0", "2", "1", "12", "13"]));
    const cards = within(screen.getByLabelText("Shipment status counts"));
    for (const item of counts) expect(cards.getByText(item.shipmentStatus)).toBeTruthy();
    expect(cards.queryByText("Quotes")).toBeNull();
    expect(screen.queryByText("12 awaiting response")).toBeNull();
  });

  it("Shipment_whenStatusIsMissing_displaysZeroForMissingCards", async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({ data: { isSuccess: true, data: String(url).includes("GetShipmentStatusCounts") ? [counts[2]] : [] } }));
    renderShipment();
    await waitFor(() => expect(cardValues()).toEqual(["0", "0", "20", "0", "0", "0", "0", "0"]));
  });

  it("Shipment_whenCountsAreEmpty_displaysEightZeroCounts", async () => {
    renderShipment();
    await waitFor(() => expect(cardValues()).toEqual(Array(8).fill("0")));
  });

  it("Shipment_whenCountsAreLoading_showsLoadingFeedbackAndPlaceholders", () => {
    vi.mocked(axios.get).mockImplementation((url) => String(url).includes("GetShipmentStatusCounts")
      ? new Promise(() => {}) : Promise.resolve({ data: { isSuccess: true, data: [] } }));
    renderShipment();
    expect(screen.getByRole("status").textContent).toContain("Loading shipment status counts");
    expect(cardValues()).toEqual(Array(8).fill("—"));
  });

  it("Shipment_whenCountsFail_retryReloadsOnlyCounts", async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({ data: String(url).includes("GetShipmentStatusCounts")
      ? { isSuccess: false, message: "Counts unavailable", data: null } : { isSuccess: true, data: [] } }));
    renderShipment();
    await screen.findByText("Counts unavailable");
    expect(cardValues()).toEqual(Array(8).fill("—"));
    vi.mocked(axios.get).mockClear();
    vi.mocked(axios.get).mockResolvedValue({ data: { isSuccess: true, data: counts } });
    fireEvent.click(screen.getByRole("button", { name: "Retry counts" }));
    await waitFor(() => expect(cardValues()[2]).toBe("20"));
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axios.get).mock.calls[0][0]).toContain("GetShipmentStatusCounts");
  });

  it("Shipment_whenRefreshIsClicked_requestsCountsAndCurrentShipments", async () => {
    renderShipment();
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(false));
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(vi.mocked(axios.get).mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      expect.stringContaining("GetShipmentStatusCounts"), expect.stringContaining("GetShipmentsByClientCode"),
    ]));
  });

  it("Shipment_whenPageChanges_doesNotReloadCounts", async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({ data: { isSuccess: true,
      data: String(url).includes("GetShipmentStatusCounts") ? [] : fullShipmentPage(),
    } }));
    renderShipment();
    await screen.findByRole("button", { name: "Open LOAD-1" });
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(vi.mocked(axios.get).mock.calls.every(([url]) => !String(url).includes("GetShipmentStatusCounts"))).toBe(true);
  });

  it("Shipment_whenUnmounted_abortsPendingCountLookup", async () => {
    vi.mocked(axios.get).mockImplementation((url) => String(url).includes("GetShipmentStatusCounts")
      ? new Promise(() => {}) : Promise.resolve({ data: { isSuccess: true, data: [] } }));
    const { unmount } = renderShipment();
    const request = vi.mocked(axios.get).mock.calls.find(([url]) => String(url).includes("GetShipmentStatusCounts"));
    await act(async () => unmount());
    expect(request?.[1]?.signal?.aborted).toBe(true);
  });
});

describe("Shipment status filtering", () => {
  beforeEach(() => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: [] } });
    vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [shipmentItem] } });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Shipment_whenMounted_selectsAllAndUsesDefaultList", async () => {
    renderShipment();
    await waitFor(() => expect(cardValues()[0]).toBe("0"));
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Booked" }).getAttribute("aria-pressed")).toBe("false");
    expect(axios.post).not.toHaveBeenCalled();
    expect(vi.mocked(axios.get).mock.calls.some(([url]) => String(url).includes("GetShipmentsByClientCode"))).toBe(true);
  });

  it.each([
    ["Booked", "Booked"], ["In Transit", "In Transit"], ["Delivered", "Delivered"],
    ["Pickup Requested", "Pickup Requested"], ["Expired", "Expired"],
    ["Pickup Succeed", "Pickup Succeed"], ["Pickup Failed", "Pickup Failed"],
    ["Out for Delivery", "Out For Delivery"],
  ])("Shipment_when%sIsSelected_postsCorrectStatusAndShowsRows", async (label, status) => {
    renderShipment();
    await waitFor(() => expect(cardValues()[0]).toBe("0"));
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/Shipment/SearchShipmentByStatus"),
      { statusCodes: [status], pageNumber: 1, pageSize: 20 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByRole("button", { name: label }).getAttribute("aria-pressed")).toBe("true");
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("Shipment_whenSelectedFilterIsClickedAgain_doesNotRepeatSearch", async () => {
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    vi.mocked(axios.post).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("Shipment_whenFilterChanges_resetsPageAndClearsSelectedRows", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { isSuccess: true, data: fullShipmentPage() } });
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select LOAD-1" }));
    expect((screen.getByRole("checkbox", { name: "Select LOAD-1" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    await waitFor(() => expect(screen.getByText("Table page 2")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "In Transit" }));
    expect(screen.queryByRole("button", { name: "Open LOAD-1" })).toBeNull();
    await screen.findByRole("button", { name: "Open LOAD-1" });
    expect(screen.getByText("Table page 1")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Select LOAD-1" }) as HTMLInputElement).checked).toBe(false);
    expect(vi.mocked(axios.post).mock.lastCall?.[1]).toEqual({ statusCodes: ["In Transit"], pageNumber: 1, pageSize: 20 });
  });

  it("Shipment_whenOldSearchCompletes_preservesNewFilterResults", async () => {
    let resolveOld!: (value: unknown) => void;
    vi.mocked(axios.post).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue({ data: { isSuccess: true, data: [{ ...shipmentItem, bolNo: "NEW-ROW" }] } });
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    const oldSignal = vi.mocked(axios.post).mock.calls[0][2]?.signal;
    fireEvent.click(screen.getByRole("button", { name: "In Transit" }));
    await screen.findByRole("button", { name: "Open NEW-ROW" });
    await act(async () => resolveOld({ data: { isSuccess: true, data: [{ ...shipmentItem, bolNo: "OLD-ROW" }] } }));
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: "Open OLD-ROW" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open NEW-ROW" })).toBeTruthy();
  });

  it("Shipment_whenOldDefaultListCompletes_preservesFilteredRows", async () => {
    let resolveOld!: (value: unknown) => void;
    vi.mocked(axios.get).mockImplementation((url) => String(url).includes("GetShipmentsByClientCode")
      ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ data: { isSuccess: true, data: [] } }));
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    await act(async () => resolveOld({ data: { isSuccess: true, data: [{ ...shipmentItem, bolNo: "OLD-ROW" }] } }));
    expect(screen.queryByRole("button", { name: "Open OLD-ROW" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open LOAD-1" })).toBeTruthy();
  });

  it("Shipment_whenFilteredRefreshIsClicked_refreshesCurrentPageAndCounts", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { isSuccess: true, data: fullShipmentPage() } });
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    vi.mocked(axios.post).mockClear();
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ statusCodes: ["Booked"], pageNumber: 2, pageSize: 20 });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axios.get).mock.calls[0][0]).toContain("GetShipmentStatusCounts");
  });

  it("Shipment_whenFilteredLookupFails_retryUsesSelectedStatusOnly", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("Search unavailable"));
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByText("Search unavailable");
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    expect(vi.mocked(axios.post).mock.lastCall?.[1]).toEqual({ statusCodes: ["Booked"], pageNumber: 1, pageSize: 20 });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("Shipment_whenNextFilteredPageIsEmpty_returnsToPreviousPageAndDisablesNext", async () => {
    vi.mocked(axios.post).mockImplementation(async (_, body) => ({ data: { isSuccess: true,
      data: body && typeof body === "object" && "pageNumber" in body && body.pageNumber === 1 ? fullShipmentPage() : [],
    } }));
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    expect(screen.getByText("Table page 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next table page" }) as HTMLButtonElement).disabled).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("Shipment_whenAllIsSelected_restoresDefaultEndpointOnFirstPage", async () => {
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    await screen.findByRole("button", { name: "Open LOAD-1" });
    vi.mocked(axios.post).mockClear();
    vi.mocked(axios.get).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(vi.mocked(axios.get).mock.calls[0][0]).toContain("GetShipmentsByClientCode");
    expect(vi.mocked(axios.get).mock.calls[0][1]?.params).toEqual({ pageNumber: 1, pageSize: 20 });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("Shipment_whenRowIsOpened_passesItsApiClientCodeInNavigationState", async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => ({ data: {
      isSuccess: true, data: String(url).includes("GetShipmentsByClientCode") ? [shipmentItem] : [],
    } }));
    renderShipment();
    fireEvent.click(await screen.findByRole("button", { name: "Open LOAD-1" }));
    expect(JSON.parse(screen.getByLabelText("Row context").textContent || "null")).toEqual({ loadNumber: "LOAD-1", clientCode: "ROW-CLIENT" });
  });

  it("Shipment_whenFilteredRowIsOpened_navigatesUsingLoadNumber", async () => {
    renderShipment();
    fireEvent.click(screen.getByRole("button", { name: "Booked" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open LOAD-1" }));
    expect(screen.getByLabelText("Current path").textContent).toBe("/shipments/LOAD-1");
    expect(JSON.parse(screen.getByLabelText("Row context").textContent || "null")).toEqual({ loadNumber: "LOAD-1", clientCode: "ROW-CLIENT" });
  });
});
