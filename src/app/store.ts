import { configureStore } from "@reduxjs/toolkit";
import appReducer from "../store/appSlice.ts";
import clientContextReducer from "../store/clientContextSlice.ts";
import productReducer from "../store/productSlice.ts";
import accessorialsReducer from "../store/accessorialsSlice.ts";
import chargeAccessorialsReducer from "../store/chargeAccessorialsSlice.ts";
import customerRateReducer from "../store/customerRateSlice.ts";
import customerLocationReducer from "../store/customerLocationSlice.ts";
import customerProductReducer from "../store/customerProductSlice.ts";
import carrierTrackingReducer from "../store/carrierTrackingSlice.ts";
import shipmentTrackingNotificationReducer from "../store/shipmentTrackingNotificationSlice.ts";
import shipmentTrackingReminderReducer from "../store/shipmentTrackingReminderSlice.ts";
import shipmentReducer from "../store/shipmentSlice.ts";
import shipmentStatusSearchReducer from "../store/shipmentStatusSearchSlice.ts";
import shipmentStatusCountsReducer from "../store/shipmentStatusCountsSlice.ts";
import quoteReducer from "../store/quoteSlice.ts";
import packageTypesReducer from "../store/packageTypesSlice.ts";

import shipmentProductSearchReducer from "../store/shipmentProductSearchSlice.ts";
import shipmentRerateReducer from "../store/shipmentRerateSlice.ts";
import editShipmentReducer from "../store/editShipmentSlice.ts";

import equipmentReducer from "../store/equipmentSlice.ts";
import serviceLevelReducer from "../store/serviceLevelSlice.ts";
import paymentTermReducer from "../store/paymentTermSlice.ts";


export const store = configureStore({
  reducer: {
    app: appReducer,
    clientContext: clientContextReducer,
    product: productReducer,
    accessorials: accessorialsReducer,
    chargeAccessorials: chargeAccessorialsReducer,
    customerRate: customerRateReducer,
    customerLocation: customerLocationReducer,
    customerProduct: customerProductReducer,
    carrierTracking: carrierTrackingReducer,
    shipmentTrackingNotification: shipmentTrackingNotificationReducer,
    shipmentTrackingReminder: shipmentTrackingReminderReducer,
    shipment: shipmentReducer,
    shipmentStatusSearch: shipmentStatusSearchReducer,
    shipmentStatusCounts: shipmentStatusCountsReducer,
    quote: quoteReducer,
    packageTypes: packageTypesReducer,
    shipmentProductSearch: shipmentProductSearchReducer,
    shipmentRerate: shipmentRerateReducer,
    editShipment: editShipmentReducer,
    equipment: equipmentReducer,
    serviceLevel: serviceLevelReducer,
    paymentTerm: paymentTermReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
