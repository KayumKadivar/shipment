/**
 * Calculates Pounds per Cubic Foot (PCF / Density).
 *
 * Formula:
 * volume = (L * W * H) / 1728
 * If pallet is 0
 *   PCF = weight / volume
 * else
 *   Weight per pallet = weight / pallet
 *   PCF = weight per pallet / volume
 */
export const calculatePCF = (
  length: number | string | undefined | null,
  width: number | string | undefined | null,
  height: number | string | undefined | null,
  weight: number | string | undefined | null,
  pallets: number | string | undefined | null
): string => {
  const l = parseFloat(String(length ?? "").trim());
  const w = parseFloat(String(width ?? "").trim());
  const h = parseFloat(String(height ?? "").trim());
  const wt = parseFloat(String(weight ?? "").trim());
  const p = parseFloat(String(pallets ?? "").trim());

  if (
    isNaN(l) ||
    isNaN(w) ||
    isNaN(h) ||
    isNaN(wt) ||
    l <= 0 ||
    w <= 0 ||
    h <= 0 ||
    wt <= 0
  ) {
    return "";
  }

  const volume = (l * w * h) / 1728;
  if (volume <= 0) return "";

  let pcf: number;
  if (isNaN(p) || p <= 0) {
    pcf = wt / volume;
  } else {
    const weightPerPallet = wt / p;
    pcf = weightPerPallet / volume;
  }

  if (!isFinite(pcf) || isNaN(pcf) || pcf <= 0) return "";

  if (pcf >= 0.01) {
    return pcf.toFixed(2);
  }

  const formatted = pcf.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return parseFloat(formatted) > 0 ? formatted : pcf.toString();
};
