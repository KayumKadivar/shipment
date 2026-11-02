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

/** Calculates fixed freight/fuel increments using CustomerRate's minimum and cent rounding rules. */
export function calculateChargeMarkup(lines: readonly PricingLine[], pricing: ChargePricingDraft) {
  const amount = Math.max(0, Number(pricing.markupRate) || 0);
  const minimum = Math.max(0, Number(pricing.minimum) || 0);
  const rate = amount > 0 ? amount : minimum;
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
  let markup = 0;
  if (pricing.isMarkupEnabled && rate > 0) {
    const base = pricing.markupDropdownOption === "% Freight" ? freight
      : pricing.markupDropdownOption === "% Freight + Fuel" ? freight + fuel : total;
    markup = pricing.markupDropdownOption === "Flat" ? rate : Math.max(base * rate / 100, minimum);
  }
  const baseTotal = freight + fuel;
  if (markup <= 0 || baseTotal <= 0) return { freight: 0, fuel: 0 };
  const freightPercent = Math.round(freight / baseTotal * 10000) / 100;
  const fuelPercent = Math.round(fuel / baseTotal * 10000) / 100;
  const freightMarkup = Math.round(markup * freightPercent) / 100;
  let fuelMarkup = Math.round(markup * fuelPercent) / 100;
  if (Math.abs(freightMarkup + fuelMarkup - markup) > 0.0001) {
    fuelMarkup = Math.round((markup - freightMarkup) * 100) / 100;
  }
  return { freight: freightMarkup, fuel: fuelMarkup };
}

/** Applies sell pricing to snapshots without changing any buy amounts. */
export function applyChargePricing<T extends PricingLine>(
  lines: readonly T[],
  pricing: ChargePricingDraft,
  increments = calculateChargeMarkup(lines, pricing),
): T[] {
  return lines.map((line) => {
    const kind = chargePricingKind(line);
    if (pricing.isNetSellRateEnabled) {
      return {
        ...line,
        sellCost: kind === "freight"
          ? Math.max(0, Number(pricing.netSellRate) || 0)
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
