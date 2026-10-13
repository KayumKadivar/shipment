import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCustomerProducts,
  getProductPackageTypes,
} from "./customerProductSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("customer product API behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
    });
  });

  it("getCustomerProducts_whenApiSucceeds_mapsTheProductContract", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        totalCount: 1,
        data: [
          {
            productId: 7,
            productDescription: "Widgets",
            productClass: "70",
            productNMFC: "12345",
            weight: 500,
            pallets: 2,
            isHazmat: true,
            packagingGroup: "Crate",
            isActive: true,
          },
        ],
      }),
    );

    const action = await getCustomerProducts(undefined)(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("customerProduct/getCustomerProducts/fulfilled");
    expect(action.payload).toEqual({
      totalCount: 1,
      products: [
        expect.objectContaining({
          key: "7",
          productID: 7,
          description: "Widgets",
          productClass: "70",
          nmfc: "12345",
          weight: 500,
          pallets: "2",
          isHazmat: true,
          packageGroup: "Crate",
          isActive: true,
        }),
      ],
    });
  });

  it("getProductPackageTypes_whenApiReturnsStringsAndObjects_mapsBothShapes", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse([
        " Box ",
        { PackageTypeId: 9, PackageType: " Drum " },
      ]),
    );

    const action = await getProductPackageTypes()(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "customerProduct/getProductPackageTypes/fulfilled",
    );
    expect(action.payload).toEqual([
      { packageTypeId: 1, packageType: "Box" },
      { packageTypeId: 9, packageType: "Drum" },
    ]);
  });
});
