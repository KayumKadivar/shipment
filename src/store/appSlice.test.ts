import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

function createStorage(initialValues: Record<string, string>): Storage {
  const values = new Map(Object.entries(initialValues));

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("app authentication state", () => {
  beforeEach(() => {
    vi.resetModules();

    const storage = createStorage({
      authToken: "stored-token",
      username: "stored-user",
      profileCode: "stored-profile",
      isCorporate: "true",
      clientCode: "stored-client",
      clientName: "Stored Client",
      ratingClientCode: "stored-rating-client",
      ratingProfileCode: "stored-rating-profile",
    });

    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("appReducer_whenStoredCredentialsExist_startsUnauthenticated", async () => {
    const { default: appReducer } = await import("./appSlice");

    const state = appReducer(undefined, { type: "app/initialize" });

    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
    expect(state.profileCode).toBeNull();
    expect(state.isCorporate).toBeNull();
    expect(state.clientCode).toBeNull();
    expect(state.clientName).toBeNull();
    expect(state.ratingClientCode).toBeNull();
    expect(state.ratingProfileCode).toBeNull();
  });

  it("appReducer_whenStoredCredentialsAreAbsent_startsUnauthenticated", async () => {
    localStorage.clear();
    const { default: appReducer } = await import("./appSlice");

    const state = appReducer(undefined, { type: "app/initialize" });

    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
  });

  it("loginUser_whenFulfilled_authenticatesWithReturnedIdentity", async () => {
    const { default: appReducer, loginUser } = await import("./appSlice");
    const initialState = appReducer(undefined, { type: "app/initialize" });
    const identity = {
      token: "new-token",
      username: "new-user",
      profileCode: "new-profile",
      isCorporate: false,
      clientCode: "new-client",
      clientName: "New Client",
      ratingClientCode: "new-rating-client",
      ratingProfileCode: "new-rating-profile",
    };

    const state = appReducer(
      initialState,
      loginUser.fulfilled(identity, "login-request", {
        username: "new-user",
        password: "test-password",
      }),
    );

    expect(state).toMatchObject({ ...identity, isAuthenticated: true });
  });

  it("login_whenDispatched_marksCurrentRuntimeAuthenticated", async () => {
    const { default: appReducer, login } = await import("./appSlice");
    const initialState = appReducer(undefined, { type: "app/initialize" });

    const state = appReducer(initialState, login());

    expect(state.isAuthenticated).toBe(true);
  });

  it.each([
    [false, true],
    [true, false],
  ])("loginUser_ResponseFlag_%s_ClientFlag_%s_PrefersResponseFlag", async (responseFlag, clientFlag) => {
    vi.spyOn(axios, "create").mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: { isSuccess: true, data: "new-token" } }),
    } as unknown as ReturnType<typeof axios.create>);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { data: {
      isCorporate: responseFlag,
      clientAndProfileDetails: [{ clientCode: "CLIENT", isLoggedClient: true, isCorporate: clientFlag }],
    } } });
    const { loginUser } = await import("./appSlice");

    const action = await loginUser({ username: "user", password: "test-password" })(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("app/loginUser/fulfilled");
    expect(action.payload).toMatchObject({ isCorporate: responseFlag });
    expect(localStorage.getItem("isCorporate")).toBe(String(responseFlag));
  });

  it.each([true, false])("loginUser_EmptyClientList_PreservesResponseFlag_%s", async (responseFlag) => {
    vi.spyOn(axios, "create").mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: { isSuccess: true, data: "new-token" } }),
    } as unknown as ReturnType<typeof axios.create>);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { data: {
      isCorporate: responseFlag, clientAndProfileDetails: [],
    } } });
    const { loginUser } = await import("./appSlice");

    const action = await loginUser({ username: "user", password: "test-password" })(vi.fn(), vi.fn(), undefined);

    expect(action.payload).toMatchObject({ isCorporate: responseFlag });
    expect(localStorage.getItem("isCorporate")).toBe(String(responseFlag));
  });

  it.each([
    { clientAndProfileDetails: [{ isCorporate: false, isLoggedClient: true }] },
    [{ isCorporate: false, isLoggedClient: true }],
    { isCorporate: false, profiles: [{ profileCode: "PROFILE" }] },
  ])("loginUser_LegacyResponse_%j_PreservesCorporateFlag", async (data) => {
    vi.spyOn(axios, "create").mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: { isSuccess: true, data: "new-token" } }),
    } as unknown as ReturnType<typeof axios.create>);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { data } });
    const { loginUser } = await import("./appSlice");

    const action = await loginUser({ username: "user", password: "test-password" })(vi.fn(), vi.fn(), undefined);

    expect(action.payload).toMatchObject({ isCorporate: false });
    expect(localStorage.getItem("isCorporate")).toBe("false");
  });

  it.each(["missing", "failed"])("loginUser_ProfileFlag_%s_ClearsStaleCorporateFlag", async (scenario) => {
    vi.spyOn(axios, "create").mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: { isSuccess: true, data: "new-token" } }),
    } as unknown as ReturnType<typeof axios.create>);
    const request = vi.spyOn(axios, "get");
    if (scenario === "failed") request.mockRejectedValue(new Error("Profile unavailable"));
    else request.mockResolvedValue({ data: { data: { clientAndProfileDetails: [] } } });
    const { loginUser } = await import("./appSlice");

    const action = await loginUser({ username: "user", password: "test-password" })(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("app/loginUser/fulfilled");
    expect(action.payload).toMatchObject({ isCorporate: null });
    expect(localStorage.getItem("isCorporate")).toBeNull();
  });
});
