import { configureStore } from "@reduxjs/toolkit";
import appReducer from "../store/appSlice.ts";
import productReducer from "../store/productSlice.ts";
import accessorialsReducer from "../store/accessorialsSlice.ts";
import chargeAccessorialsReducer from "../store/chargeAccessorialsSlice.ts";
import customerRateReducer from "../store/customerRateSlice.ts";
import customerLocationReducer from "../store/customerLocationSlice.ts";
import customerProductReducer from "../store/customerProductSlice.ts";
import carrierTrackingReducer from "../store/carrierTrackingSlice.ts";
import shipmentReducer from "../store/shipmentSlice.ts";
import quoteReducer from "../store/quoteSlice.ts";
import packageTypesReducer from "../store/packageTypesSlice.ts";

export const store = configureStore({
  reducer: {
    app: appReducer,
    product: productReducer,
    accessorials: accessorialsReducer,
    chargeAccessorials: chargeAccessorialsReducer,
    customerRate: customerRateReducer,
    customerLocation: customerLocationReducer,
    customerProduct: customerProductReducer,
    carrierTracking: carrierTrackingReducer,
    shipment: shipmentReducer,
    quote: quoteReducer,
    packageTypes: packageTypesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
