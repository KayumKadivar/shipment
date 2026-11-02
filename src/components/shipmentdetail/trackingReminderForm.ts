import dayjs from "dayjs";
import type { ShipmentTrackingReminderData, SaveShipmentTrackingReminderArgs } from "../../store/shipmentTrackingReminderSlice";

/** Editable reminder values; dates are calendar dates and time uses the input's HH:mm format. */
export type ReminderDraft = {
  user: string;
  dateRange: [string, string] | null;
  time: string;
  timezone: string;
};

/** Parses the API's local 12-hour time without applying a timezone conversion. */
export function parseReminderTime(value: string): string {
  const match = /^(0?[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/.exec(value);
  if (match) {
    const hour = Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0);
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }
  return /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : "";
}

/** Formats an HH:mm input as a local hh:mm AM/PM API value. */
export function formatReminderTime(value: string): string {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return "";
  const [hour, minute] = value.split(":");
  return `${String(Number(hour) % 12 || 12).padStart(2, "0")}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;
}

/** Maps a saved reminder into controls while preserving the API's calendar dates. */
export function toReminderDraft(data: ShipmentTrackingReminderData | null): ReminderDraft {
  return {
    user: (data?.email ?? "").split(",").map((email) => email.trim()).join(","),
    dateRange: data ? [data.fromDate.slice(0, 10), data.toDate.slice(0, 10)] : null,
    time: data ? parseReminderTime(data.utcTime) : "",
    timezone: data ? data.timeZone ?? "" : "CT",
  };
}

/** Returns the first invalid reminder field, or null for a complete valid snapshot. */
export function getReminderValidationError(draft: ReminderDraft): string | null {
  if (!draft.user.trim()) return "Enter at least one reminder email.";
  if (draft.user.split(",").some((email) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email.trim()))) {
    return "Enter valid reminder email addresses separated by commas.";
  }
  if (!draft.dateRange) return "Select a start and end date for the reminder.";
  if (draft.dateRange.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !dayjs(date).isValid() || dayjs(date).format("YYYY-MM-DD") !== date)) {
    return "Select valid reminder dates.";
  }
  if (draft.dateRange[1] < draft.dateRange[0]) return "The reminder end date must be on or after the start date.";
  if (!formatReminderTime(draft.time)) return "Select a valid reminder time.";
  if (!["CT", "ET", "MT", "PT"].includes(draft.timezone)) return "Select a supported reminder timezone.";
  return null;
}

/** Serializes validated calendar dates without converting them through the browser's timezone. */
export function toReminderPayload(draft: ReminderDraft, bolNo: string, id: number): SaveShipmentTrackingReminderArgs {
  const error = getReminderValidationError(draft);
  if (error || !draft.dateRange) throw new Error(error || "Select reminder dates.");
  return {
    shipmentTrackingReminderId: id,
    bolNo: bolNo.trim(),
    email: draft.user.split(",").map((email) => email.trim()).join(","),
    fromDate: `${draft.dateRange[0]}T00:00:00`,
    toDate: `${draft.dateRange[1]}T00:00:00`,
    utcTime: formatReminderTime(draft.time),
    timeZone: draft.timezone,
  };
}
