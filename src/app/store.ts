import { configureStore } from "@reduxjs/toolkit";
import appReducer from "../store/appSlice.ts";
import productReducer from "../store/productSlice.ts";
import accessorialsReducer from "../store/accessorialsSlice.ts";
import customerRateReducer from "../store/customerRateSlice.ts";
import customerLocationReducer from "../store/customerLocationSlice.ts";

export const store = configureStore({
  reducer: {
    app: appReducer,
    product: productReducer,
    accessorials: accessorialsReducer,
    customerRate: customerRateReducer,
    customerLocation: customerLocationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
