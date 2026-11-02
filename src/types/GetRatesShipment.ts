/** Immutable JSON contract accepted by GetRates. */
export type GetRatesShipment = Readonly<{
  /** Freight classification used to select a tariff. */
  class: string;
  /** Freight classification item code, or empty when unavailable. */
  nmfc: string;
  /** Packaging description understood by the rating service. */
  packageType: string;
  /** Description of the freight on this line. */
  description: string;
  /** Freight weight using the existing rating flow convention. */
  weight: number;
  /** Number of handling units on this line. */
  units: number;
  /** Freight volume in cubic feet. */
  cubicFeet: number;
  /** Number of pallets. */
  pallets: number;
  /** Number of individual pieces. */
  pieces: number;
  /** Package length using the existing rating flow convention. */
  length: number;
  /** Package width using the existing rating flow convention. */
  width: number;
  /** Package height using the existing rating flow convention. */
  height: number;
  /** Trailer length occupied by this line in feet. */
  linearFeet: number;
  /** Whether this line contains hazardous freight. */
  hazMat: boolean;
  /** Whether freight can be stacked. */
  stackable: boolean;
}>;
