import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./appSlice";

/** Customer selections shared by screens during the current application runtime. */
export interface ClientContextState {
  /** Customer selected for location workflows. */
  customerLocation_selectedClientCode: string | null;
  /** Customer selected for product workflows. */
  customerProduct_selectedClientCode: string | null;
  /** Display name of the customer selected for product workflows. */
  customerProduct_selectedClientName: string | null;
  /** Customer selected for quote workflows. */
  quotes_selectedClientCode: string | null;
}

/** Empty selections used at startup and after logout. */
const initialState: ClientContextState = {
  customerLocation_selectedClientCode: null,
  customerProduct_selectedClientCode: null,
  customerProduct_selectedClientName: null,
  quotes_selectedClientCode: null,
};

/** Stores customer selections without browser persistence. */
const clientContextSlice = createSlice({
  name: "clientContext",
  initialState,
  reducers: {
    /** Sets the customer used by location workflows. */
    setLocationClient(state, action: PayloadAction<string | null>) {
      state.customerLocation_selectedClientCode = action.payload;
    },
    /** Updates the product customer code and display name together. */
    setProductClient(
      state,
      action: PayloadAction<{ clientCode: string | null; clientName: string | null }>,
    ) {
      state.customerProduct_selectedClientCode = action.payload.clientCode;
      state.customerProduct_selectedClientName = action.payload.clientName;
    },
    /** Sets the customer used by quote workflows. */
    setQuoteClient(state, action: PayloadAction<string | null>) {
      state.quotes_selectedClientCode = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
  },
});

export const { setLocationClient, setProductClient, setQuoteClient } = clientContextSlice.actions;
export default clientContextSlice.reducer;
