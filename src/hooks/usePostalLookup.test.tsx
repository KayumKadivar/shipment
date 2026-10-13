// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostalLookup, type PostalResult } from "./usePostalLookup";

const mocks = vi.hoisted(() => ({
  state: {
    app: {
      countries: [
        { countryId: 1, countryCode: "USA", countryName: "United States" },
      ],
    },
  },
}));

vi.mock("../app/hooks", () => ({
  useAppSelector: (
    selector: (state: typeof mocks.state) => unknown,
  ) => selector(mocks.state),
}));

vi.mock("antd", () => ({
  message: { error: vi.fn() },
}));

const createAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("usePostalLookup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.state.app.countries = [
      { countryId: 1, countryCode: "USA", countryName: "United States" },
    ];
  });

  it("searchPostals_whenCountryExists_mapsPostalResults", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: [
          { cityName: "New York", stateCode: " NY ", postalCode: null },
        ],
      }),
    );
    const { result } = renderHook(() => usePostalLookup());
    let postalResults: PostalResult[] = [];

    await act(async () => {
      postalResults = await result.current.searchPostals("10001", "USA");
    });

    expect(getRequest).toHaveBeenCalledWith(
      expect.stringContaining("/Postals/GetPostalsByPostalCodeAndCountryId"),
      { params: { postalCode: "10001", countryId: 1 } },
    );
    expect(postalResults).toEqual([
      { city: "New York", state: "NY", postalCode: "10001" },
    ]);
  });

  it("searchPostals_whenCountryIsUnknown_doesNotCallTheApi", async () => {
    const getRequest = vi.spyOn(axios, "get");
    const { result } = renderHook(() => usePostalLookup());
    let postalResults: PostalResult[] = [];

    await act(async () => {
      postalResults = await result.current.searchPostals("H0H0H0", "CAN");
    });

    expect(postalResults).toEqual([]);
    expect(getRequest).not.toHaveBeenCalled();
  });
});
