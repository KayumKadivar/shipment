// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
    vi.clearAllMocks();
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

  it("Login_whenFirstVisited_checksRememberMeByDefault", () => {
    render(<Login onLogin={vi.fn()} />);

    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      (screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("Login_whenRememberedUsernameExists_prefillsUsername", () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "remembered-user");

    render(<Login onLogin={vi.fn()} />);

    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe(
      "remembered-user",
    );
    expect((screen.getByLabelText(/password/i) as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("Login_whenRendered_usesSvgPoweredByInlandLogo", () => {
    render(<Login onLogin={vi.fn()} />);

    expect(
      screen.getByAltText("Powered by Inland").getAttribute("src"),
    ).toContain("login-logo-down.svg");
  });

  it("Login_whenSuccessfulAndRememberMeChecked_savesTrimmedUsername", async () => {
    render(<Login onLogin={vi.fn()} />);

    fillAndSubmitLogin("  remembered-user  ");

    await screen.findByLabelText("Login in progress");

    expect(localStorage.getItem("rememberUsername")).toBe("true");
    expect(localStorage.getItem("rememberedUsername")).toBe("remembered-user");
  });

  it("Login_whenSuccessfulAndRememberMeIsUnchecked_removesRememberedUsername", async () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "old-user");
    render(<Login onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    fillAndSubmitLogin("new-user");

    await screen.findByLabelText("Login in progress");

    expect(localStorage.getItem("rememberUsername")).toBe("false");
    expect(localStorage.getItem("rememberedUsername")).toBeNull();
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
    const onLogin = vi.fn();
    const { container } = render(<Login onLogin={onLogin} />);

    fillAndSubmitLogin();

    await waitFor(() => {
      expect(container.querySelector(".login-progress-fill")).not.toBeNull();
    });

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

    expect(onLogin).toHaveBeenCalledOnce();
  });
});
