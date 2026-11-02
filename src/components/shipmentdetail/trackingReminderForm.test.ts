import { describe, expect, it } from "vitest";
import { formatReminderTime, getReminderValidationError, parseReminderTime, toReminderDraft, toReminderPayload, type ReminderDraft } from "./trackingReminderForm";

const draft: ReminderDraft = {
  user: " first@example.com, second@example.com ", dateRange: ["2026-10-15", "2026-10-24"], time: "07:45", timezone: "CT",
};

describe("trackingReminderForm", () => {
  it.each([["00:00", "12:00 AM"], ["12:00", "12:00 PM"], ["07:45", "07:45 AM"], ["23:59", "11:59 PM"]])(
    "formatReminderTime_whenInputIsValid_preservesWallClockTime (%s)", (input, output) => {
      expect(formatReminderTime(input)).toBe(output);
      expect(parseReminderTime(output)).toBe(input);
    },
  );

  it.each(["", "24:00", "12:60", "bad"])("formatReminderTime_whenInputIsInvalid_returnsEmpty (%s)", (value) => {
    expect(formatReminderTime(value)).toBe("");
  });

  it("toReminderPayload_whenDatesAreSelected_preservesCalendarDatesAndNormalizesEmails", () => {
    expect(toReminderPayload(draft, " BOL-1 ", 6)).toEqual({
      shipmentTrackingReminderId: 6, bolNo: "BOL-1", email: "first@example.com,second@example.com",
      fromDate: "2026-10-15T00:00:00", toDate: "2026-10-24T00:00:00", utcTime: "07:45 AM", timeZone: "CT",
    });
  });

  it.each(["", " ", "bad-email", "a@example.com,", ",a@example.com", "a@example.com,,b@example.com"])(
    "getReminderValidationError_whenRecipientsAreInvalid_returnsEmailError (%s)", (user) => {
      expect(getReminderValidationError({ ...draft, user })).toMatch(/email/i);
    },
  );

  it("getReminderValidationError_whenDateRangeIsMissing_returnsDateError", () => {
    expect(getReminderValidationError({ ...draft, dateRange: null })).toBe("Select a start and end date for the reminder.");
  });

  it("getReminderValidationError_whenDatesAreReversed_returnsDateOrderError", () => {
    expect(getReminderValidationError({ ...draft, dateRange: ["2026-10-24", "2026-10-15"] })).toMatch(/end date/);
  });

  it("getReminderValidationError_whenCalendarDateIsInvalid_returnsDateError", () => {
    expect(getReminderValidationError({ ...draft, dateRange: ["2026-02-31", "2026-10-24"] })).toBe("Select valid reminder dates.");
  });

  it("getReminderValidationError_whenDatesAreSameDay_acceptsInclusiveRange", () => {
    expect(getReminderValidationError({ ...draft, dateRange: ["2026-10-15", "2026-10-15"] })).toBeNull();
  });

  it("getReminderValidationError_whenTimeIsMissing_returnsTimeError", () => {
    expect(getReminderValidationError({ ...draft, time: "" })).toMatch(/time/);
  });

  it("getReminderValidationError_whenTimezoneIsUnsupported_returnsTimezoneError", () => {
    expect(getReminderValidationError({ ...draft, timezone: "UTC" })).toMatch(/timezone/);
  });

  it("toReminderDraft_whenNoReminderExists_returnsEmptyFormWithCtTimezone", () => {
    expect(toReminderDraft(null)).toEqual({ user: "", dateRange: null, time: "", timezone: "CT" });
  });

  it("toReminderPayload_whenDraftIsInvalid_throwsBeforeSerialization", () => {
    expect(() => toReminderPayload({ ...draft, user: "" }, "BOL-1", 0)).toThrow("Enter at least one reminder email.");
  });
});
