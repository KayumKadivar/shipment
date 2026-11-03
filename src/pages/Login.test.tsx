// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Login from "./Login";

const { dispatchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
}));

vi.mock("../app/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: () => false,
}));

vi.mock("../store/appSlice", () => ({
  loginUser: vi.fn((credentials: { username: string; password: string }) => ({
    payload: credentials,
    type: "app/loginUser",
  })),
}));

describe("Login", () => {
  beforeEach(() => {
    localStorage.clear();
    dispatchMock.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        profileCode: null,
        token: "test-token",
        username: "test-user",
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const fillAndSubmitLogin = (
    username = "test-user",
    password = "test-password",
  ) => {
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: username },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: password },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  };

  it("Login_whenFirstVisited_doesNotOfferRememberMe", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.queryByRole("checkbox", { name: "Remember me" })).toBeNull();
  });

  it("Login_whenRememberedUsernameExists_ignoresBrowserStorage", () => {
    localStorage.setItem("rememberedUsername", "remembered-user");
    render(<Login onLogin={vi.fn()} />);
    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe("");
  });

  it("Login_whenRendered_usesSvgPoweredByInlandLogo", () => {
    render(<Login onLogin={vi.fn()} />);

    expect(
      screen.getByAltText("Powered by Inland").getAttribute("src"),
    ).toContain("login-logo-down.svg");
  });

  it("Login_whenStorageIsUnavailable_submitsTrimmedCredentials", async () => {
    const accessStorage = vi.fn(() => { throw new Error("Storage unavailable"); });
    vi.stubGlobal("localStorage", { getItem: accessStorage, setItem: accessStorage });
    render(<Login onLogin={vi.fn()} />);
    fillAndSubmitLogin("  test-user  ");
    await screen.findByLabelText("Login in progress");
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: { username: "test-user", password: "test-password" },
    }));
    expect(accessStorage).not.toHaveBeenCalled();
  });

  it("Login_whenAuthenticationFails_doesNotChangeRememberedUsername", async () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "old-user");
    dispatchMock.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue("Invalid credentials"),
    });
    render(<Login onLogin={vi.fn()} />);

    fillAndSubmitLogin("new-user");

    await screen.findByText("Invalid credentials");

    expect(localStorage.getItem("rememberUsername")).toBe("true");
    expect(localStorage.getItem("rememberedUsername")).toBe("old-user");
  });

  it("Login_whenProgressAnimationCompletes_callsOnLoginOnlyAfterFullAnimation", async () => {
    vi.useFakeTimers();
    const onLogin = vi.fn();
    const { container } = render(<Login onLogin={onLogin} />);

    await act(async () => fillAndSubmitLogin());
    expect(screen.getByLabelText("Login in progress").style.getPropertyValue("--login-progress-duration")).toBe("3000ms");

    expect(onLogin).not.toHaveBeenCalled();

    const animationEndEvent = new Event("animationend", {
      bubbles: true,
    });
    Object.defineProperty(animationEndEvent, "animationName", {
      value: "login-progress-fill",
    });
    fireEvent(
      container.querySelector(".login-progress-fill")!,
      animationEndEvent,
    );

    expect(onLogin).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2999));
    expect(onLogin).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLogin).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(5000));
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it("Login_whenUnmountedDuringProgress_cancelsCompletion", async () => {
    vi.useFakeTimers();
    const onLogin = vi.fn();
    const { unmount } = render(<Login onLogin={onLogin} />);
    await act(async () => fillAndSubmitLogin());
    expect(screen.getByLabelText("Login in progress")).toBeTruthy();
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("Login_whenAuthenticationFails_doesNotStartProgress", async () => {
    vi.useFakeTimers();
    dispatchMock.mockReturnValue({ unwrap: vi.fn().mockRejectedValue("Invalid credentials") });
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    await act(async () => fillAndSubmitLogin());
    expect(screen.queryByLabelText("Login in progress")).toBeNull();
    expect(screen.getByText("Invalid credentials")).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(onLogin).not.toHaveBeenCalled();
  });
});
