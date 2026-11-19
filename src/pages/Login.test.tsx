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
import appStyles from "../App.css?raw";
import vectorLoginLogo from "../assets/Vector-login.svg";

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

  it("Login_whenFirstVisited_offersUncheckedRememberMe", () => {
    render(<Login onLogin={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement).checked).toBe(false);
  });

  it("Login_whenEntryStylesApply_keepsRememberMeBoxVisible", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = appStyles.slice(
      appStyles.indexOf("/* Login page */"),
      appStyles.indexOf(".login-page--progress {"),
    );
    try {
      // Isolate the application CSS from jsdom's incomplete CSS-in-JS cascade.
      // Ant Design 6 draws the box directly on this span, without an inner span.
      render(
        <main className='login-page login-page--entry'>
          <label className='login-remember'>
            <span className='ant-checkbox'>
              <input type='checkbox' />
            </span>
            Remember me
          </label>
        </main>,
      );
      document.head.appendChild(stylesheet);
      const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
      const box = checkbox.closest(".ant-checkbox")!;
      const style = window.getComputedStyle(box);
      expect(style.width).not.toBe("auto");
      expect(style.width).not.toBe("");
      expect(style.height).not.toBe("auto");
      expect(style.height).not.toBe("");
      expect(style.backgroundColor).toBe("rgb(255, 255, 255)");
    } finally {
      stylesheet.remove();
    }
  });

  it("Login_whenRememberedUsernameExists_ignoresBrowserStorage", () => {
    localStorage.setItem("rememberedUsername", "remembered-user");
    render(<Login onLogin={vi.fn()} />);
    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe("");
  });

  it("Login_whenRememberPreferenceIsEnabled_prefillsSavedUsername", () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "remembered-user");
    render(<Login onLogin={vi.fn()} />);
    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe("remembered-user");
    expect((screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/password/i) as HTMLInputElement).value).toBe("");
  });

  it("Login_whenSavedUsernameIsBlank_leavesRememberMeUnchecked", () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "   ");
    render(<Login onLogin={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement).checked).toBe(false);
  });

  it("Login_whenRememberMeIsCheckedAndLoginSucceeds_savesOnlyTrimmedUsername", async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    fillAndSubmitLogin("  new-user  ");
    await screen.findByLabelText("Login in progress");
    expect({ ...localStorage }).toEqual({ rememberUsername: "true", rememberedUsername: "new-user" });
  });

  it("Login_whenRememberMeIsUncheckedAndLoginSucceeds_clearsSavedUsername", async () => {
    localStorage.setItem("rememberUsername", "true");
    localStorage.setItem("rememberedUsername", "old-user");
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    fillAndSubmitLogin();
    await screen.findByLabelText("Login in progress");
    expect(localStorage.getItem("rememberUsername")).toBeNull();
    expect(localStorage.getItem("rememberedUsername")).toBeNull();
  });

  it("Login_whenStorageWriteFails_stillStartsProgress", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(() => { throw new Error("Storage unavailable"); }),
    });
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    fillAndSubmitLogin();
    expect(await screen.findByLabelText("Login in progress")).toBeTruthy();
  });

  it("Login_whenRendered_usesVectorLoginLogo", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByAltText("NICO LTL").getAttribute("src")).toBe(vectorLoginLogo);
  });

  it("Login_whenEntryCardStylesApply_capsWidthAt376Point2Pixels", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = appStyles.slice(
      appStyles.indexOf("/* Login page */"),
      appStyles.indexOf(".login-page--progress {"),
    );
    try {
      render(
        <main className='login-page login-page--entry'>
          <section className='login-card' aria-label='Login card' />
        </main>,
      );
      document.head.appendChild(stylesheet);

      expect(window.getComputedStyle(screen.getByLabelText("Login card")).maxWidth).toBe("418.6592487px");
    } finally {
      stylesheet.remove();
    }
  });

  it("Login_whenCompactSpacingApplies_reducesFormTopMarginTo28Pixels", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = appStyles.slice(
      appStyles.indexOf("/* Login page */"),
      appStyles.indexOf(".login-page--progress {"),
    );
    try {
      render(
        <main className='login-page login-page--entry'>
          <form className='login-form' aria-label='Login form' />
        </main>,
      );
      document.head.appendChild(stylesheet);

      expect(window.getComputedStyle(screen.getByRole("form", { name: "Login form" })).marginTop).toBe("28.84px");
    } finally {
      stylesheet.remove();
    }
  });

  it("Login_whenEntryStylesApply_usesRequestedInputTypographyAndPadding", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = appStyles.slice(
      appStyles.indexOf("/* Login page */"),
      appStyles.indexOf(".login-page--progress {"),
    );
    try {
      // Keep this sizing regression independent of jsdom's CSS-in-JS cascade.
      render(
        <main className='login-page login-page--entry'>
          <input aria-label='Username' className='login-input ant-input' />
          <span className='login-input login-password-input ant-input-affix-wrapper'>
            <input aria-label='Password' className='ant-input' type='password' />
          </span>
        </main>,
      );
      document.head.appendChild(stylesheet);
      const username = screen.getByLabelText("Username");
      const passwordWrapper = screen.getByLabelText("Password").parentElement!;

      for (const field of [username, passwordWrapper]) {
        const style = window.getComputedStyle(field);
        expect(style.fontSize).toBe("17px");
        expect(style.paddingTop).toBe("16px");
        expect(style.paddingBottom).toBe("16px");
        expect(style.paddingLeft).toBe("20px");
        expect(style.paddingRight).toBe("20px");
      }
    } finally {
      stylesheet.remove();
    }
  });

  it("Login_whenPasswordFieldStylesApply_keepsInnerInputTransparent", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = appStyles.slice(
      appStyles.indexOf("/* Login page */"),
      appStyles.indexOf(".login-page--progress {"),
    );
    try {
      render(
        <main className='login-page login-page--entry'>
          <span className='login-input login-password-input ant-input-affix-wrapper'>
            <input aria-label='Password' className='ant-input' type='password' defaultValue='example-password' />
          </span>
        </main>,
      );
      document.head.appendChild(stylesheet);
      const style = window.getComputedStyle(screen.getByLabelText("Password"));

      expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(style.padding).toBe("0px");
      expect(style.borderTopWidth).toBe("0px");
      expect(style.boxShadow).toBe("none");
    } finally {
      stylesheet.remove();
    }
  });

  it("Login_whenRendered_displaysFreightTagline", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText(/A Smarter way to/).textContent).toBe("A Smarter way toRun LTL Freight.");
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
    expect(accessStorage).toHaveBeenCalled();
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
