import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import appReducer, { login, logout } from "./appSlice";
import clientContextReducer, { setLocationClient, setProductClient, setQuoteClient } from "./clientContextSlice";
import customerProductReducer, { saveCustomerProduct, updateCustomerProduct } from "./customerProductSlice";
import customerLocationReducer, { saveCustomerLocation, updateCustomerLocation } from "./customerLocationSlice";
import chargeAccessorialsReducer, { fetchChargeAccessorials } from "./chargeAccessorialsSlice";
import type { CustomerProduct } from "../types/customerProduct.types";
import type { CustomerLocation } from "../types/customerLocation.types";

/** Creates an isolated store using the production reducers and thunk middleware. */
function createTestStore() {
  return configureStore({ reducer: {
    app: appReducer,
    clientContext: clientContextReducer,
    customerProduct: customerProductReducer,
    customerLocation: customerLocationReducer,
    chargeAccessorials: chargeAccessorialsReducer,
  } });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Redux customer context", () => {
  it("clientContext_whenWorkflowChanges_preservesIndependentSelections", () => {
    const store = createTestStore();
    store.dispatch(setProductClient({ clientCode: "PRODUCT", clientName: "Product Customer" }));
    store.dispatch(setLocationClient("LOCATION"));
    store.dispatch(setQuoteClient("QUOTE"));
    expect(store.getState().clientContext).toEqual({
      customerProduct_selectedClientCode: "PRODUCT",
      customerProduct_selectedClientName: "Product Customer",
      customerLocation_selectedClientCode: "LOCATION",
      quotes_selectedClientCode: "QUOTE",
    });
  });

  it("logout_whenCustomersAreSelected_resetsIdentityAndContext", () => {
    const store = createTestStore();
    store.dispatch(login({ token: "token", username: "user" }));
    store.dispatch(setProductClient({ clientCode: "PRODUCT", clientName: "Customer" }));
    store.dispatch(setLocationClient("LOCATION"));
    store.dispatch(setQuoteClient("QUOTE"));
    store.dispatch(logout());
    expect(store.getState().app).toMatchObject({ isAuthenticated: false, token: null, username: null });
    expect(Object.values(store.getState().clientContext)).toEqual([null, null, null, null]);
  });

  it("createStore_whenAnotherRuntimeHasSelections_startsWithEmptyContext", () => {
    const store = createTestStore();
    store.dispatch(setQuoteClient("QUOTE"));
    expect(createTestStore().getState().clientContext.quotes_selectedClientCode).toBeNull();
  });

  it.each(["save", "update"])(
    "productMutation_whenCustomerIsSelected_postsSelectedCustomer_$#",
    async (mutation) => {
      const store = createTestStore();
      store.dispatch(setProductClient({ clientCode: "PRODUCT-B", clientName: "Customer B" }));
      const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true } });
      const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
      const payload = { productID: 1 } as CustomerProduct;
      if (mutation === "save") await store.dispatch(saveCustomerProduct(payload));
      else await store.dispatch(updateCustomerProduct({ ...payload, productID: 1 }));
      expect([...post.mock.calls, ...put.mock.calls][0]?.[1]).toMatchObject({ clientCode: "PRODUCT-B" });
    },
  );

  it.each(["save", "update"])(
    "locationMutation_whenCustomerIsSelected_postsSelectedCustomer_$#",
    async (mutation) => {
      const store = createTestStore();
      store.dispatch(setLocationClient("LOCATION-B"));
      const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true } });
      const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
      const payload = { locationId: 1 } as CustomerLocation;
      if (mutation === "save") await store.dispatch(saveCustomerLocation(payload));
      else await store.dispatch(updateCustomerLocation({ ...payload, locationId: 1 }));
      expect([...post.mock.calls, ...put.mock.calls][0]?.[1]).toMatchObject({ clientCode: "LOCATION-B" });
    },
  );

  it("fetchChargeAccessorials_whenInputIsAbsent_tracksReduxClientWhilePending", async () => {
    const store = createTestStore();
    store.dispatch(login({ token: "token", clientCode: "REDUX-CLIENT" }));
    const get = vi.spyOn(axios, "get").mockImplementation(async () => {
      expect(store.getState().chargeAccessorials.requestedClientCode).toBe("REDUX-CLIENT");
      return { data: { isSuccess: true, data: [] } };
    });
    await store.dispatch(fetchChargeAccessorials(undefined));
    expect(get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      params: expect.objectContaining({ clientCode: "REDUX-CLIENT" }),
    }));
  });
});
