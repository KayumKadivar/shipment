// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { Provider } from "react-redux";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import appReducer, { login } from "../store/appSlice";
import clientContextReducer from "../store/clientContextSlice";
import customerProductReducer from "../store/customerProductSlice";
import customerLocationReducer from "../store/customerLocationSlice";
import CustomerProductPage from "./CustomerProduct";
import CustomerProductAdd from "./CustomerProductAdd";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  vi.spyOn(axios, "get").mockImplementation(async (url) => ({ data: {
    isSuccess: true,
    data: String(url).includes("GetClientAndSubclientWithProfiles")
      ? [{ clientCode: "A", clientName: "Customer A" }, { clientCode: "B", clientName: "Customer B" }]
      : [],
  } }));
  vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [], totalCount: 0 } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("CustomerProduct_whenSelectedCustomerNavigatesToAdd_preservesContextOnReturn", async () => {
  const store = configureStore({ reducer: {
    app: appReducer,
    clientContext: clientContextReducer,
    customerProduct: customerProductReducer,
    customerLocation: customerLocationReducer,
  } });
  store.dispatch(login({ token: "token", clientCode: "A" }));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/customer-products"]}>
        <Routes>
          <Route path="/customer-products" element={<CustomerProductPage products={[]} setProducts={vi.fn()} />} />
          <Route path="/customer-products/add" element={
            <><CustomerProductAdd onCreate={vi.fn()} /><Link to="/customer-products">Return to products</Link></>
          } />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  await waitFor(() => expect(store.getState().clientContext.customerProduct_selectedClientCode).toBe("A"));
  await waitFor(() => expect(store.getState().customerLocation.clients).toHaveLength(2));
  fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
  fireEvent.click(await screen.findByText("Customer B"));
  await waitFor(() => expect(store.getState().clientContext.customerProduct_selectedClientCode).toBe("B"));
  fireEvent.click(screen.getByRole("button", { name: /Add Products/ }));
  expect(await screen.findByDisplayValue("Customer B")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Return to products" }));
  await screen.findByRole("button", { name: /Add Products/ });
  expect(store.getState().clientContext.customerProduct_selectedClientCode).toBe("B");
}, 15_000);
