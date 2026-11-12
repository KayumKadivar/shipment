// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import axios from "axios";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import appReducer from "../store/appSlice";
import clientContextReducer from "../store/clientContextSlice";
import customerRateReducer from "../store/customerRateSlice";
import customerLocationReducer from "../store/customerLocationSlice";
import accessorialsReducer from "../store/accessorialsSlice";
import NewQuote from "./NewQuote";

const { searchPostals } = vi.hoisted(() => ({ searchPostals: vi.fn() }));

vi.mock("../hooks/usePostalLookup", () => ({
  usePostalLookup: () => ({ searchPostals, loadingPostal: false }),
}));

/** Mounts the quote page with isolated state and real postal input components. */
function renderQuote() {
  const store = configureStore({ reducer: {
    app: appReducer,
    clientContext: clientContextReducer,
    customerRate: customerRateReducer,
    customerLocation: customerLocationReducer,
    accessorials: accessorialsReducer,
  } });
  render(<Provider store={store}><MemoryRouter>
    <ConfigProvider virtual={false} theme={{ token: { motion: false } }}>
      <NewQuote />
    </ConfigProvider>
  </MemoryRouter></Provider>);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    /** Provides the observer method required by Ant Design. */
    observe = vi.fn();
    /** Provides the observer cleanup method required by Ant Design. */
    unobserve = vi.fn();
    /** Provides the observer disconnect method required by Ant Design. */
    disconnect = vi.fn();
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: [] } });
  vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [] } });
  searchPostals.mockResolvedValue([
    { postalCode: "80201", city: "Denver", state: "CO" },
    { postalCode: "80202", city: "Denver", state: "CO" },
  ]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  searchPostals.mockReset();
});

it("NewQuote_whenLocationInputsRender_disablesBrowserAutocomplete", () => {
  renderQuote();
  const inputs = screen.getAllByPlaceholderText("ZIP / Postal");
  expect(inputs).toHaveLength(2);
  for (const input of inputs) {
    expect(input.getAttribute("autocomplete")).toBe("off");
  }
});

it.each([0, 1])("NewQuote_whenPostalLookupReturnsMatches_displaysPostalSuggestions for location %i", async (index) => {
  renderQuote();
  const input = screen.getAllByPlaceholderText("ZIP / Postal")[index] as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "802" } });
  const suggestion = await screen.findByText("80201 - Denver, CO");
  expect(searchPostals).toHaveBeenCalledWith("802", "USA");
  fireEvent.click(suggestion);
  await waitFor(() => expect(input.value).toBe("80201 - Denver, CO"));
}, 15_000);
