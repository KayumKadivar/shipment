import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuoteById, fetchQuotes, searchQuote } from "./quoteSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const quote = {
  quoteRequestId: 12,
  pickupDate: "2026-10-10",
  requestedDate: "2026-10-09",
  originCity: "Chicago",
  originStateCode: "IL",
  originZip: "60601",
  destinationCity: "Dallas",
  destinationStateCode: "TX",
  destinationZip: "75201",
  clientName: "Client",
  clientCode: "CLIENT",
  profileCode: "PROFILE",
  isAgentQuote: true,
  marginType: "Percent",
  marginPercent: 0,
  quoteProducts: [{ quoteProductId: 1, weight: 100, pallets: 1 }],
  quoteAccessorials: [{ quoteAccessorialId: 2, accCode: "LIFT" }],
  quoteResults: [{ quoteResultId: 3, scac: "TEST", carrierName: "Carrier" }],
  createdBy: "TEST_USER",
};

describe("quote API behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchQuotes_whenApiSucceeds_returnsTypedNestedQuoteData", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, data: [quote] }),
    );

    const action = await fetchQuotes({ clientCode: "CLIENT" })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("quote/fetchQuotes/fulfilled");
    expect(action.payload).toEqual([quote]);
  });

  it("searchQuote_whenApiSucceeds_returnsQuotes", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, data: [quote] }),
    );

    const action = await searchQuote({
      referenceNumber: "12",
      clientName: "Client",
      createdBy: "TEST_USER",
    })(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("quote/searchQuote/fulfilled");
    expect(action.payload).toEqual([quote]);
  });

  it("searchQuote_whenAxiosFails_returnsErrorMessage", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { data: { message: "Search failed" } },
    });

    const action = await searchQuote({ referenceNumber: "invalid" })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("quote/searchQuote/rejected");
    expect(action.payload).toBe("Search failed");
  });

  it("fetchQuoteById_whenAxiosFails_returnsTheServerMessage", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { data: { message: "Quote missing" } },
    });

    const action = await fetchQuoteById("12")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("quote/fetchQuoteById/rejected");
    expect(action.payload).toBe("Quote missing");
  });
});
