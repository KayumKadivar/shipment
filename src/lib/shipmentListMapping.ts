import type { ShipmentListItem, ShipmentRecord } from "../types/shipment.types";

const EMPTY_VALUE = "—";

const textOrEmpty = (value: string | null | undefined) => value?.trim() ?? "";

const textOrFallback = (value: string | null | undefined) =>
  textOrEmpty(value) || EMPTY_VALUE;

function joinDistinctLines(values: Array<string | null | undefined>) {
  const lines = values.map(textOrEmpty).filter(Boolean);
  return [...new Set(lines)].join("\n") || EMPTY_VALUE;
}

function formatLocation(
  city: string | null,
  state: string | null,
  postalCode: string | null,
) {
  const cityText = textOrEmpty(city);
  const statePostal = [textOrEmpty(state), textOrEmpty(postalCode)]
    .filter(Boolean)
    .join(" ");

  return [cityText, statePostal].filter(Boolean).join(", ") || EMPTY_VALUE;
}

function formatShipmentDate(value: string | null) {
  const dateText = textOrEmpty(value);
  if (!dateText) return EMPTY_VALUE;

  const datePart = dateText.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return dateText;

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

/** Maps a shipment list response into a table row without changing its identifiers. */
export function mapShipmentListItem(item: ShipmentListItem): ShipmentRecord {
  const loadNumber = textOrFallback(item.bolNo);
  const carrierName = textOrEmpty(item.carrierName);
  const scac = textOrEmpty(item.scac);
  const statusId = Number.isFinite(item.statusId) ? item.statusId : EMPTY_VALUE;

  return {
    key: loadNumber,
    customer: textOrFallback(item.customerName),
    status: textOrEmpty(item.shipmentStatus) || `Status ${statusId}`,
    clientCode: item.clientCode?.trim() || null,
    customerNo: textOrFallback(item.clientCode),
    loadNumber,
    pro: textOrFallback(item.aljexProNumber),
    pickupDate: formatShipmentDate(item.pickupDate),
    delivery: "",
    carrier: carrierName || scac || EMPTY_VALUE,
    carrierNote: carrierName && scac ? scac : "",
    origin: joinDistinctLines([item.originName, item.originAddress1]),
    originMeta: formatLocation(
      item.originCity,
      item.originStateCode,
      item.originZipCode,
    ),
    destination: joinDistinctLines([
      item.destinationName,
      item.destinationAddress1,
    ]),
    destinationMeta: formatLocation(
      item.destinationCity,
      item.destinationStateCode,
      item.destinationZipCode,
    ),
    pallets: Number.isFinite(item.pallets) ? item.pallets : 0,
    weight: Number.isFinite(item.weight)
      ? `${new Intl.NumberFormat("en-US").format(item.weight)} lbs`
      : EMPTY_VALUE,
  };
}

/** Recursively trims API strings while retaining the original response shape. */
export function trimApiStrings<T>(value: T): T {
  if (typeof value === "string") return value.trim() as T;
  if (Array.isArray(value)) return value.map(trimApiStrings) as T;

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimApiStrings(item)]),
    ) as T;
  }

  return value;
}

