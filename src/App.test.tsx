// @vitest-environment jsdom

import { configureStore } from "@reduxjs/toolkit";
import { theme } from "antd";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import appReducer, { login, loginUser } from "./store/appSlice";
import customerLocationReducer from "./store/customerLocationSlice";
import customerProductReducer from "./store/customerProductSlice";

vi.mock("./components/Navbar.tsx", () => ({ default: () => <nav>Navbar</nav> }));
vi.mock("./components/Sidebar.tsx", () => ({ default: () => <aside>Sidebar<ThemeProbe /></aside> }));
vi.mock("./pages/Login.tsx", () => ({ default: ({ onLogin }: { onLogin: () => void }) => (
  <main aria-label="Login page"><button onClick={onLogin}>Complete login transition</button></main>
) }));
vi.mock("./router/index.tsx", () => ({ default: () => (
  <main aria-label="Protected content"><Link to="/quotes">Open quotes</Link></main>
) }));
vi.mock("./store/appSlice", async (importOriginal) => ({
  ...await importOriginal<typeof import("./store/appSlice")>(),
  fetchCountries: () => ({ type: "test/fetchCountries" }),
}));
vi.mock("./store/accessorialsSlice", () => ({ fetchAccessorials: () => ({ type: "test/fetchAccessorials" }) }));
vi.mock("./store/equipmentSlice", () => ({ fetchEquipment: () => ({ type: "test/fetchEquipment" }) }));
vi.mock("./store/serviceLevelSlice", () => ({ fetchServiceLevel: () => ({ type: "test/fetchServiceLevel" }) }));
vi.mock("./store/paymentTermSlice", () => ({ fetchPaymentTerm: () => ({ type: "test/fetchPaymentTerm" }) }));

/** Exposes the router's current URL so redirects can be asserted without browser navigation. */
function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current URL">{location.pathname + location.search + location.hash}</output>;
}

/** Exposes resolved theme colors from the application's real configuration provider. */
function ThemeProbe() {
  const { token } = theme.useToken();
  return <>{(["colorPrimary", "colorInfo", "colorError"] as const).map((name) => (
    <output key={name} aria-label={name}>{token[name]}</output>
  ))}</>;
}

/** Creates a fresh Redux runtime for each authentication scenario. */
function createTestStore() {
  return configureStore({ reducer: {
    app: appReducer,
    customerLocation: customerLocationReducer,
    customerProduct: customerProductReducer,
  } });
}

/** Renders the production application guard against a controlled in-memory URL. */
function renderApp(store: ReturnType<typeof createTestStore>, path: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("application authentication routing", () => {
  it.each(["colorPrimary", "colorInfo", "colorError"])(
    "App_whenAuthenticated_suppliesNewRedFor%s",
    (name) => {
      const store = createTestStore();
      store.dispatch(login({ token: "test-token" }));
      renderApp(store, "/shipments");
      expect(screen.getByLabelText(name).textContent).toBe("#a31d14");
    },
  );
  it.each(["/quotes", "/shipments/LOAD-1?tab=load#products", "/?previous=quotes#load"])(
    "App_whenLoggedOutAtProtectedUrl_showsLoginAndReplacesUrlWithRoot_%s",
    async (path) => {
      renderApp(createTestStore(), path);
      expect(screen.getByRole("main", { name: "Login page" })).toBeTruthy();
      expect(screen.queryByRole("main", { name: "Protected content" })).toBeNull();
      await waitFor(() => expect(screen.getByLabelText("Current URL").textContent).toBe("/"));
    },
  );

  it("App_whenAuthenticatedFlagHasNoToken_hidesProtectedContent", async () => {
    const store = createTestStore();
    store.dispatch(login());
    renderApp(store, "/quotes");
    expect(screen.queryByRole("main", { name: "Protected content" })).toBeNull();
    expect(screen.getByRole("main", { name: "Login page" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("Current URL").textContent).toBe("/"));
  });

  it("App_whenAuthenticatedWithToken_allowsProtectedNavigation", () => {
    const store = createTestStore();
    store.dispatch(login({ token: "test-token" }));
    renderApp(store, "/shipments");
    expect(screen.queryByRole("main", { name: "Login page" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Open quotes" }));
    expect(screen.getByLabelText("Current URL").textContent).toBe("/quotes");
    expect(screen.getByRole("main", { name: "Protected content" })).toBeTruthy();
  });

  it("App_whenLoginCompletes_allowsProtectedContent", async () => {
    const store = createTestStore();
    const dispatch = vi.spyOn(store, "dispatch");
    renderApp(store, "/quotes");
    await waitFor(() => expect(screen.getByLabelText("Current URL").textContent).toBe("/"));
    act(() => store.dispatch(loginUser.fulfilled({
      token: "test-token", username: "user", profileCode: null,
    }, "login-request", { username: "user", password: "password" })));
    expect(screen.queryByRole("main", { name: "Protected content" })).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith({ type: "test/fetchCountries" });
    fireEvent.click(screen.getByRole("button", { name: "Complete login transition" }));
    expect(screen.getByRole("main", { name: "Protected content" })).toBeTruthy();
    expect(screen.queryByRole("main", { name: "Login page" })).toBeNull();
    expect(screen.getByLabelText("Current URL").textContent).toBe("/shipments");
    expect(dispatch).toHaveBeenCalledWith({ type: "test/fetchCountries" });
  });
});
