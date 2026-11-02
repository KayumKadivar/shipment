// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentDetails } from "../../types/shipment.types";
import Tracking from "./Tracking";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import carrierTrackingReducer from "../../store/carrierTrackingSlice";
import shipmentTrackingNotificationReducer from "../../store/shipmentTrackingNotificationSlice";
import axios from "axios";
import dayjs from "dayjs";
import shipmentTrackingReminderReducer from "../../store/shipmentTrackingReminderSlice";

const { notificationGet, reminderGet } = vi.hoisted(() => ({ notificationGet: vi.fn(), reminderGet: vi.fn() }));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, DatePicker: { ...actual.DatePicker, RangePicker: ({ value, onChange, disabled }: {
    value: [dayjs.Dayjs, dayjs.Dayjs] | null;
    onChange: (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
    disabled: boolean;
  }) => <>
    <input aria-label="Reminder start date" disabled={disabled} value={value?.[0]?.format("YYYY-MM-DD") ?? ""}
      onChange={(event) => onChange([dayjs(event.target.value), value?.[1] ?? dayjs(event.target.value)])} />
    <input aria-label="Reminder end date" disabled={disabled} value={value?.[1]?.format("YYYY-MM-DD") ?? ""}
      onChange={(event) => onChange([value?.[0] ?? dayjs(event.target.value), dayjs(event.target.value)])} />
  </> } };
});
import { API_BASE_URL } from "../../config/apiConfig";

vi.mock("axios", () => ({
  default: {
    get: vi.fn((url: string, ...args: unknown[]) => url.includes("/ShipmentTrackingReminder/") ? reminderGet(url, ...args) : notificationGet(url, ...args)),
    post: vi.fn(),
    put: vi.fn(),
    isAxiosError: vi.fn(() => false),
    interceptors: { request: { use: vi.fn() } },
  },
}));

const savedReminder = {
  shipmentTrackingReminderId: 6,
  bolNo: "LOAD-100",
  email: "first@example.com,second@example.com",
  fromDate: "2026-10-15T00:00:00",
  toDate: "2026-10-24T00:00:00",
  utcTime: "07:45 AM",
  timeZone: "CT",
};

/** Waits for the reminder lookup to finish rendering. */
async function waitForReminderAsync() {
  await waitFor(() => expect(screen.queryByText("Loading tracking reminder...")).toBeNull());
}

/** Selects every time component through the real Ant Design popup. */
async function selectReminderTimeAsync() {
  const input = screen.getByLabelText("Reminder time");
  fireEvent.mouseDown(input);
  fireEvent.focus(input);
  fireEvent.click(input);
  for (const [type, value] of [["meridiem", "am"], ["hour", "7"], ["minute", "45"]]) {
    const selector = `.ant-picker-time-panel-column[data-type="${type}"] li[data-value="${value}"]`;
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    fireEvent.click(document.querySelector(selector)!);
  }
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  fireEvent.blur(input);
}

const preferences = {
  shipmentTrackingNotificationId: 1,
  bolNo: "LOAD-100",
  email: " first@example.com, second@example.com ",
  isNotifyOnPickupRequest: true,
  isNotifyOnInTransit: true,
  isNotifyOnOutForDelivery: true,
  isNotifyOnDelivered: true,
};

/** Renders the notification card for the requested shipment. */
function renderTracking(currentShipment = shipment) {
  const store = configureStore({ reducer: {
    carrierTracking: carrierTrackingReducer,
    shipmentTrackingNotification: shipmentTrackingNotificationReducer,
    shipmentTrackingReminder: shipmentTrackingReminderReducer,
  } });
  return render(
    <Tracking shipment={currentShipment} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />,
    { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> },
  );
}

/** Resolves after the preferences request has finished rendering. */
async function waitForPreferencesAsync() {
  await waitFor(() => expect(screen.queryByText("Loading notification preferences...")).toBeNull());
}


const shipment = {
  loadNumber: "LOAD-100",
  clientCode: "CLIENT",
  userName: "Test User",
} as ShipmentDetails;

