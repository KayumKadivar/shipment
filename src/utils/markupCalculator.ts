export interface BaseCarrierRate {
  id: string;
  name?: string;
  code?: string;
  service?: string;
  price: number;
  grossCharge?: number;
  grossSellAmount?: number;
  discount?: number;
  fuelSurcharge?: number;
  sellPrice?: number;
  grossSell?: number;
  fuelSell?: number;
  discountSell?: number;
  markupAmount?: number;
  ppsFreight?: number;
  ppsFuel?: number;
  isNetSellActive?: boolean;
  [key: string]: any;
}

export interface AppliedMarkupConfig {
  isMarkupEnabled: boolean;
  markupDropdownOption: string;
  numericMarkup: number;
  numericMarkupRate: number;
  isNetSellRateEnabled: boolean;
  numericNetSellRate: number;
  ppsFreight?: number;
  ppsFuel?: number;
  targetCarrierFilter?: string;
}

export interface MarkupDistributionParams {
  netFreightBuy: number;
  fuelBuy: number;
  totalBuy: number;
  markupDropdownOption: string;
  markupRate: number | string;
  minimum?: number | string;
  isMarkupEnabled: boolean;
  isNetSellRateEnabled: boolean;
  netSellRate?: number | string;
}

export interface MarkupDistributionResult {
  calculatedMarkup: number;
  ppsFreight: number;
  ppsFuel: number;
  isNetSellActive: boolean;
}

/**
 * Calculates markup amount and proportional distribution between Freight and Fuel
 * Supports: Flat, % Freight, % Freight + Fuel, % Freight + Fuel + Accessorial, and Net Sell Rate.
 */
export function calculateMarkupDistribution({
  netFreightBuy,
  fuelBuy,
  totalBuy,
  markupDropdownOption,
  markupRate,
  minimum = 0,
  isMarkupEnabled,
  isNetSellRateEnabled,
  netSellRate = 0,
}: MarkupDistributionParams): MarkupDistributionResult {
  const numRate = Math.max(0, Number(markupRate) || 0);
  const numMin = Math.max(0, Number(minimum) || 0);
  const numNetSell = Math.max(0, Number(netSellRate) || 0);

  if (isNetSellRateEnabled) {
    return {
      calculatedMarkup: numNetSell - totalBuy,
      ppsFreight: numNetSell,
      ppsFuel: 0,
      isNetSellActive: true,
    };
  }

  if (isMarkupEnabled && (numRate > 0 || numMin > 0)) {
    const rateToUse = numRate > 0 ? numRate : numMin;
    let calculatedMarkup = 0;

    if (markupDropdownOption === "Flat") {
      calculatedMarkup = rateToUse;
    } else if (markupDropdownOption === "% Freight") {
      calculatedMarkup = netFreightBuy * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    } else if (markupDropdownOption === "% Freight + Fuel") {
      calculatedMarkup = (netFreightBuy + fuelBuy) * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    } else if (markupDropdownOption === "% Freight + Fuel + Accessorial") {
      calculatedMarkup = totalBuy * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    }

    const totalMarkupToDistribute = Math.round(calculatedMarkup * 100) / 100;
    const baseTotal = netFreightBuy + fuelBuy;

    let ppsFreight = 0;
    let ppsFuel = 0;

    if (totalMarkupToDistribute > 0 && baseTotal > 0) {
      const freightPercent = Math.round((netFreightBuy / baseTotal) * 10000) / 100;
      const fuelPercent = Math.round((fuelBuy / baseTotal) * 10000) / 100;

      ppsFreight = Math.round(((totalMarkupToDistribute * freightPercent) / 100) * 100) / 100;
      ppsFuel = Math.round(((totalMarkupToDistribute * fuelPercent) / 100) * 100) / 100;

      if (Math.abs(ppsFreight + ppsFuel - totalMarkupToDistribute) > 0.0001) {
        ppsFuel = Math.round((totalMarkupToDistribute - ppsFreight) * 100) / 100;
      }
    } else {
      ppsFreight = totalMarkupToDistribute;
      ppsFuel = 0;
    }

    return {
      calculatedMarkup: totalMarkupToDistribute,
      ppsFreight,
      ppsFuel,
      isNetSellActive: false,
    };
  }

  return {
    calculatedMarkup: 0,
    ppsFreight: 0,
    ppsFuel: 0,
    isNetSellActive: false,
  };
}

/**
 * Applies calculated markup configuration to a CarrierRate item.
 */
