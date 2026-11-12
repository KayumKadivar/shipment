// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfigProvider } from "antd";
import axios from "axios";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import appReducer, { login } from "../store/appSlice";
import clientContextReducer from "../store/clientContextSlice";
import customerLocationReducer from "../store/customerLocationSlice";
import customerProductReducer from "../store/customerProductSlice";
import type { CustomerProduct } from "../types/customerProduct.types";
import CustomerProductPage from "./CustomerProduct";
import CustomerProductAdd from "./CustomerProductAdd";

/** Labels used by Quotes and both product forms. */
const labels = ["HAZMAT UN/NA#", "Hazmat Proper Shipping Name", "Hazmat Class",
  "Hazmat Packing Group", "Hazmat Phone", "Hazmat Contact"];

/** Valid row snapshots keep product validation independent of hazmat behavior. */
const products: CustomerProduct[] = [7, 8].map((id) => ({
  key: String(id), productID: id, description: `Product ${id}`, isActive: true,
  nmfc: "123456-01", productClass: "70", isHazmat: true, length: 1, height: 1,
  weight: 10, width: 1, packageGroup: "Box",
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(axios, "get").mockImplementation(async (url) => ({ data: {
    isSuccess: true,
    data: String(url).includes("GetClientAndSubclientWithProfiles")
      ? [{ clientCode: "TEST", clientName: "Test Customer" }]
      : String(url).endsWith("/7")
        ? { productId: 7, productDescription: "Product 7", isHazmat: true, productClass: "70", weight: 10,
          hazmatUN: "UN1993", hazmatProperShippingName: "Flammable liquid", hazmatClass: "3",
          hazmatGroup: "II", hazmatPhone: "555-1234", hazmatContactName: "Emergency desk", packagingGroup: "Box" }
      : String(url).endsWith("/8")
        ? { productId: 8, productDescription: "Product 8", isHazmat: true, productClass: "70", weight: 10, hazmatPhone: null }
      : String(url).includes("Package") ? ["Box"] : [],
  } }));
  vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Mounts real product forms and thunks against deterministic HTTP responses. */
function renderProduct(add = false) {
  const store = configureStore({ reducer: {
    app: appReducer, clientContext: clientContextReducer, customerLocation: customerLocationReducer,
    customerProduct: customerProductReducer,
  } });
  store.dispatch(login({ token: "test-token", clientCode: "TEST" }));
  const setProducts = vi.fn();
  const onCreate = vi.fn();
  render(<Provider store={store}><MemoryRouter><ConfigProvider virtual={false} theme={{ token: { motion: false } }}>
    {add ? <CustomerProductAdd onCreate={onCreate} /> : <CustomerProductPage products={products} setProducts={setProducts} />}
  </ConfigProvider></MemoryRouter></Provider>);
  return { setProducts, onCreate };
}

it("CustomerProductAdd_whenHazmatSwitchTurnsOn_showsSixEmptyInputs", async () => {
  renderProduct(true);
  expect(screen.getByLabelText(labels[0]).closest("[hidden]")).not.toBeNull();
  fireEvent.click(screen.getByLabelText("Hazmat product"));
  await waitFor(() => expect(screen.getByLabelText(labels[0]).closest("[hidden]")).toBeNull());
  for (const label of labels) {
    expect(screen.getByLabelText(label).closest("[hidden]")).toBeNull();
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
  }
}, 20_000);

it("CustomerProductAdd_whenHazmatSwitchIsToggled_retainsEnteredValue", async () => {
  renderProduct(true);
  const toggle = screen.getByLabelText("Hazmat product");
  fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByLabelText(labels[0]).closest("[hidden]")).toBeNull());
  fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: "UN1993" } });
  fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByLabelText(labels[0]).closest("[hidden]")).not.toBeNull());
  fireEvent.click(toggle);
  await waitFor(() => expect(screen.getByLabelText(labels[0]).closest("[hidden]")).toBeNull());
  expect((screen.getByLabelText(labels[0]) as HTMLInputElement).value).toBe("UN1993");
}, 20_000);

it("CustomerProductAdd_whenSavedWithHazmatOff_submitsRetainedDetails", async () => {
  const { onCreate } = renderProduct(true);
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "New product" } });
  fireEvent.change(screen.getByLabelText("NMFC"), { target: { value: "123456-01" } });
  fireEvent.change(screen.getByLabelText("Product weight in pounds"), { target: { value: "10" } });
  fireEvent.mouseDown(screen.getByLabelText("Product Class"));
  fireEvent.click(await screen.findByText("70"));
  fireEvent.click(screen.getByLabelText("Hazmat product"));
  await waitFor(() => expect(screen.getByLabelText(labels[0]).closest("[hidden]")).toBeNull());
  labels.forEach((label, index) => fireEvent.change(screen.getByLabelText(label), { target: { value: `value ${index}` } }));
  fireEvent.click(screen.getByLabelText("Hazmat product"));
  fireEvent.click(screen.getByText("Save Product"));
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
    isHazmat: false, hazmatUN: "value 0", hazmatProperShippingName: "value 1", hazmatClass: "value 2",
    hazmatGroup: "value 3", hazmatPhone: "value 4", hazmatContact: "value 5",
  })));
}, 20_000);

it("CustomerProduct_whenEditOpens_loadsAllSixSavedDetails", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  const values = ["UN1993", "Flammable liquid", "3", "II", "555-1234", "Emergency desk"];
  labels.forEach((label, index) => expect((dialog.getByLabelText(label) as HTMLInputElement).value).toBe(values[index]));
}, 20_000);

