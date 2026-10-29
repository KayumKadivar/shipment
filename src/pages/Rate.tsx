import {
  AppstoreOutlined,
  BarsOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  GoogleMap,
  PolylineF,
  useLoadScript,
  type Libraries,
} from "@react-google-maps/api";
import { Button, Checkbox, Col, Empty, Input, Select, Spin, message } from "antd";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from "../config/apiConfig";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { fetchCarrierLogo, saveCustomerQuote, clearQuoteFormData } from "../store/customerRateSlice";
import { fetchClientsAndSubclients } from "../store/customerLocationSlice";
import "../components/New Shipment/newshipment.css";
// import abfLogo from "../assets/image 55.png";
// import rlLogo from "../assets/image 57.png";
import SendRatesDialog, {
  type SendRateItem,
} from "../components/rate/SendRatesDialog";
import AdvancedMapMarker from "../lib/AdvancedMapMarker";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";
import {
  computeDrivingRoute,
  type ComputedRoute,
  type RouteLocation,
} from "../lib/googleRoutes";

export type CarrierRate = SendRateItem & {
  warning: string;
  quoteExpiry: string;
  liabilityNew: string;
  liabilityUsed: string;
  grossCharge?: number;
  grossSellAmount?: number;
  discount?: number;
  fuelSurcharge?: number;
  accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[];
  quoteCostDetails?: any[] | null;
  rawQuoteResult?: any;
  sellPrice?: number;
  grossSell?: number;
  fuelSell?: number;
  discountSell?: number;
  markupAmount?: number;
  ppsFreight?: number;
  ppsFuel?: number;
  isNetSellActive?: boolean;
};

export interface AppliedMarkupConfig {
  isMarkupEnabled: boolean;
  markupDropdownOption: string;
  numericMarkup: number;
  numericMarkupRate: number;
  isNetSellRateEnabled: boolean;
  numericNetSellRate: number;
}

