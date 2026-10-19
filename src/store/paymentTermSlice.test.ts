import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { fetchPaymentTerm } from "./paymentTermSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const createGetState = (loaded = false) => () => ({
  paymentTerm: {
    data: loaded ? ["Prepaid", "Collect"] : [],
    loading: false,
    loaded,
    error: null,
    currentRequestId: null,
  },
});

describe("paymentTerm API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPaymentTerm_whenRequested_usesPaymentTermEndpoint", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await fetchPaymentTerm()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("paymentTerm/fetchPaymentTerm/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/PaymentTerm`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json, text/plain, */*",
        }),
      }),
    );
  });

  it("fetchPaymentTerm_whenApiSucceeds_trimsAndDeduplicatesPaymentTerms", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: [" 3rd Party Prep ", "Prepaid", "3rd Party Prep", "Collect"],
      }),
    );

    const action = await fetchPaymentTerm()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("paymentTerm/fetchPaymentTerm/fulfilled");
    expect(action.payload).toEqual(["3rd Party Prep", "Prepaid", "Collect"]);
  });

  it("fetchPaymentTerm_whenApiReportsFailure_returnsTheApiMessage", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Payment term lookup failed",
        data: null,
      }),
    );

    const action = await fetchPaymentTerm()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("paymentTerm/fetchPaymentTerm/rejected");
    expect(action.payload).toBe("Payment term lookup failed");
  });

  it("fetchPaymentTerm_whenLookupIsAlreadyLoaded_doesNotIssueAnotherRequest", async () => {
    const getRequest = vi.spyOn(axios, "get");
    const dispatch = vi.fn();

    const action = await fetchPaymentTerm()(
      dispatch,
      createGetState(true),
      undefined,
    );

    expect(action).toMatchObject({
      type: "paymentTerm/fetchPaymentTerm/rejected",
      meta: { condition: true },
    });
    expect(getRequest).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