it("CustomerProduct_whenHazmatIsSavedOff_submitsSixEmptyStrings", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByLabelText("Hazmat"));
  await waitFor(() => expect(dialog.getByLabelText(labels[0]).closest("[hidden]")).not.toBeNull());
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    isHazmat: false, hazmatUN: "", hazmatProperShippingName: "", hazmatClass: "",
    hazmatGroup: "", hazmatPhone: "", hazmatContactName: "", packagingGroup: "Box",
  }), expect.any(Object)));
}, 20_000);

it("CustomerProduct_whenHazmatIsSavedOn_submitsSixEnteredValues", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  labels.forEach((label, index) => fireEvent.change(dialog.getByLabelText(label), {
    target: { value: `edited value ${index}` },
  }));
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    isHazmat: true, hazmatUN: "edited value 0", hazmatProperShippingName: "edited value 1",
    hazmatClass: "edited value 2", hazmatGroup: "edited value 3", hazmatPhone: "edited value 4",
    hazmatContactName: "edited value 5",
  }), expect.any(Object)));
}, 20_000);

it("CustomerProduct_whenHazmatIsSavedOff_clearsLocalProductDetails", async () => {
  const { setProducts } = renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByLabelText("Hazmat"));
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(setProducts).toHaveBeenCalledOnce());
  const updateProducts = setProducts.mock.calls[0][0];
  const currentProducts = [{ ...products[0], hazmatUN: "UN1993",
    hazmatProperShippingName: "Flammable liquid", hazmatClass: "3", hazmatGroup: "II",
    hazmatPhone: "555-1234", hazmatContact: "Emergency desk" }, products[1]];
  const updatedProducts = updateProducts(currentProducts);
  expect(updatedProducts[0]).toMatchObject({
    isHazmat: false, hazmatUN: "", hazmatProperShippingName: "", hazmatClass: "",
    hazmatGroup: "", hazmatPhone: "", hazmatContact: "",
  });
  expect(updatedProducts[1]).toBe(currentProducts[1]);
}, 20_000);

it.each([labels[0], labels[2]])("CustomerProduct_whenHazmatIsOff_ignoresHiddenLengthErrorsFor%s", async (label) => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText(label), { target: { value: "x".repeat(51) } });
  await waitFor(() => expect(dialog.getByText("Use 50 characters or fewer")).toBeTruthy());
  fireEvent.click(dialog.getByLabelText("Hazmat"));
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
    expect.objectContaining({ isHazmat: false, hazmatUN: "", hazmatClass: "" }), expect.any(Object)));
}, 20_000);

it("CustomerProduct_whenHazmatIsToggledOffAndOn_retainsEnteredValues", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  labels.forEach((label, index) => fireEvent.change(dialog.getByLabelText(label), {
    target: { value: `edited value ${index}` },
  }));
  fireEvent.click(dialog.getByLabelText("Hazmat"));
  await waitFor(() => expect(dialog.getByLabelText(labels[0]).closest("[hidden]")).not.toBeNull());
  fireEvent.click(dialog.getByLabelText("Hazmat"));
  await waitFor(() => expect(dialog.getByLabelText(labels[0]).closest("[hidden]")).toBeNull());
  labels.forEach((label, index) => expect((dialog.getByLabelText(label) as HTMLInputElement).value)
    .toBe(`edited value ${index}`));
}, 20_000);

it("CustomerProduct_whenAnotherProductHasNoDetails_showsEmptyInputs", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  let dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByText("Cancel"));
  fireEvent.click(screen.getByLabelText("Edit Product 8"));
  await waitFor(() => {
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByDisplayValue("Product 8")).toBeTruthy();
  });
  for (const label of labels) expect((dialog.getByLabelText(label) as HTMLInputElement).value).toBe("");
}, 20_000);

it("CustomerProduct_whenSaveFails_keepsEditedValuesAndModalOpen", async () => {
  vi.mocked(axios.put).mockResolvedValue({ data: { isSuccess: false, message: "Update denied" } });
  const { setProducts } = renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText(labels[0]), { target: { value: "UN1234" } });
  fireEvent.click(dialog.getByText("Save Changes"));
  expect(await screen.findByText("Update denied")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect((dialog.getByLabelText(labels[0]) as HTMLInputElement).value).toBe("UN1234");
  expect(setProducts).not.toHaveBeenCalled();
}, 20_000);

it("CustomerProduct_whenDetailFetchFails_doesNotReusePreviousHazmatDetails", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  let dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByText("Cancel"));
  vi.mocked(axios.get).mockRejectedValueOnce(new Error("Details unavailable"));
  fireEvent.click(screen.getByLabelText("Edit Product 8"));
  await waitFor(() => {
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByDisplayValue("Product 8")).toBeTruthy();
  });
  for (const label of labels) expect((dialog.getByLabelText(label) as HTMLInputElement).value).toBe("");
}, 20_000);

it("CustomerProduct_whenHazmatFieldIsCleared_savesEmptyString", async () => {
  renderProduct();
  fireEvent.click(screen.getByLabelText("Edit Product 7"));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText(labels[0]), { target: { value: "" } });
  fireEvent.click(dialog.getByText("Save Changes"));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
    expect.objectContaining({ hazmatUN: "" }), expect.any(Object)));
}, 20_000);
