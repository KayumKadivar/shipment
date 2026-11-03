// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSessionRestoreGuard } from "./sessionLifecycle";

/** Listener removers owned by each test to prevent cross-test event handling. */
const cleanupCallbacks: Array<() => void> = [];

afterEach(() => {
  cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
});

describe("browser session restoration", () => {
  it("sessionRestoreGuard_whenPageIsRestored_restartsAtLogin", () => {
    const restart = vi.fn();
    cleanupCallbacks.push(registerSessionRestoreGuard(restart));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    expect(restart).toHaveBeenCalledOnce();
  });

  it("sessionRestoreGuard_whenPageLoadsNormally_doesNotRestart", () => {
    const restart = vi.fn();
    cleanupCallbacks.push(registerSessionRestoreGuard(restart));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    expect(restart).not.toHaveBeenCalled();
  });

  it("sessionRestoreGuard_whenListenerIsRemoved_doesNotRestart", () => {
    const restart = vi.fn();
    const cleanup = registerSessionRestoreGuard(restart);
    cleanup();
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    expect(restart).not.toHaveBeenCalled();
  });
});