export function applyMarkupToRate(rate: CarrierRate, config: AppliedMarkupConfig): CarrierRate {
  const numRate = Math.max(0, config.numericMarkupRate || 0);
  const numMin = Math.max(0, config.numericMarkup || 0);
  const numNetSell = Math.max(0, config.numericNetSellRate || 0);

  const grossBuy = Number(rate.grossCharge) || 0;
  const fuelBuy = Number(rate.fuelSurcharge) || 0;
  const discountBuy = Number(rate.discount) || 0;
  const totalBuy = Number(rate.price) || 0;

  if (config.isNetSellRateEnabled) {
    const ppsFreight = numNetSell;
    const ppsFuel = 0;
    const finalPrice = numNetSell;
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

  if (config.isMarkupEnabled && (numRate > 0 || numMin > 0)) {
    const rateToUse = numRate > 0 ? numRate : numMin;
    let calculatedMarkup = 0;

    if (config.markupDropdownOption === "Flat") {
      calculatedMarkup = rateToUse;
    } else if (config.markupDropdownOption === "% Freight") {
      calculatedMarkup = grossBuy * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    } else if (config.markupDropdownOption === "% Freight + Fuel") {
      calculatedMarkup = (grossBuy + fuelBuy) * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    } else if (config.markupDropdownOption === "% Freight + Fuel + Accessorial") {
      calculatedMarkup = totalBuy * (rateToUse / 100);
      if (calculatedMarkup < numMin) {
        calculatedMarkup = numMin;
      }
    }

    const totalMarkupToDistribute = Math.round(calculatedMarkup * 100) / 100;
    const baseTotal = grossBuy + fuelBuy;

    let ppsFreight = 0;
    let ppsFuel = 0;

    if (totalMarkupToDistribute > 0 && baseTotal > 0) {
      const freightPercent = Math.round((grossBuy / baseTotal) * 10000) / 100;
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

    const grossSell = Math.round((grossBuy + ppsFreight) * 100) / 100;
    const fuelSell = Math.round((fuelBuy + ppsFuel) * 100) / 100;
    const sellPrice = Math.round((totalBuy + totalMarkupToDistribute) * 100) / 100;

    return {
      ...rate,
      sellPrice,
      grossSell,
      fuelSell,
      discountSell: discountBuy,
      markupAmount: totalMarkupToDistribute,
      ppsFreight,
      ppsFuel,
    };
  }

  return {
    ...rate,
    sellPrice: rate.price,
    grossSell: rate.grossCharge,
    fuelSell: rate.fuelSurcharge,
    discountSell: rate.discount,
    markupAmount: 0,
    ppsFreight: 0,
    ppsFuel: 0,
  };
}

export type SortOption = "rate-asc" | "rate-desc" | "transit";
export type QuoteMode = "ltl" | "volume";
export type ViewMode = "list" | "grid";

const apiKeyPlaceholder = "PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE";
const googleLibraries: Libraries = ["marker", "places", "routes"];
const googleMapId =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ||
  "DEMO_MAP_ID";
const mapContainerStyle = { width: "100%", height: "100%" };
const usCenter = { lat: 39.5, lng: -98.35 };

function formatDistance(distanceMeters?: number) {
  if (typeof distanceMeters !== "number") return "2,516 miles";
  return `${Math.round(distanceMeters / 1609.344).toLocaleString("en-US")} miles`;
}

export function RateMap({ originAddress, destinationAddress }: { originAddress: string; destinationAddress: string }) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [route, setRoute] = useState<ComputedRoute | null>(null);
  const [markers, setMarkers] = useState<RouteLocation[]>([]);
  const [routeError, setRouteError] = useState("");
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined;
  const hasApiKey = Boolean(
    googleMapsApiKey && googleMapsApiKey !== apiKeyPlaceholder,
  );
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey ?? "",
    libraries: googleLibraries,
    version: "beta",
  });

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      fullscreenControl: true,
      mapTypeControl: false,
      mapId: googleMapId,
      streetViewControl: false,
      zoomControl: true,
    }),
    [],
  );

  useEffect(() => {
    if (!hasApiKey || !isLoaded || !window.google) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsRouteLoading(true);
      setRouteError("");
    });

    const geocodeAddress = (address: string) =>
      new Promise<RouteLocation>((resolve, reject) => {
        new window.google.maps.Geocoder().geocode(
          { address },
          (results, status) => {
            if (
              status === window.google.maps.GeocoderStatus.OK &&
              results?.[0]
            ) {
              const location = results[0].geometry.location;
              resolve({
                address: results[0].formatted_address,
                position: { lat: location.lat(), lng: location.lng() },
              });
              return;
            }
            reject(new Error(status));
          },
        );
      });

    const loadRoute = async () => {
      try {
        const computedRoute = await computeDrivingRoute(
          originAddress,
          destinationAddress,
        );
        if (cancelled) return;

        const start = computedRoute.path[0];
        const end = computedRoute.path[computedRoute.path.length - 1];
        setRoute(computedRoute);
        setMarkers([
          { address: `From: ${originAddress}`, position: start },
          { address: `To: ${destinationAddress}`, position: end },
        ]);
      } catch (error) {
        console.error("Google driving route request failed.", error);
        try {
          const fallbackMarkers = await Promise.all([
            geocodeAddress(originAddress),
            geocodeAddress(destinationAddress),
          ]);
          if (!cancelled) {
            setMarkers(fallbackMarkers);
            setRouteError("Driving route unavailable, showing stops only.");
          }
        } catch {
          if (!cancelled) {
            setRouteError("Unable to load this route.");
          }
        }
      } finally {
        if (!cancelled) setIsRouteLoading(false);
      }
    };

    void loadRoute();
    return () => {
      cancelled = true;
    };
  }, [destinationAddress, hasApiKey, isLoaded, originAddress]);

  useEffect(() => {
    if (!map || !window.google) return;

    const points = route?.path.length
      ? route.path
      : markers.map((marker) => marker.position);
    if (!points.length) return;

    let animationFrame = 0;
    const fitRoute = () => {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, { top: 26, right: 26, bottom: 26, left: 26 });
    };
    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fitRoute);
    };

    scheduleFit();
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(map.getDiv());

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [map, markers, route]);

  if (!hasApiKey) {
    return (
      <div className='rate-map-placeholder'>
        <strong>Google Map Preview</strong>
        <span>Add VITE_GOOGLE_MAPS_API_KEY to display the route.</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='rate-map-placeholder'>
        <strong>Map failed to load</strong>
        <span>Check the API key and enabled Google Maps APIs.</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className='rate-map-placeholder'>
        <Spin size='small' />
        <span>Loading route...</span>
      </div>
    );
  }

  return (
    <>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={usCenter}
        zoom={4}
        options={mapOptions}
        onLoad={setMap}
        onUnmount={() => setMap(null)}>
        {route ? (
          <PolylineF
            path={route.path}
            options={{
              strokeColor: "#2879dc",
              strokeOpacity: 0.92,
              strokeWeight: 4,
            }}
          />
        ) : null}
        {markers.map((marker) => (
          <AdvancedMapMarker
            key={marker.address}
            position={marker.position}
            title={marker.address}
          />
        ))}
      </GoogleMap>
      <span className='rate-map-distance'>{formatDistance(route?.distanceMeters)}</span>
      {isRouteLoading ? (
        <span className='rate-map-status'>Loading route...</span>
      ) : null}
      {routeError ? <span className='rate-map-status'>{routeError}</span> : null}
    </>
  );
}

export function CarrierLogo({ rate }: { rate: CarrierRate }) {
  const dispatch = useAppDispatch();
  const [error, setError] = useState(false);
  const [localLogo, setLocalLogo] = useState<string | null>(rate.logo || null);

  useEffect(() => {
    if (rate.logo || localLogo || !rate.code) return;

    void dispatch(fetchCarrierLogo(rate.code))
      .unwrap()
      .then((res) => {
        if (res.logo) setLocalLogo(res.logo);
      })
      .catch(() => {
        setError(true);
      });
  }, [rate.code, rate.logo, localLogo, dispatch]);

  const loading = !rate.logo && !localLogo && !error && Boolean(rate.code);

  if (loading) {
    return <div className="rate-placeholder-logo"><Spin size="small" /></div>;
  }

  const logoToUse = rate.logo || localLogo;
  if (error || !logoToUse) {
    return <div className="rate-placeholder-logo">{rate.name}</div>;
  }
  
  return <img src={logoToUse} alt={`${rate.name}`} />;
}

