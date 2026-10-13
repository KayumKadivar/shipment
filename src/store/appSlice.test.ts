import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    });

    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
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
  });

  it("login_whenDispatched_marksCurrentRuntimeAuthenticated", async () => {
    const { default: appReducer, login } = await import("./appSlice");
    const initialState = appReducer(undefined, { type: "app/initialize" });

    const state = appReducer(initialState, login());

    expect(state.isAuthenticated).toBe(true);
  });
});
