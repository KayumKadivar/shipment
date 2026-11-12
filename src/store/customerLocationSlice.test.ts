import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchClientsAndSubclients,
  getAllCustomerLocations,
  getCustomerLocationByID,
  updateCustomerLocation,
} from "./customerLocationSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("customer location API behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["openTime", "closeTime"] as const)(
    "getCustomerLocationByID_when%sExists_preservesTime",
    async (field) => {
      vi.spyOn(axios, "get").mockResolvedValue(createAxiosResponse({
        isSuccess: true, data: { locationId: 42, [field]: "08:15:30" },
      }));
      const action = await getCustomerLocationByID({ locationID: 42 })(vi.fn(), vi.fn(), undefined);
      expect(action.payload).toMatchObject({ [field]: "08:15:30" });
    },
  );

  it.each(["openTime", "closeTime"] as const)(
    "getAllCustomerLocations_when%sExists_preservesTime",
    async (field) => {
      vi.spyOn(axios, "get").mockResolvedValue(createAxiosResponse({
        isSuccess: true, data: [{ locationId: 42, [field]: "00:00" }],
      }));
      const action = await getAllCustomerLocations("TEST")(vi.fn(), vi.fn(), undefined);
      expect(action.payload).toMatchObject({ locations: [{ [field]: "00:00" }] });
    },
  );

  it.each(["openTime", "closeTime"] as const)(
    "getCustomerLocationByID_when%sIsNull_leavesTimeUnset",
    async (field) => {
      vi.spyOn(axios, "get").mockResolvedValue(createAxiosResponse({
        isSuccess: true, data: { locationId: 42, [field]: null },
      }));
      const action = await getCustomerLocationByID({ locationID: 42 })(vi.fn(), vi.fn(), undefined);
      expect(action.payload).toMatchObject({ [field]: undefined });
    },
  );

  it.each(["openTime", "closeTime"] as const)(
    "updateCustomerLocation_when%sChanges_sendsSelectedTime",
    async (field) => {
      const put = vi.spyOn(axios, "put").mockResolvedValue(createAxiosResponse({ isSuccess: true }));
      await updateCustomerLocation({ locationId: 42, [field]: " 18:00 " })(vi.fn(), vi.fn(), undefined);
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/Location"),
        expect.objectContaining({ [field]: "18:00" }), expect.any(Object));
    },
  );

  it.each([
    ["openTime", undefined], ["closeTime", undefined],
    ["openTime", ""], ["closeTime", "   "],
  ] as const)(
    "updateCustomerLocation_when%sIsClearedWith%j_sendsNull",
    async (field, value) => {
      const put = vi.spyOn(axios, "put").mockResolvedValue(createAxiosResponse({ isSuccess: true }));
      await updateCustomerLocation({ locationId: 42, [field]: value })(vi.fn(), vi.fn(), undefined);
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/Location"),
        expect.objectContaining({ [field]: null }), expect.any(Object));
    },
  );

  it("updateCustomerLocation_whenApiReportsFailure_rejectsWithApiMessage", async () => {
    vi.spyOn(axios, "put").mockResolvedValue(
      createAxiosResponse({ isSuccess: false, message: "Update denied" }),
    );

    const action = await updateCustomerLocation({ locationId: 42 })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("customerLocation/updateCustomerLocation/rejected");
    expect(action.payload).toBe("Update denied");
  });

  it("fetchClientsAndSubclients_whenApiReturnsWrappedProfiles_mapsClientOptions", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          clientName: "Main Client",
          clientCode: "MAIN",
          profiles: [{ profileCode: "PROFILE-1" }],
        },
      }),
    );

    const action = await fetchClientsAndSubclients()(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "customerLocation/fetchClientsAndSubclients/fulfilled",
    );
    expect(action.payload).toEqual([
      { clientName: "Main Client", clientCode: "MAIN" },
      { clientName: "PROFILE-1", clientCode: "PROFILE-1" },
    ]);
  });
});