export const formatDateTimeDisplay = (val?: string | null): string => {
  if (!val || val === "N/A") return "";
  let str = String(val).trim();
  if (str.startsWith("0001-01-01")) return "";
  str = str.replace(/\.\d+(Z|[+-]\d{2}:\d{2})?$/i, "");
  str = str.replace(/(Z|[+-]\d{2}:\d{2})$/i, "");
  str = str.replace(/(\d)T(\d)/i, "$1 $2");
  if (str.startsWith("0001-01-01")) return "";
  return str;
};

export const getGrossSellAmount = (rate: CarrierRate): string | number | undefined => {
  if (rate.grossSellAmount !== undefined && rate.grossSellAmount !== null) {
    return rate.grossSellAmount;
  }
  const details =
    rate.quoteCostDetails ||
    rate.rawQuoteResult?.quoteCostDetails ||
    rate.rawQuoteResult?.costDetails;
  if (Array.isArray(details)) {
    const grossItem = details.find((cd: any) => {
      const code = (cd.accCode || cd.code || "").trim().toUpperCase();
      const name = (cd.accName || cd.name || cd.description || "").trim().toLowerCase();
      return (
        code === "FRT" ||
        code === "GROSS" ||
        code === "FREIGHT" ||
        code === "BASE" ||
        name === "grosscharge" ||
        name.includes("gross") ||
        name.includes("freight")
      );
    });
    if (grossItem) {
      const val = grossItem.sellAmount ?? grossItem.sellCharge;
      if (val !== undefined && val !== null && val !== "") {
        return val;
      }
    }
  }
  return undefined;
};

export const getChargeSellDetails = (rate: CarrierRate) => {
  if (rate.grossSell !== undefined || rate.fuelSell !== undefined) {
    return {
      grossSell: rate.grossSell ?? rate.grossCharge ?? 0,
      discountSell: rate.discountSell ?? (rate.isNetSellActive ? 0 : (rate.discount ?? 0)),
      fuelSell: rate.fuelSell ?? (rate.isNetSellActive ? 0 : (rate.fuelSurcharge ?? 0)),
      accessorialsSell: (rate.accessorialCharges || []).map((ac) => ({
        accessorialDescription: ac.accessorialDescription || "Accessorial",
        accessorialCharge: rate.isNetSellActive ? 0 : (ac.accessorialCharge ?? 0),
      })),
    };
  }

  const details =
    rate.quoteCostDetails ||
    rate.rawQuoteResult?.quoteCostDetails ||
    rate.rawQuoteResult?.costDetails;

  let grossSell: number | string | undefined = rate.grossSellAmount;
  let discountSell: number | string | undefined = undefined;
  let fuelSell: number | string | undefined = undefined;
  const accessorialsSell: { accessorialDescription: string; accessorialCharge: number | string }[] = [];

  if (Array.isArray(details) && details.length > 0) {
    details.forEach((cd: any) => {
      const code = (cd.accCode || cd.code || "").trim().toUpperCase();
      const name = (cd.accName || cd.name || cd.description || "").trim().toLowerCase();
      const sell = cd.sellAmount != null ? cd.sellAmount : cd.amount;

      if (
        code === "GROSS" ||
        code === "FRT" ||
        code === "FREIGHT" ||
        code === "BASE" ||
        name === "grosscharge" ||
        name.includes("gross") ||
        name.includes("freight")
      ) {
        if (grossSell === undefined) grossSell = sell;
      } else if (
        code === "DISC" ||
        code === "DSC" ||
        code === "DISCOUNT" ||
        name.includes("discount")
      ) {
        discountSell = Math.abs(Number(sell)) || 0;
      } else if (
        code === "FUEL" ||
        code === "FSC" ||
        code === "FUEL SURCHARGE" ||
        name.includes("fuel")
      ) {
        fuelSell = sell;
      } else {
        const desc = cd.accName || cd.accessorialDescription || cd.name || cd.description || code || "Accessorial";
        accessorialsSell.push({
          accessorialDescription: desc,
          accessorialCharge: sell ?? 0,
        });
      }
    });
  }

  if (grossSell === undefined) grossSell = rate.grossCharge ?? 0;
  if (discountSell === undefined) discountSell = rate.discount ?? 0;
  if (fuelSell === undefined) fuelSell = rate.fuelSurcharge ?? 0;

  if (accessorialsSell.length === 0 && Array.isArray(rate.accessorialCharges)) {
    rate.accessorialCharges.forEach((ac) => {
      accessorialsSell.push({
        accessorialDescription: ac.accessorialDescription || "Accessorial",
        accessorialCharge: ac.accessorialCharge ?? 0,
      });
    });
  }

  return {
    grossSell,
    discountSell,
    fuelSell,
    accessorialsSell,
  };
};

