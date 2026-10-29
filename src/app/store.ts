import { combineReducers, configureStore, type UnknownAction } from "@reduxjs/toolkit";
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
import equipmentReducer from "../store/equipmentSlice.ts";
import serviceLevelReducer from "../store/serviceLevelSlice.ts";
import paymentTermReducer from "../store/paymentTermSlice.ts";

const appCombinedReducer = combineReducers({
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
  equipment: equipmentReducer,
  serviceLevel: serviceLevelReducer,
  paymentTerm: paymentTermReducer,
});

const rootReducer = (
  state: ReturnType<typeof appCombinedReducer> | undefined,
  action: UnknownAction
) => {
  if (action.type === "app/logout") {
    state = undefined;
  }
  return appCombinedReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof appCombinedReducer>;
export type AppDispatch = typeof store.dispatch;