describe("Tracking", () => {
  beforeEach(() => {
    notificationGet.mockReset();
    reminderGet.mockReset();
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: null } });
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.put).mockReset();
    vi.mocked(axios.post).mockResolvedValue({ data: { isSuccess: true, data: preferences } });
    vi.mocked(axios.put).mockResolvedValue({ data: { isSuccess: true, data: preferences } });
    notificationGet.mockResolvedValue({ data: { isSuccess: true, message: "", data: preferences } });
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("Tracking_whenPreferencesLoad_displaysCommaSeparatedEmails", async () => {
    renderTracking({ ...shipment, loadNumber: " LOAD-100  " });
    await waitForPreferencesAsync();
    const input = screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement;
    expect(input.value).toBe("first@example.com,second@example.com");
    expect(input.readOnly).toBe(false);
    expect((screen.getByRole("checkbox", { name: "Email" }) as HTMLInputElement).checked).toBe(true);
    expect(notificationGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/ShipmentTrackingNotification/GetShipmentTrackingNotificationByBolNo`,
      expect.objectContaining({ params: { bolNo: "LOAD-100" }, headers: { Accept: "text/plain" }, signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    ["isNotifyOnPickupRequest", "PickupRequest"],
    ["isNotifyOnInTransit", "InTransit"],
    ["isNotifyOnOutForDelivery", "OutForDelivery"],
    ["isNotifyOnDelivered", "Delivered"],
  ])("Tracking_whenEventFlagIsTrue_checksMatchingCheckbox (%s)", async (field, label) => {
    notificationGet.mockResolvedValue({ data: { isSuccess: true, data: {
      ...preferences,
      isNotifyOnPickupRequest: false,
      isNotifyOnInTransit: false,
      isNotifyOnOutForDelivery: false,
      isNotifyOnDelivered: false,
      [field]: true,
    } } });
    renderTracking();
    await waitForPreferencesAsync();
    expect((screen.getByRole("checkbox", { name: label }) as HTMLInputElement).checked).toBe(true);
    for (const otherLabel of ["PickupRequest", "InTransit", "OutForDelivery", "Delivered"].filter((value) => value !== label)) {
      expect((screen.getByRole("checkbox", { name: otherLabel }) as HTMLInputElement).checked).toBe(false);
    }
  });

  it.each([false, null])("Tracking_whenEventFlagIsFalseOrNull_leavesMatchingCheckboxUnchecked (%s)", async (value) => {
    notificationGet.mockResolvedValue({ data: { isSuccess: true, data: {
      ...preferences,
      isNotifyOnPickupRequest: value,
      isNotifyOnInTransit: value,
      isNotifyOnOutForDelivery: value,
      isNotifyOnDelivered: value,
    } } });
    renderTracking();
    await waitForPreferencesAsync();
    for (const label of ["PickupRequest", "InTransit", "OutForDelivery", "Delivered"]) {
      expect((screen.getByRole("checkbox", { name: label }) as HTMLInputElement).checked).toBe(false);
    }
  });

  it("Tracking_whenPreferencesAreMissing_displaysEmptyPreferences", async () => {
    notificationGet.mockResolvedValue({ data: { isSuccess: true, data: null } });
    renderTracking();
    await waitForPreferencesAsync();
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("");
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    }
  });

  it.each(["network", "envelope"])("Tracking_whenLookupFails_displaysRetry (%s)", async (failure) => {
    if (failure === "network") notificationGet.mockRejectedValueOnce(new Error("Lookup failed"));
    else notificationGet.mockResolvedValueOnce({ data: { isSuccess: false, message: "Lookup failed", data: null } });
    renderTracking();
    await waitForPreferencesAsync();
    expect(screen.getByText("Lookup failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("first@example.com,second@example.com"));
    expect(screen.queryByText("Lookup failed")).toBeNull();
  });

  it("Tracking_whenShipmentChanges_ignoresPreviousResponse", async () => {
    let resolvePrevious!: (response: unknown) => void;
    notificationGet.mockImplementationOnce(() => new Promise((resolve) => { resolvePrevious = resolve; }));
    const { rerender } = renderTracking();
    const previousSignal = notificationGet.mock.calls[0][1]?.signal;
    rerender(<Tracking shipment={{ ...shipment, loadNumber: "LOAD-200" }} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />);
    await waitForPreferencesAsync();
    expect(previousSignal?.aborted).toBe(true);
    await act(async () => { resolvePrevious({ data: { isSuccess: true, data: { ...preferences, email: "stale@example.com" } } }); });
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("first@example.com,second@example.com");
  });

  it("Tracking_whenUnmounted_cancelsPreferencesRequest", async () => {
    const { unmount } = renderTracking();
    await waitForPreferencesAsync();
    const signal = notificationGet.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("Tracking_whenCreateNotificationIsDisplayed_keepsButtonEnabled", async () => {
    notificationGet.mockResolvedValue({ data: { isSuccess: true, data: null } });
    renderTracking();
    await waitForPreferencesAsync();
    expect((screen.getByRole("button", { name: "Create Notification" }) as HTMLButtonElement).disabled).toBe(false);
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect((checkbox as HTMLInputElement).disabled).toBe(false);
    }
  });
  it.each(["Email", "PickupRequest", "InTransit", "OutForDelivery", "Delivered"])(
    "Tracking_whenCheckboxIsClicked_togglesOnlyThatPreference (%s)",
    async (label) => {
      renderTracking();
      await waitForPreferencesAsync();
      const checkbox = screen.getByRole("checkbox", { name: label }) as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
      for (const other of screen.getAllByRole("checkbox").filter((value) => value !== checkbox)) {
        expect((other as HTMLInputElement).checked).toBe(true);
      }
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      expect(notificationGet).toHaveBeenCalledTimes(1);
    },
  );

  it("Tracking_whenShipmentChanges_doesNotReuseCheckboxEdits", async () => {
    const { rerender } = renderTracking();
    await waitForPreferencesAsync();
    fireEvent.click(screen.getByRole("checkbox", { name: "Delivered" }));
    rerender(<Tracking shipment={{ ...shipment, loadNumber: "LOAD-200" }} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />);
    await waitForPreferencesAsync();
    expect((screen.getByRole("checkbox", { name: "Delivered" }) as HTMLInputElement).checked).toBe(true);
  });

  it("Tracking_whenNewNotificationIsSaved_postsEditedRecipientsAndEventFlags", async () => {
    notificationGet.mockResolvedValue({ data: { isSuccess: true, data: null } });
    renderTracking();
    await waitForPreferencesAsync();
    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notification emails" }), { target: { value: " first@example.com, second@example.com " } });
    fireEvent.click(screen.getByRole("checkbox", { name: "PickupRequest" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Notification" }));
    await screen.findByText("Notification created.");
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingNotification/AddShipmentTrackingNotification`, {
      shipmentTrackingNotificationId: 0, bolNo: "LOAD-100", email: "first@example.com,second@example.com",
      isNotifyOnPickupRequest: true, isNotifyOnInTransit: false, isNotifyOnOutForDelivery: false, isNotifyOnDelivered: false,
    }, expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    await screen.findByText("Notification updated.");
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("UpdateShipmentTrackingNotification"), expect.objectContaining({ shipmentTrackingNotificationId: 1 }), expect.any(Object));
  });

  it("Tracking_whenExistingNotificationIsSaved_putsTheReturnedRecordId", async () => {
    renderTracking();
    await waitForPreferencesAsync();
    fireEvent.click(screen.getByRole("checkbox", { name: "Delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    await screen.findByText("Notification updated.");
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("UpdateShipmentTrackingNotification"), expect.objectContaining({ shipmentTrackingNotificationId: 1, isNotifyOnDelivered: false }), expect.any(Object));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("Tracking_whenEmailMethodIsUnchecked_displaysValidationWithoutSaving", async () => {
    renderTracking();
    await waitForPreferencesAsync();
    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    expect(screen.getByText("Select the Email notification method.")).toBeTruthy();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "bad-email", "a@example.com,", ",a@example.com", "a@example.com,,b@example.com", "a b@example.com"])(
    "Tracking_whenRecipientIsInvalid_displaysValidationWithoutSaving (%s)", async (email) => {
      renderTracking();
      await waitForPreferencesAsync();
      fireEvent.change(screen.getByRole("textbox", { name: "Notification emails" }), { target: { value: email } });
      fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(axios.put).not.toHaveBeenCalled();
    },
  );

  it("Tracking_whenSaveFails_preservesTheDraft", async () => {
    vi.mocked(axios.put).mockRejectedValueOnce(new Error("Save failed"));
    renderTracking();
    await waitForPreferencesAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Notification emails" }), { target: { value: "changed@example.com" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    await screen.findByText("Save failed");
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("changed@example.com");
    expect((screen.getByRole("checkbox", { name: "Delivered" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("button", { name: "Update Notification" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Tracking_whenSaveSucceeds_displaysTheReturnedPreferences", async () => {
    vi.mocked(axios.put).mockResolvedValueOnce({ data: { isSuccess: true, data: { ...preferences, email: "server@example.com", isNotifyOnDelivered: false } } });
    renderTracking();
    await waitForPreferencesAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Notification emails" }), { target: { value: "draft@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    await screen.findByText("Notification updated.");
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("server@example.com");
    expect((screen.getByRole("checkbox", { name: "Delivered" }) as HTMLInputElement).checked).toBe(false);
  });

  it("Tracking_whenSaveIsPending_preventsDuplicateSubmission", async () => {
    let resolveSave!: (response: unknown) => void;
    vi.mocked(axios.put).mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderTracking();
    await waitForPreferencesAsync();
    const button = screen.getByRole("button", { name: "Update Notification" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).disabled).toBe(true);
    for (const checkbox of screen.getAllByRole("checkbox")) expect((checkbox as HTMLInputElement).disabled).toBe(true);
    await act(async () => resolveSave({ data: { isSuccess: true, data: preferences } }));
  });

  it("Tracking_whenLookupFails_disablesSaving", async () => {
    notificationGet.mockRejectedValueOnce(new Error("Lookup failed"));
    renderTracking();
    await waitForPreferencesAsync();
    expect((screen.getByRole("button", { name: "Create Notification" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Tracking_whenShipmentChangesDuringSave_ignoresPreviousSaveResult", async () => {
    let resolveSave!: (response: unknown) => void;
    vi.mocked(axios.put).mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const { rerender } = renderTracking();
    await waitForPreferencesAsync();
    fireEvent.click(screen.getByRole("button", { name: "Update Notification" }));
    rerender(<Tracking shipment={{ ...shipment, loadNumber: "LOAD-200" }} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />);
    await waitForPreferencesAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Notification emails" }), { target: { value: "new-draft@example.com" } });
    await act(async () => resolveSave({ data: { isSuccess: true, data: { ...preferences, email: "old-save@example.com" } } }));
    expect((screen.getByRole("textbox", { name: "Notification emails" }) as HTMLInputElement).value).toBe("new-draft@example.com");
    expect(screen.queryByText("Notification updated.")).toBeNull();
  });

  it.each([
    { scenario: "saved", data: savedReminder },
    { scenario: "missing", data: null },
  ])("Tracking_whenReminderIs$scenario_showsOnlyReminderForm", async ({ data }) => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data } });
    renderTracking();
    await waitForReminderAsync();

    expect(document.querySelector(".shipment-reminder-list-card")).toBeNull();
    expect(screen.getAllByRole("heading", { name: "Tracking Reminder" })).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Reminder emails" })).toBeTruthy();
  });

  it("Tracking_whenReminderLoads_populatesRecipientEmails", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    renderTracking();
    await waitForReminderAsync();
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("first@example.com,second@example.com");
    expect(reminderGet).toHaveBeenCalledWith(expect.stringContaining("/ShipmentTrackingReminder/GetByBolNo"), expect.objectContaining({ params: { bolNo: "LOAD-100" }, signal: expect.any(AbortSignal) }));
  });

  it("Tracking_whenReminderLoads_populatesDateRange", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    renderTracking();
    await waitForReminderAsync();
    expect((screen.getByRole("textbox", { name: "Reminder start date" }) as HTMLInputElement).value).toBe("2026-10-15");
    expect((screen.getByRole("textbox", { name: "Reminder end date" }) as HTMLInputElement).value).toBe("2026-10-24");
  });

  it("Tracking_whenReminderLoads_populatesLocalTimeAndTimezone", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    renderTracking();
    await waitForReminderAsync();
    await waitFor(() => expect((screen.getByLabelText("Reminder time") as HTMLInputElement).value).toBe("07:45 AM"));
    expect(screen.getByText("CT")).toBeTruthy();
  });

  it("Tracking_whenReminderIsMissing_showsEmptyFormAndList", async () => {
    renderTracking();
    await waitForReminderAsync();
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("No Tracking Reminders have been added yet.")).toBeNull();
  });

  it("Tracking_whenReminderIsCreated_postsZeroId", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { isSuccess: true, data: savedReminder } });
    renderTracking();
    await waitForReminderAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder emails" }), { target: { value: " first@example.com, second@example.com " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder start date" }), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder end date" }), { target: { value: "2026-10-24" } });
    await selectReminderTimeAsync();
    fireEvent.click(screen.getByRole("button", { name: "Create Reminder" }));
    await screen.findByText("Reminder created.");
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingReminder`, { ...savedReminder, shipmentTrackingReminderId: 0 }, expect.any(Object));
    expect(screen.getByRole("button", { name: "Update Reminder" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("first@example.com,second@example.com");
  });

  it("Tracking_whenReminderIsUpdated_preservesSavedId", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    vi.mocked(axios.put).mockResolvedValueOnce({ data: { isSuccess: true, data: { ...savedReminder, email: "changed@example.com" } } });
    renderTracking();
    await waitForReminderAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder emails" }), { target: { value: "changed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Reminder" }));
    await screen.findByText("Reminder updated.");
    expect(axios.put).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingReminder`, { ...savedReminder, email: "changed@example.com" }, expect.any(Object));
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("changed@example.com");
  });

  it("Tracking_whenReminderSaveFails_preservesDraft", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    vi.mocked(axios.put).mockRejectedValueOnce(new Error("Reminder rejected"));
    renderTracking();
    await waitForReminderAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder emails" }), { target: { value: "changed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Reminder" }));
    await screen.findByText("Reminder rejected");
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("changed@example.com");
  });

  it("Tracking_whenReminderLookupFails_offersRetryAndPreventsSave", async () => {
    reminderGet.mockRejectedValueOnce(new Error("Reminder lookup failed"));
    renderTracking();
    await waitForReminderAsync();
    expect((screen.getByRole("button", { name: "Create Reminder" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry reminder" }));
    await waitFor(() => expect(screen.queryByText("Reminder lookup failed")).toBeNull());
    expect((screen.getByRole("button", { name: "Create Reminder" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Tracking_whenShipmentChanges_ignoresPreviousReminderResult", async () => {
    let resolvePrevious!: (value: unknown) => void;
    reminderGet.mockImplementationOnce(() => new Promise((resolve) => { resolvePrevious = resolve; }));
    const { rerender } = renderTracking();
    const signal = reminderGet.mock.calls[0][1].signal;
    rerender(<Tracking shipment={{ ...shipment, loadNumber: "LOAD-200" }} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />);
    await waitForReminderAsync();
    await act(async () => resolvePrevious({ data: { isSuccess: true, data: savedReminder } }));
    expect(signal.aborted).toBe(true);
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("");
  });

  it("Tracking_whenReminderSaveIsPending_preventsDuplicateSave", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    let resolveSave!: (value: unknown) => void;
    vi.mocked(axios.put).mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderTracking();
    await waitForReminderAsync();
    const button = screen.getByRole("button", { name: "Update Reminder" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("textbox", { name: "Reminder start date" }) as HTMLInputElement).disabled).toBe(true);
    await act(async () => resolveSave({ data: { isSuccess: true, data: savedReminder } }));
  });

  it("Tracking_whenReminderRecipientsAreInvalid_preventsSubmission", async () => {
    renderTracking();
    await waitForReminderAsync();
    fireEvent.click(screen.getByRole("button", { name: "Create Reminder" }));
    expect(screen.getByText("Enter at least one reminder email.")).toBeTruthy();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("Tracking_whenShipmentChangesDuringReminderSave_preservesNewDraft", async () => {
    reminderGet.mockResolvedValue({ data: { isSuccess: true, data: savedReminder } });
    let resolveSave!: (value: unknown) => void;
    vi.mocked(axios.put).mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const { rerender } = renderTracking();
    await waitForReminderAsync();
    fireEvent.click(screen.getByRole("button", { name: "Update Reminder" }));
    rerender(<Tracking shipment={{ ...shipment, loadNumber: "LOAD-200" }} onChangeCommitted={vi.fn()} onEditorStateChange={vi.fn()} />);
    await waitForReminderAsync();
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder emails" }), { target: { value: "new-draft@example.com" } });
    await act(async () => resolveSave({ data: { isSuccess: true, data: { ...savedReminder, email: "old-save@example.com" } } }));
    expect((screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement).value).toBe("new-draft@example.com");
    expect(screen.queryByText("Reminder updated.")).toBeNull();
  });

  it("Tracking_whenReminderTimePickerIsUsed_displaysSelectedTime", async () => {
    renderTracking();
    await waitForReminderAsync();
    await selectReminderTimeAsync();
    await waitFor(() => expect((screen.getByLabelText("Reminder time") as HTMLInputElement).value).toBe("07:45 AM"));
  });

  it("Tracking_whenMultipleReminderEmailsAreEntered_retainsCommaSeparatedRecipients", async () => {
    renderTracking();
    await waitForReminderAsync();
    const input = screen.getByRole("textbox", { name: "Reminder emails" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "one@example.com,two@example.com,three@example.com" } });
    expect(input.value).toBe("one@example.com,two@example.com,three@example.com");
    expect(screen.getByText("Separate multiple email addresses with commas.")).toBeTruthy();
  });

});