export function CarrierCard({
  rate,
  checked,
  onCheckedChange,
  onShipIt,
  isCorporate,
  // onSend,
}: {
  rate: CarrierRate;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onShipIt: () => void;
  isCorporate?: boolean;
  onSend?: () => void;
}) {
  const sellDetails = getChargeSellDetails(rate);
  const storeIsCorporate = useAppSelector((state) => state.app.isCorporate);
  const showBuyCharges =
    isCorporate !== undefined
      ? isCorporate
      : (storeIsCorporate ??
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("isCorporate") === "true"));

  return (
    <article
      className={`rate-card ${checked ? "rate-card--selected" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onCheckedChange(!checked);
      }}>
      {rate.warning ? (
        <div className='rate-card__warning'>
          <ExclamationCircleOutlined />
          <span>{rate.warning}</span>
        </div>
      ) : null}

      <div className='rate-card__body'>
        <div className='rate-card__offer'>
          <div className='rate-card__logo'>
            <CarrierLogo rate={rate} />
          </div>
          <strong className='rate-card__price'>
            {(rate.sellPrice !== undefined ? rate.sellPrice : rate.price).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </strong>
          <Button
            type={checked ? "primary" : "default"}
            className='rate-card__select'
            onClick={onShipIt}>
            {checked ? "Selected" : "Ship It"}
          </Button>
        </div>

        <div className='rate-card__information'>
          <div className='rate-card__heading'>
            <div className='rate-card__identity'>
              <strong>{rate.name}</strong>
              <span className='rate-chip'>{rate.code}</span>
              <span
                className={`rate-chip ${
                  rate.service === "ECONOMY" ? "rate-chip--blue" : ""
                }`}>
                {rate.service}
              </span>
            </div>
            {/* <div className='rate-card__quick-actions'>
              <button type='button' onClick={onSend}>
                <SendOutlined /> Send
              </button>
              <button type='button'>
                <HomeOutlined /> Terminals
              </button>
              <button type='button'>
                <InfoCircleOutlined /> Info
              </button>
            </div> */}
          </div>

          <dl className='rate-card__details'>
            <div className='rate-detail-expiry'>
              <dt>Quote Exp. Date</dt>
              <dd>{formatDateTimeDisplay(rate.quoteExpiry)}</dd>
              <dt>Transit Days</dt>
              <dd>{rate.transitDays} business days</dd>
              <dt>Est. Delivery Date</dt>
              <dd>{formatDateTimeDisplay(rate.estimatedDelivery)}</dd>
            </div>
            {showBuyCharges && (
              <div className='rate-detail-charges'>
                <dt style={{ whiteSpace: "nowrap" }}>Gross Charge : {rate.grossCharge}</dt>
                <dt>Discount : {rate.isNetSellActive ? 0 : rate.discount}</dt>
                <dt>Fuel Surcharge : {rate.isNetSellActive ? 0 : rate.fuelSurcharge}</dt>
                {rate.accessorialCharges?.map((charge, idx) => (
                  <dt key={idx}>
                    {charge.accessorialDescription} : {rate.isNetSellActive ? 0 : charge.accessorialCharge}
                  </dt>
                ))}
              </div>
            )}
            <div className='rate-detail-charges rate-detail-charges-sell'>
              <dt style={{ whiteSpace: "nowrap" }}>Gross Charge : {sellDetails.grossSell}</dt>
              <dt>Discount : {sellDetails.discountSell}</dt>
              <dt>Fuel Surcharge : {sellDetails.fuelSell}</dt>
              {sellDetails.accessorialsSell?.map((charge, idx) => (
                <dt key={idx}>{charge.accessorialDescription} : {charge.accessorialCharge}</dt>
              ))}
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

const normalizeMarkupType = (
  raw?: string,
): "flat" | "percentage" | "netSellRate" => {
  if (!raw) return "netSellRate";
  const clean = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (clean.includes("percent")) return "netSellRate";
  if (
    clean.includes("netsell") ||
    clean.includes("sellrate") ||
    clean.includes("net") ||
    clean.includes("sell")
  )
    return "netSellRate";
  if (clean.includes("flat")) return "netSellRate";
  return "netSellRate";
};

function Rate() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();

  const ratesFromStore = useAppSelector((state) => state.customerRate.rates) as CarrierRate[];
  const loadingRates = useAppSelector((state) => state.customerRate.loading);
  const quoteRequest = useAppSelector((state) => state.customerRate.quoteRequest);
  const accessorialsData = useAppSelector((state) => state.accessorials.data);

  // isCorporate check (matching CustomerRate.tsx & QuoteRateDetail.tsx)
  const storeIsCorporate = useAppSelector((state) => state.app.isCorporate);
  const clients = useAppSelector((state) => state.customerLocation?.clients) || [];
  const clientCodeToUse =
    quoteRequest?.clientCode ||
    sessionStorage.getItem("quotes_selectedClientCode") ||
    sessionStorage.getItem("customerLocation_selectedClientCode") ||
    DEFAULT_CLIENT_CODE;
  const selectedClient = clientCodeToUse
    ? clients.find((c) => c.clientCode === clientCodeToUse)
    : undefined;
  const clientCorporateFlag = (
    selectedClient as { isCorporate?: boolean } | undefined
  )?.isCorporate;

  const isCorporate =
    typeof clientCorporateFlag === "boolean"
      ? clientCorporateFlag
      : (storeIsCorporate ??
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("isCorporate") === "true"));

  // Markup UI State
  const [isMarkupEnabled, setIsMarkupEnabled] = useState(false);
  const [markupDropdownOption, setMarkupDropdownOption] = useState("% Freight + Fuel");
  const [markupRate, setMarkupRate] = useState("0");
  const [isMarkupRateDirty, setIsMarkupRateDirty] = useState(false);
  const [markup, setMarkup] = useState("0");
  const [isNetSellRateEnabled, setIsNetSellRateEnabled] = useState(false);
  const [netSellRate, setNetSellRate] = useState("");
  const [isNetSellDirty, setIsNetSellDirty] = useState(false);

  const [appliedMarkupConfig, setAppliedMarkupConfig] = useState<AppliedMarkupConfig>({
    isMarkupEnabled: false,
    markupDropdownOption: "% Freight + Fuel",
    numericMarkup: 0,
    numericMarkupRate: 0,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
  });

  const handleApplyMarkup = () => {
    const numRate = Math.max(0, Number(markupRate) || 0);
    const numMin = Math.max(0, Number(markup) || 0);
    const numNetSell = Math.max(0, Number(netSellRate) || 0);

    setAppliedMarkupConfig({
      isMarkupEnabled,
      markupDropdownOption,
      numericMarkup: numMin,
      numericMarkupRate: numRate,
      isNetSellRateEnabled,
      numericNetSellRate: numNetSell,
    });

    setIsMarkupRateDirty(false);
    setIsNetSellDirty(false);

    if (isMarkupEnabled && (numRate > 0 || numMin > 0)) {
      messageApi.success("Applied " + markupDropdownOption + " markup");
    } else if (isNetSellRateEnabled) {
      messageApi.success("Applied Net Sell Rate");
    } else if (!isMarkupEnabled && !isNetSellRateEnabled) {
      messageApi.info("Markup removed");
    } else {
      messageApi.info("Applied");
    }
  };

  // Legacy markup state
  const [, setMarkupType] = useState<"flat" | "percentage" | "netSellRate">("netSellRate");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rate-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<string[]>([""]);
  const [sendRateIds, setSendRateIds] = useState<string[]>([]);
  const [sendValidationError, setSendValidationError] = useState("");

  const dynamicOrigin = quoteRequest 
    ? `${quoteRequest.origCity || ''}, ${quoteRequest.origState || ''} ${quoteRequest.origZip || ''}, ${quoteRequest.origCountry || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const dynamicDestination = quoteRequest
    ? `${quoteRequest.destCity || ''}, ${quoteRequest.destState || ''} ${quoteRequest.destZip || ''}, ${quoteRequest.destCountry || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const shipmentDate = quoteRequest?.shipmentDate 
    ? new Date(quoteRequest.shipmentDate).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })
    : "";

  useEffect(() => {
    dispatch(fetchClientsAndSubclients());
  }, [dispatch]);

  useEffect(() => {
    const fetchClientMarkup = async () => {
      const clientCodeToUse =
        quoteRequest?.clientCode ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      if (!clientCodeToUse) return;

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = "Bearer " + token;

      try {
        const response = await axios.get(
          API_BASE_URL + "/ClientMarkupConfig/GetClientMarkup/" + encodeURIComponent(clientCodeToUse),
          { headers },
        );
        if (response.data?.isSuccess && response.data?.data) {
          const rawData = response.data.data;
          const config = Array.isArray(rawData) ? rawData[0] : rawData;
          if (config && config.markupType) {
            setMarkupType(normalizeMarkupType(config.markupType));
            const raw = String(config.markupType).toLowerCase();
            const isNetSell = raw.includes("netsell");
            if (isNetSell) {
              setIsNetSellRateEnabled(true);
              setIsMarkupEnabled(false);
              const rateVal = config.rate != null ? String(config.rate) : "0";
              setNetSellRate(rateVal);
              setAppliedMarkupConfig({
                isMarkupEnabled: false,
                markupDropdownOption: "Flat",
                numericMarkup: 0,
                numericMarkupRate: 0,
                isNetSellRateEnabled: true,
                numericNetSellRate: Number(rateVal) || 0,
              });
            } else {
              setIsMarkupEnabled(true);
              setIsNetSellRateEnabled(false);
              let opt = "Flat";
              if (raw.includes("flat")) {
                opt = "Flat";
              } else if (raw.includes("acc")) {
                opt = "% Freight + Fuel + Accessorial";
              } else if (raw.includes("fuel")) {
                opt = "% Freight + Fuel";
              } else {
                opt = "% Freight";
              }
              setMarkupDropdownOption(opt);
              const rateVal = config.rate != null ? String(config.rate) : "0";
              setMarkupRate(rateVal);
              const minVal =
                config.minimum != null
                  ? String(config.minimum)
                  : config.rate != null
                    ? String(config.rate)
                    : "0";
              setMarkup(minVal);
              setAppliedMarkupConfig({
                isMarkupEnabled: true,
                markupDropdownOption: opt,
                numericMarkup: Number(minVal) || 0,
                numericMarkupRate: Number(rateVal) || 0,
                isNetSellRateEnabled: false,
                numericNetSellRate: 0,
              });
            }
          }
        }
      } catch (error) {
        console.error("[Rate] Error fetching GetClientMarkup:", error);
      }
    };

    fetchClientMarkup();
  }, [quoteRequest?.clientCode]);

  const visibleRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ratesWithMarkup = (ratesFromStore || []).map((rate) =>
      applyMarkupToRate(rate, appliedMarkupConfig)
    );
    const matches = ratesWithMarkup.filter((rate) =>
      [rate.name, rate.code, rate.service].some((value) =>
        (value || "").toLowerCase().includes(query),
      ),
    );

    return [...matches].sort((first, second) => {
      const p1 = first.sellPrice !== undefined ? first.sellPrice : first.price;
      const p2 = second.sellPrice !== undefined ? second.sellPrice : second.price;
      if (sortBy === "rate-desc") return p2 - p1;
      if (sortBy === "transit") {
        if (first.transitDays === second.transitDays) {
          return p1 - p2;
        }
        return first.transitDays - second.transitDays;
      }
      return p1 - p2;
    });
  }, [search, sortBy, ratesFromStore, appliedMarkupConfig]);

  const validRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) > 0);
  }, [visibleRates]);

  const errorRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) <= 0);
  }, [visibleRates]);

  const [activeTab, setActiveTab] = useState<"ltl" | "error">("ltl");
  const errorSectionRef = useRef<HTMLElement | null>(null);
  const validSectionRef = useRef<HTMLDivElement | null>(null);

  const totalValidCount = useMemo(() => {
    return (ratesFromStore || []).filter((rate) => (rate.price ?? 0) > 0).length;
  }, [ratesFromStore]);

  const totalErrorCount = useMemo(() => {
    return (ratesFromStore || []).filter((rate) => (rate.price ?? 0) <= 0).length;
  }, [ratesFromStore]);

  const displayValidCount = search.trim() ? validRates.length : totalValidCount;
  const displayErrorCount = search.trim() ? errorRates.length : totalErrorCount;

  const handleScrollToErrors = () => {
    setActiveTab("error");
    if (errorSectionRef.current) {
      errorSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      messageApi.info("No carriers with errors found for this quote.");
    }
  };

  const handleScrollToValid = () => {
    setActiveTab("ltl");
    if (validSectionRef.current) {
      validSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSaveQuote = () => {
    dispatch(saveCustomerQuote())
      .unwrap()
      .then(() => {
        dispatch(clearQuoteFormData());
        messageApi.success("Quote saved successfully!");
        navigate("/quote-summary");
      })
      .catch((error: unknown) => {
        messageApi.error(getApiErrorMessage(error, "Failed to save quote."));
      });
  };

  const handleShipIt = (rate: CarrierRate) => {
    navigate("/shipments/new", {
      state: {
        quote: {
          quoteRequestId: 0,
          originZip: quoteRequest?.origZip,
          originCity: quoteRequest?.origCity,
          originStateCode: quoteRequest?.origState,
          originCountry: quoteRequest?.origCountry,
          destinationZip: quoteRequest?.destZip,
          destinationCity: quoteRequest?.destCity,
          destinationStateCode: quoteRequest?.destState,
          destinationCountry: quoteRequest?.destCountry,
          pickupDate: quoteRequest?.shipmentDate,
          clientName: quoteRequest?.clientName,
          clientCode: quoteRequest?.clientCode,
          profileCode: quoteRequest?.profileCode,
          quoteProducts: (quoteRequest?.shipments || []).map((s, idx) => ({
            quoteProductId: idx + 1,
            pallets: s.pallets || s.units || "",
            pieces: s.pieces || "",
            packagingGroup: s.packageType || s.packagingGroup || "",
            description: s.description || "",
            productClass: s.class || "",
            weight: s.weight || "",
            productNMFC: s.nmfc || "",
            length: s.length || "",
            width: s.width || "",
            height: s.height || "",
            isHazmat: s.hazMat || s.isHazmat || false,
            hazmatClass: s.hazmatClass || s.hazMatClass || "",
            hazmatUN: s.hazmatUN || s.hazMatUN || "",
            hazmatProperShippingName: s.hazmatProperShippingName || s.hazMatProperShippingName || "",
            hazmatPhone: s.hazmatPhone || s.hazMatPhone || "",
            hazmatContactName: s.hazmatContactName || s.hazmatContact || s.hazMatContact || "",
            hazmatGroup: s.hazmatGroup || s.hazmatPackingGroup || s.hazMatPackingGroup || "",
            isStackable: s.stackable ?? true,
          })),
          quoteAccessorials: (quoteRequest?.accessorialCodes || []).map((code) => ({ accCode: code })),
        },
        selectedCarrier: {
          ...rate,
          price: rate.sellPrice !== undefined ? rate.sellPrice : rate.price,
          markupType: appliedMarkupConfig.isNetSellRateEnabled
            ? "netSellRate"
            : appliedMarkupConfig.markupDropdownOption,
          rate: appliedMarkupConfig.isNetSellRateEnabled
            ? String(appliedMarkupConfig.numericNetSellRate)
            : String(appliedMarkupConfig.numericMarkupRate),
          minimum: String(appliedMarkupConfig.numericMarkup),
          markup: rate.markupAmount ?? 0,
          grossSellAmount: rate.grossSell,
          ppsFreight: rate.ppsFreight,
          ppsFuel: rate.ppsFuel,
        },
      },
    });
  };

  const setRateChecked = (rate: CarrierRate, checked: boolean) => {
    setSelectedRates((current) =>
      checked
        ? current.includes(rate.id)
          ? current
          : [...current, rate.id]
        : current.filter((id) => id !== rate.id),
    );
  };

  const closeSendDialog = () => {
    setIsSendDialogOpen(false);
    setSendRecipients([""]);
    setSendRateIds([]);
    setSendValidationError("");
  };

  const openSendDialog = (rateIds: string[] = []) => {
    setSendRecipients([""]);
    setSendRateIds(rateIds);
    setSendValidationError("");
    setIsSendDialogOpen(true);
  };

  const sendRates = () => {
    const enteredRecipients = sendRecipients
      .map((recipient) => recipient.trim())
      .filter(Boolean);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!enteredRecipients.length) {
      setSendValidationError("Add at least one recipient email address.");
      return;
    }

    if (enteredRecipients.some((recipient) => !emailPattern.test(recipient))) {
      setSendValidationError("Enter a valid email address for every recipient.");
      return;
    }

    if (!sendRateIds.length) {
      setSendValidationError("Select at least one rate to send.");
      return;
    }

    messageApi.success(
      `${sendRateIds.length} ${sendRateIds.length === 1 ? "rate" : "rates"} sent to ${enteredRecipients.length} ${enteredRecipients.length === 1 ? "recipient" : "recipients"}`,
    );
    closeSendDialog();
  };

  return (
    <section className='rate-page'>
      {messageContext}

      <button
        type='button'
        className='rate-back-button'
        onClick={() => {
          dispatch(clearQuoteFormData());
          navigate("/quote-summary");
        }}>
        &larr; All Quotes
      </button>

      <header className='rate-page__header'>
        <h1>Quote Results</h1>
        <div className='rate-page__header-actions'>
          <Button onClick={() => navigate("/quotes")}>
            Edit Quote
          </Button>
          <Button onClick={handleSaveQuote}>
            Save Quote
          </Button>
          <Button
            danger
            onClick={() => messageApi.info("Quote deletion is not connected yet.")}>
            Delete Quote
          </Button>
        </div>
      </header>

      <div className='rate-content-grid'>
        <aside className='rate-context'>
          <article className='rate-route-card'>
            <div className='rate-route-card__map'>
              <RateMap originAddress={dynamicOrigin} destinationAddress={dynamicDestination} />
            </div>
            <div className='rate-route-card__summary'>
              <div>
                <span>FROM</span>
                <strong>{dynamicOrigin}</strong>
                <small>{shipmentDate}</small>
              </div>
              <div>
                <span>TO</span>
                <strong>{dynamicDestination}</strong>
              </div>
            </div>
          </article>

          <article className='rate-items-card'>
            <h2>ITEMS</h2>
            {quoteRequest?.shipments?.map((item, index) => (
              <div key={index} className='rate-items-card__body'>
                <strong className='rate-item-pill'>{[item.pieces, item.packageType?.toUpperCase()].filter(Boolean).join(" ")} {item.class ? `· CLASS ${item.class}` : ''}</strong>
                <dl>
                  <div>
                    <dt>Piece(s)</dt>
                    <dd>{item.pieces}</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>{item.weight != null ? `${item.weight} lbs` : ''}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{item.length != null && item.width != null && item.height != null ? `${item.length}" × ${item.width}" × ${item.height}"` : ''}</dd>
                  </div>
                </dl>
              </div>
            ))}
            <dl className='rate-items-card__totals'>
              <div>
                <dt>Total weight</dt>
                <dd>{quoteRequest?.shipments ? `${quoteRequest.shipments.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)} lbs` : ''}</dd>
              </div>
              <div>
                <dt>Total linear feet</dt>
                <dd>{quoteRequest?.totalLinearFeet != null ? `${quoteRequest.totalLinearFeet} ft` : ''}</dd>
              </div>
            </dl>
          </article>

          {quoteRequest?.accessorialCodes && quoteRequest.accessorialCodes.length > 0 && (
            <article className='rate-items-card'>
              <h2>ACCESSORIALS</h2>
              <div className='rate-items-card__body rate-accessorials-list'>
                {quoteRequest.accessorialCodes.map((acc, idx) => {
                  const match = accessorialsData.find((a) => a.accesorialCode === acc || a.accessorialName === acc);
                  const displayName = match ? match.accessorialName : acc;
                  return (
                    <strong key={idx} className='rate-item-pill'>{displayName}</strong>
                  );
                })}
              </div>
            </article>
          )}
        </aside>

        <main className='rate-results'>
          <div className='rate-mode-tabs' role='tablist' aria-label='Quote type'>
            <button
              type='button'
              role='tab'
              aria-selected={activeTab === "ltl"}
              className={activeTab === "ltl" ? "active" : ""}
              onClick={handleScrollToValid}>
              LTL <span>{displayValidCount}</span>
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={activeTab === "error"}
              className={`rate-tab-with-error ${activeTab === "error" ? "active" : ""}`}
              onClick={handleScrollToErrors}>
              With Error <span>{displayErrorCount}</span>
            </button>
          </div>

          <div className='rate-toolbar'>
            <Input
              value={search}
              prefix={<SearchOutlined />}
              placeholder='Carriers search'
              allowClear
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select<SortOption>
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "rate-asc", label: "Sort by rate, low to high" },
                { value: "rate-desc", label: "Sort by rate, high to low" },
                { value: "transit", label: "Sort by transit time" },
              ]}
            />
            <Button
              className='rate-send-all'
              icon={<SendOutlined />}
              onClick={() => openSendDialog()}>
              Send All
            </Button>
            <div className='rate-view-switch' aria-label='Results view'>
              <button
                type='button'
                className={viewMode === "list" ? "active" : ""}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}>
                <BarsOutlined /> List View
              </button>
              <button
                type='button'
                className={viewMode === "grid" ? "active" : ""}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}>
                <AppstoreOutlined /> Grid View
              </button>
            </div>
          </div>

          {!loadingRates && (
            <div className='rate-results-subbar'>
              <p className='rate-results-count'>
                {`Showing ${visibleRates.length} of ${(ratesFromStore || []).length} carriers`}
              </p>
              {isCorporate && (
                <div className="cr-markup-col">
                  <div className="text-muted-13 markup-row-wrap">
                    <Checkbox
                      checked={isMarkupEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsMarkupEnabled(checked);
                        if (checked) {
                          setIsNetSellRateEnabled(false);
                        }
                      }}
                      className="markup-checkbox"
                    >
                      Mark Up
                    </Checkbox>

                    {isMarkupEnabled && (
                      <>
                        <Select
                          value={markupDropdownOption}
                          onChange={(val) => {
                            setMarkupDropdownOption(val);
                          }}
                          style={{ minWidth: 230 }}
                          size="middle"
                          options={[
                            { value: "Flat", label: "Flat" },
                            { value: "% Freight", label: "% Freight" },
                            {
                              value: "% Freight + Fuel",
                              label: "% Freight + Fuel",
                            },
                            {
                              value: "% Freight + Fuel + Accessorial",
                              label: "% Freight + Fuel + Accessorial",
                            },
                          ]}
                        />
                        <div className="markup-input-wrap">
                          {markupDropdownOption === "Flat" ? (
                            <span className="markup-unit-symbol"></span>
                          ) : (
                            <span className="markup-unit-symbol">%</span>
                          )}
                          <Input
                            value={markupRate}
                            status={isMarkupRateDirty ? "error" : undefined}
                            className={`input-sm-center ${isMarkupRateDirty ? "border-red-highlight" : ""}`}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              setMarkupRate(val);
                              setIsMarkupRateDirty(true);
                            }}
                            onPressEnter={handleApplyMarkup}
                          />
                        </div>
                        <div className="markup-input-wrap">
                          <span
                            className="markup-min-label"
                            style={{ fontWeight: 500, fontSize: 13, color: "#555" }}
                          >
                            Min.
                          </span>
                          <span className="markup-unit-symbol">$</span>
                          <Input
                            value={markup}
                            className="input-sm-center"
                            disabled={markupDropdownOption === "Flat"}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              setMarkup(val);
                            }}
                          />
                        </div>
                      </>
                    )}

                    <Checkbox
                      checked={isNetSellRateEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsNetSellRateEnabled(checked);
                        if (checked) {
                          setIsMarkupEnabled(false);
                        }
                      }}
                      className="markup-checkbox"
                    >
                      Net Sell Rate
                    </Checkbox>

                    {isNetSellRateEnabled && (
                      <div className="markup-input-wrap">
                        <span className="markup-unit-symbol">$</span>
                        <Input
                          value={netSellRate}
                          status={isNetSellDirty ? "error" : undefined}
                          className={`input-sm-center ${isNetSellDirty ? "border-red-highlight" : ""}`}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, "");
                            setNetSellRate(val);
                            setIsNetSellDirty(true);
                          }}
                          onPressEnter={handleApplyMarkup}
                        />
                      </div>
                    )}
                    {isCorporate && (
                      <Col>
                        <Button danger type="primary" onClick={handleApplyMarkup}>
                          Apply
                        </Button>
                      </Col>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {loadingRates && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spin size="large" />
            </div>
          )}

          {!loadingRates && (validRates.length > 0 || errorRates.length > 0) ? (
            <>
              {validRates.length > 0 ? (
                <div ref={validSectionRef} className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                  {validRates.map((rate) => (
                    <CarrierCard
                      key={rate.id}
                      rate={rate}
                      isCorporate={isCorporate}
                      checked={selectedRates.includes(rate.id)}
                      onCheckedChange={(checked) =>
                        setRateChecked(rate, checked)
                      }
                      onShipIt={() => handleShipIt(rate)}
                      onSend={() => openSendDialog([rate.id])}
                    />
                  ))}
                </div>
              ) : null}

              {errorRates.length > 0 && (
                <section ref={errorSectionRef} className='rate-error-section' aria-label='Carriers with errors'>
                  <h2 className='rate-error-heading'>
                    <span>With Errors</span>
                    <span className='rate-error-badge'>{errorRates.length}</span>
                  </h2>
                  <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                    {errorRates.map((rate) => (
                      <CarrierCard
                        key={rate.id}
                        rate={rate}
                        isCorporate={isCorporate}
                        checked={selectedRates.includes(rate.id)}
                        onCheckedChange={(checked) =>
                          setRateChecked(rate, checked)
                        }
                        onShipIt={() => handleShipIt(rate)}
                        onSend={() => openSendDialog([rate.id])}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : !loadingRates ? (
            <div className='rate-empty-state'>
              <Empty description='No carriers match your search.' />
            </div>
          ) : null}
        </main>
      </div>

      <SendRatesDialog
        open={isSendDialogOpen}
        rates={ratesFromStore || []}
        recipients={sendRecipients}
        selectedRateIds={sendRateIds}
        validationError={sendValidationError}
        onClose={closeSendDialog}
        onRecipientsChange={(recipients) => {
          setSendRecipients(recipients);
          setSendValidationError("");
        }}
        onSelectedRateIdsChange={(rateIds) => {
          setSendRateIds(rateIds);
          setSendValidationError("");
        }}
        onSubmit={sendRates}
      />
    </section>
  );
}

export default Rate;
