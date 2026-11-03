import axios, { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureApiAuthentication } from "./apiConfig";

/** Captures outgoing headers without accessing a network. */
async function requestHeaders(authorization?: string) {
  const response = await axios.get("/redux-auth-test", {
    headers: authorization ? { Authorization: authorization } : {},
    adapter: async (config) => ({
      data: config.headers,
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    }),
  });
  return response.data as AxiosHeaders;
}

afterEach(() => {
  configureApiAuthentication(() => null);
  vi.unstubAllGlobals();
});

describe("Redux API authentication", () => {
  it("configureApiAuthentication_whenTokenChanges_readsTheLatestToken", async () => {
    let token: string | null = "first-token";
    configureApiAuthentication(() => token);
    expect((await requestHeaders()).Authorization).toBe("Bearer first-token");
    token = "second-token";
    expect((await requestHeaders()).Authorization).toBe("Bearer second-token");
    token = null;
    expect((await requestHeaders()).Authorization).toBeUndefined();
  });

  it("configureApiAuthentication_whenAuthorizationIsExplicit_preservesIt", async () => {
    configureApiAuthentication(() => "redux-token");
    expect((await requestHeaders("Bearer login-token")).Authorization).toBe("Bearer login-token");
  });

  it("configureApiAuthentication_whenStorageThrows_doesNotAccessIt", async () => {
    const accessStorage = vi.fn(() => { throw new Error("Storage unavailable"); });
    vi.stubGlobal("localStorage", { getItem: accessStorage });
    vi.stubGlobal("sessionStorage", { getItem: accessStorage });
    configureApiAuthentication(() => "redux-token");
    expect((await requestHeaders()).Authorization).toBe("Bearer redux-token");
    expect(accessStorage).not.toHaveBeenCalled();
  });
});