export function applyMarkupToRate<T extends BaseCarrierRate>(
  rate: T,
  config: AppliedMarkupConfig
): T {
  if (config.targetCarrierFilter) {
    const filter = config.targetCarrierFilter.trim().toLowerCase();
    const isMatch = [rate.name, rate.code, rate.service].some((value) =>
      (value || "").toLowerCase().includes(filter)
    );
    if (!isMatch) {
      const defaultGrossSell =
        rate.grossSell !== undefined && rate.grossSell !== null
          ? rate.grossSell
          : rate.grossSellAmount != null
            ? rate.grossSellAmount
            : rate.grossCharge;
      const existingMarkup =
        defaultGrossSell != null ? (defaultGrossSell - (rate.grossCharge ?? 0)) : 0;
      const defaultSellPrice = rate.sellPrice !== undefined ? rate.sellPrice : (rate.price + existingMarkup);
      return {
        ...rate,
        sellPrice: defaultSellPrice,
        grossSell: defaultGrossSell,
        fuelSell: rate.fuelSell ?? rate.fuelSurcharge,
        discountSell: rate.discountSell ?? rate.discount,
        markupAmount: existingMarkup,
        ppsFreight: existingMarkup,
        ppsFuel: 0,
        isNetSellActive: false,
      };
    }
  }

  const grossBuy = Number(rate.grossCharge) || 0;
  const fuelBuy = Number(rate.fuelSurcharge) || 0;
  const discountBuy = Number(rate.discount) || 0;
  const netFreightBuy = Math.max(0, grossBuy - discountBuy);
  const totalAccessorialsBuy = Array.isArray(rate.accessorialCharges)
    ? rate.accessorialCharges.reduce((acc: number, c: any) => acc + (Number(c.accessorialCharge ?? c.amount) || 0), 0)
    : 0;
  const totalAccessorialsSell = Array.isArray(rate.accessorialCharges)
    ? rate.accessorialCharges.reduce((acc: number, c: any) => acc + (Number(c.sellCharge ?? c.accessorialCharge ?? c.amount) || 0), 0)
    : totalAccessorialsBuy;
  const computedBuy = Math.round((netFreightBuy + fuelBuy + totalAccessorialsBuy) * 100) / 100;
  const totalBuy = Math.max(Number(rate.price) || 0, computedBuy);

  const { calculatedMarkup, ppsFreight, ppsFuel, isNetSellActive } = calculateMarkupDistribution({
    netFreightBuy,
    fuelBuy,
    totalBuy,
    markupDropdownOption: config.markupDropdownOption,
    markupRate: config.numericMarkupRate,
    minimum: config.numericMarkup,
    isMarkupEnabled: config.isMarkupEnabled,
    isNetSellRateEnabled: config.isNetSellRateEnabled,
    netSellRate: config.numericNetSellRate,
  });

  if (isNetSellActive) {
    const finalPrice = Math.max(0, config.numericNetSellRate || 0);
    return {
      ...rate,
      sellPrice: finalPrice,
      grossSell: ppsFreight,
      fuelSell: 0,
      discountSell: 0,
      markupAmount: finalPrice - totalBuy,
      ppsFreight,
      ppsFuel,
      isNetSellActive: true,
    };
  }

  if (config.isMarkupEnabled && (config.numericMarkupRate > 0 || config.numericMarkup > 0)) {
    const grossSell = Math.round((grossBuy + ppsFreight) * 100) / 100;
    const fuelSell = Math.round((fuelBuy + ppsFuel) * 100) / 100;
    const sellPrice = Math.round((totalBuy + calculatedMarkup) * 100) / 100;

    return {
      ...rate,
      sellPrice,
      grossSell,
      fuelSell,
      discountSell: discountBuy,
      markupAmount: calculatedMarkup,
      ppsFreight,
      ppsFuel,
      isNetSellActive: false,
    };
  }

  const defaultGrossSell =
    rate.grossSell !== undefined && rate.grossSell !== null
      ? rate.grossSell
      : rate.grossSellAmount != null
        ? rate.grossSellAmount
        : rate.grossCharge;
  const existingMarkup =
    defaultGrossSell != null ? (defaultGrossSell - (rate.grossCharge ?? 0)) : 0;
  const defaultSellPrice =
    rate.sellPrice !== undefined
      ? rate.sellPrice
      : (rate.grossSell != null || rate.grossSellAmount != null)
        ? Math.round(((Number(defaultGrossSell) - discountBuy) + (rate.fuelSell ?? fuelBuy) + totalAccessorialsSell) * 100) / 100
        : (rate.price + existingMarkup);

  return {
    ...rate,
    sellPrice: defaultSellPrice,
    grossSell: defaultGrossSell,
    fuelSell: rate.fuelSell ?? rate.fuelSurcharge,
    discountSell: rate.discountSell ?? rate.discount,
    markupAmount: existingMarkup,
    ppsFreight: existingMarkup,
    ppsFuel: 0,
    isNetSellActive: false,
  };
}

