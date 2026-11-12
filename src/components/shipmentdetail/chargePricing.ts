import { calculateMarkupDistribution } from "../../utils/markupCalculator";

/** Supported CustomerRate markup bases. */
export type ChargeMarkupOption = "Flat" | "% Freight" | "% Freight + Fuel" | "% Freight + Fuel + Accessorial";

/** Unapplied pricing controls; editing these never changes saved charges. */
export type ChargePricingDraft = {
  isMarkupEnabled: boolean;
  markupDropdownOption: ChargeMarkupOption;
  markupRate: string;
  minimum: string;
  isNetSellRateEnabled: boolean;
  netSellRate: string;
};

/** Charge values needed to calculate pricing without changing source rows. */
type PricingLine = {
  code: string;
  description: string;
  buyCost: number | null;
  sellCost: number | null;
};

/** Initial controls used when the client has no markup configuration. */
export const defaultChargePricing: ChargePricingDraft = {
  isMarkupEnabled: false,
  markupDropdownOption: "Flat",
  markupRate: "0",
  minimum: "0",
  isNetSellRateEnabled: false,
  netSellRate: "0",
};

/** Classifies core rows using CustomerRate codes and the detail table's legacy aliases. */
export function chargePricingKind(line: PricingLine) {
  const code = line.code.trim().toUpperCase();
  const description = line.description.trim().toLowerCase();
  if (code === "DSC" || code === "DISC" || description === "discount") return "discount";
  if (code === "FRT" || description === "freight") return "freight";
  if (code === "FSC" || code === "FUEL" || description === "fuel" || description === ".fuel.") return "fuel";
  return "accessorial";
}

/** Adapts signed charge buy amounts to shared pricing while preserving zero allocation behavior. */
function calculateChargeDistribution(lines: readonly PricingLine[], pricing: ChargePricingDraft) {
  let freight = 0;
  let fuel = 0;
  let total = 0;
  for (const line of lines) {
    const buy = line.buyCost ?? 0;
    const kind = chargePricingKind(line);
    if (kind === "freight" || kind === "discount") freight += buy;
    if (kind === "fuel") fuel += buy;
    total += buy;
  }
  const result = calculateMarkupDistribution({
    netFreightBuy: freight,
    fuelBuy: fuel,
    totalBuy: total,
    markupDropdownOption: pricing.markupDropdownOption,
    markupRate: pricing.markupRate,
    minimum: pricing.minimum,
    isMarkupEnabled: pricing.isMarkupEnabled,
    isNetSellRateEnabled: pricing.isNetSellRateEnabled,
    netSellRate: pricing.netSellRate,
    roundMarkupBeforeDistribution: false,
  });
  return !result.isNetSellActive && (freight + fuel <= 0 || result.calculatedMarkup <= 0)
    ? { ...result, ppsFreight: 0, ppsFuel: 0 }
    : result;
}

/** Calculates fixed freight/fuel increments using CustomerRate's minimum and cent rounding rules. */
export function calculateChargeMarkup(lines: readonly PricingLine[], pricing: ChargePricingDraft) {
  const result = calculateChargeDistribution(lines, { ...pricing, isNetSellRateEnabled: false });
  return { freight: result.ppsFreight, fuel: result.ppsFuel };
}

/** Applies sell pricing to snapshots without changing any buy amounts. */
export function applyChargePricing<T extends PricingLine>(
  lines: readonly T[],
  pricing: ChargePricingDraft,
  increments = calculateChargeMarkup(lines, pricing),
): T[] {
  const netSell = pricing.isNetSellRateEnabled ? calculateChargeDistribution(lines, pricing) : null;
  return lines.map((line) => {
    const kind = chargePricingKind(line);
    if (netSell) {
      return {
        ...line,
        sellCost: kind === "freight"
          ? netSell.ppsFreight
          : 0,
      };
    }
    const increment = kind === "freight" ? increments.freight : kind === "fuel" ? increments.fuel : 0;
    return { ...line, sellCost: (line.buyCost ?? 0) + increment };
  });
}

/** Maps the existing client markup response into controls without applying prices. */
export function chargePricingFromConfig(config: { markupType?: unknown; rate?: unknown; minimum?: unknown }): ChargePricingDraft | null {
  if (!config.markupType) return null;
  const raw = String(config.markupType).toLowerCase();
  const netSell = raw.includes("netsell");
  return {
    isMarkupEnabled: !netSell,
    isNetSellRateEnabled: netSell,
    markupDropdownOption: raw.includes("flat") ? "Flat" : raw.includes("acc") ? "% Freight + Fuel + Accessorial" : raw.includes("fuel") ? "% Freight + Fuel" : "% Freight",
    markupRate: String(config.rate ?? 0),
    minimum: String(config.minimum ?? config.rate ?? 0),
    netSellRate: String(config.rate ?? 0),
  };
}
