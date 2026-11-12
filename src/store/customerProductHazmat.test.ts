import axios from "axios";
import { afterEach, expect, it, vi } from "vitest";
import {
  getCustomerProductByID, getCustomerProductByDesc, getCustomerProducts,
  searchCustomerProducts, saveCustomerProduct, updateCustomerProduct,
} from "./customerProductSlice";
import type { CustomerProduct } from "../types/customerProduct.types";

/** Form and API field pairs preserve the existing contact identifier at the UI boundary. */
const fields = [
  ["hazmatUN", "hazmatUN"],
  ["hazmatProperShippingName", "hazmatProperShippingName"],
  ["hazmatClass", "hazmatClass"],
  ["hazmatGroup", "hazmatGroup"],
  ["hazmatPhone", "hazmatPhone"],
  ["hazmatContact", "hazmatContactName"],
] as const;

/** Supplies valid product values without any hazardous-material details. */
const product: CustomerProduct = {
  key: "7", productID: 7, description: "Product", isActive: true, nmfc: "123456-01",
  productClass: "70", isHazmat: false, length: 1, height: 1, weight: 1, width: 1,
  packageGroup: "Box",
};

/** Uses a controlled client context for requests without accessing browser storage. */
const getState = vi.fn(() => ({ clientContext: { customerProduct_selectedClientCode: "TEST" } }));

afterEach(() => vi.restoreAllMocks());

it.each(fields)("saveCustomerProduct_when%sIsEntered_sendsMatchingApiField", async (field, apiField) => {
  const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true } });
  await saveCustomerProduct({ ...product, [field]: "saved value" })(vi.fn(), getState, undefined);
  expect(post).toHaveBeenCalledWith(expect.stringContaining("/Product"),
    expect.objectContaining({ [apiField]: "saved value", packagingGroup: "Box", isHazmat: false }), expect.any(Object));
});

it.each(fields)("updateCustomerProduct_when%sIsEntered_sendsMatchingApiField", async (field, apiField) => {
  const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
  await updateCustomerProduct({ ...product, productID: 7, [field]: "saved value" })(vi.fn(), getState, undefined);
  expect(put).toHaveBeenCalledWith(expect.stringContaining("/Product"),
    expect.objectContaining({ [apiField]: "saved value", packagingGroup: "Box" }), expect.any(Object));
});

it.each(fields)("updateCustomerProduct_when%sIsCleared_sendsEmptyString", async (field, apiField) => {
  const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true } });
  await updateCustomerProduct({ productID: 7, [field]: "" })(vi.fn(), getState, undefined);
  expect(put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ [apiField]: "" }), expect.any(Object));
});

for (const [name, retrieve, isList] of [
  ["getCustomerProducts", () => getCustomerProducts({ clientCode: "TEST" })(vi.fn(), getState, undefined), true],
  ["getCustomerProductByID", () => getCustomerProductByID(7)(vi.fn(), getState, undefined), false],
  ["getCustomerProductByDesc", () => getCustomerProductByDesc({ description: "Product" })(vi.fn(), getState, undefined), false],
  ["searchCustomerProducts", () => searchCustomerProducts({ clientID: "TEST", description: "Product" })(vi.fn(), getState, undefined), true],
] as const) {
  it.each(fields)(`${name}_when%sIsReturned_preservesValue`, async (field, apiField) => {
    const data = { productId: 7, [apiField]: "saved value" };
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: isList ? [data] : data } });
    const action = await retrieve();
    expect(action.payload).toMatchObject(name === "getCustomerProducts"
      ? { products: [{ [field]: "saved value" }] }
      : isList ? [{ [field]: "saved value" }] : { [field]: "saved value" });
  });
}

it.each([null, undefined])("getCustomerProductByID_whenHazmatValuesAre%j_mapsEmptyInputs", async (value) => {
  const data = Object.fromEntries(fields.map(([, apiField]) => [apiField, value]));
  vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: { productId: 7, ...data } } });
  const action = await getCustomerProductByID(7)(vi.fn(), getState, undefined);
  expect(action.payload).toMatchObject(Object.fromEntries(fields.map(([field]) => [field, ""])));
});

it("getCustomerProductByID_whenLegacyContactIsReturned_preservesContact", async () => {
  vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: { productId: 7, hazmatContact: "Legacy" } } });
  expect((await getCustomerProductByID(7)(vi.fn(), getState, undefined)).payload).toMatchObject({ hazmatContact: "Legacy" });
});

it("updateCustomerProduct_whenApiReportsFailureWithoutMessage_rejects", async () => {
  vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: false } });
  const action = await updateCustomerProduct({ productID: 7 })(vi.fn(), getState, undefined);
  expect(action.type).toBe("customerProduct/updateCustomerProduct/rejected");
});
