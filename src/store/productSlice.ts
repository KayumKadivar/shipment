import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Interface for product item
export interface ProductItem {
  id: string;
  pallets: number | string;
  pieces: number | string;
  packageType: string;
  description: string;
  stackable: boolean;
  hazmat: boolean;
  nmfc: string;
  length: number | string;
  width: number | string;
  height: number | string;
  pcfDensity: number | string;
  class: string;
  weight: number | string;
  hazmatClass?: string;
  hazmatUN?: string;
}

// interface for product state
interface ProductState {
  items: ProductItem[];
  weightUnit: "Lbs" | "Kgs";
}

// Initial state for product
const initialState: ProductState = {
  items: [
    {
      id: "1",
      pallets: "",
      pieces: "",
      packageType: "",
      description: "",
      stackable: false,
      hazmat: false,
      nmfc: "",
      length: "",
      width: "",
      height: "",
      pcfDensity: "",
      class: "",
      weight: "",
    },
  ],
  weightUnit: "Lbs",
};

// slice for managing product state
const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    // add product row
    addProductRow: (state) => {
      state.items.push({
        id: Date.now().toString(),
        pallets: "",
        pieces: "",
        packageType: "",
        description: "",
        stackable: false,
        hazmat: false,
        nmfc: "",
        length: "",
        width: "",
        height: "",
        pcfDensity: "",
        class: "",
        weight: "",
        hazmatClass: "",
        hazmatUN: "",
      });
    },
    // remove product row
    removeProductRow: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    // update product row
    updateProductRow: (
      state,
      action: PayloadAction<{ id: string; field: keyof ProductItem; value: unknown }>
    ) => {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (item) {
        Object.assign(item, { [action.payload.field]: action.payload.value });
      }
    },
    // set weight unit
    setWeightUnit: (state, action: PayloadAction<"Lbs" | "Kgs">) => {
      state.weightUnit = action.payload;
    },
    // set all product items (e.g. prefill from quote)
    setProductItems: (state, action: PayloadAction<ProductItem[]>) => {
      state.items = action.payload;
    },
  },
});

export const { addProductRow, removeProductRow, updateProductRow, setWeightUnit, setProductItems } = productSlice.actions;
export default productSlice.reducer;
