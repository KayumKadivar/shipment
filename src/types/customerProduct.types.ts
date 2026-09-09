export interface CustomerProduct {
  key: string;
  productID?: number;
  description: string;
  isActive: boolean;
  nmfc: string;
  productClass: string;
  commodity: string;
  isHazmat: boolean;
  hazmatContact: string;
  length: number;
  height: number;
  weight: number;
  width: number;
  productGroup: string;
  notes?: string;
  isApproved?: boolean;
}

export type ProductFormValues = Omit<CustomerProduct, "key">;

export type ProductView = "detail" | "group";

export interface ProductGroupSummary {
  key: string;
  productGroup: string;
  total: number;
  active: number;
  inactive: number;
  hazmat: number;
  nonHazmat: number;
}
