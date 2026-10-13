import type {
  ShipmentAccessorialCostDetail,
  ShipmentDetails,
} from "../../types/shipment.types";

export type AggregatedAccessorialCharge = {
  key: string;
  code: string;
  description: string;
  buyCost: number | null;
  sellCost: number | null;
};

type ChargeSide = "buyCost" | "sellCost";

const cleanText = (value: string | null | undefined) => value?.trim() ?? "";

function accessorialKey(code: string, description: string) {
  return `${code.toLocaleLowerCase()}::${description.toLocaleLowerCase()}`;
}

function detailAmount(detail: ShipmentAccessorialCostDetail) {
  const amount = detail.billedCost ?? detail.ratedCost;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function formatAccessorialLabel(code: string, description: string) {
  if (code && description) {
    return code.toLocaleLowerCase() === description.toLocaleLowerCase()
      ? description
      : `${description} (${code})`;
  }

  return description || code;
}

export function aggregateAccessorialCharges(
  shipment: ShipmentDetails,
): AggregatedAccessorialCharge[] {
  const grouped = new Map<string, AggregatedAccessorialCharge>();

  const addDetails = (
    details: ShipmentAccessorialCostDetail[] | null | undefined,
    side: ChargeSide,
  ) => {
    details?.forEach((detail) => {
      const code = cleanText(detail.accCode);
      const description = cleanText(detail.description);
      if (!code && !description) return;

      const key = accessorialKey(code, description);
      const current = grouped.get(key) ?? {
        key,
        code,
        description,
        buyCost: null,
        sellCost: null,
      };
      const amount = detailAmount(detail);

      if (amount !== null) {
        current[side] = (current[side] ?? 0) + amount;
      }

      grouped.set(key, current);
    });
  };

  addDetails(shipment.buyRate?.accesorialCostDetails, "buyCost");
  addDetails(shipment.sellRate?.accesorialCostDetails, "sellCost");

  return [...grouped.values()];
}

export function createShipmentAccessorialLabels(shipment: ShipmentDetails) {
  const uniqueTopLevelLabels = new Map<string, string>();
  shipment.accessorials?.forEach((accessorial) => {
    if (typeof accessorial !== "string") return;

    const label = accessorial.trim();
    if (!label) return;

    const normalizedLabel = label.toLocaleLowerCase();
    if (!uniqueTopLevelLabels.has(normalizedLabel)) {
      uniqueTopLevelLabels.set(normalizedLabel, label);
    }
  });
  const topLevelLabels = [...uniqueTopLevelLabels.values()];

  if (topLevelLabels.length) return topLevelLabels;

  return aggregateAccessorialCharges(shipment).map(({ code, description }) =>
    formatAccessorialLabel(code, description),
  );
}
