import {
  AppstoreOutlined,
  BarsOutlined,
  ExclamationCircleOutlined,
  // HomeOutlined,
  // InfoCircleOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  GoogleMap,
  PolylineF,
  useLoadScript,
  type Libraries,
} from "@react-google-maps/api";
import { Button, Empty, Input, Select, Spin, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { fetchCarrierLogo, saveCustomerQuote, clearQuoteFormData } from "../store/customerRateSlice";
// import abfLogo from "../assets/image 55.png";
// import rlLogo from "../assets/image 57.png";
import SendRatesDialog, {
  type SendRateItem,
} from "../components/rate/SendRatesDialog";
import AdvancedMapMarker from "../lib/AdvancedMapMarker";
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
  discount?: number;
  fuelSurcharge?: number;
  accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number }[];
};

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
  }, [hasApiKey, isLoaded]);

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
  const [loading, setLoading] = useState(!rate.logo);
  const [error, setError] = useState(false);
  const [localLogo, setLocalLogo] = useState<string | null>(rate.logo || null);

  useEffect(() => {
    if (!rate.logo && !localLogo && rate.code) {
      setLoading(true);
      dispatch(fetchCarrierLogo(rate.code))
        .unwrap()
        .then((res: any) => {
          if (res?.logo) setLocalLogo(res.logo);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [rate.code, rate.logo, localLogo, dispatch]);

  if (loading) {
    return <div className="rate-placeholder-logo"><Spin size="small" /></div>;
  }

  const logoToUse = rate.logo || localLogo;
  if (error || !logoToUse) {
    return <div className="rate-placeholder-logo">{rate.name}</div>;
  }
  
  return <img src={logoToUse} alt={`${rate.name}`} />;
}

export function CarrierCard({
  rate,
  checked,
  onCheckedChange,
  onShipIt,
  // onSend,
}: {
  rate: CarrierRate;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onShipIt: () => void;
  onSend?: () => void;
}) {
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
            {rate.price.toLocaleString("en-US", {
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
              <dd>{rate.quoteExpiry}</dd>
              <dt>Transit Days</dt>
              <dd>{rate.transitDays} business days</dd>
              <dt>Est. Delivery Date</dt>
              <dd>{rate.estimatedDelivery}</dd>
            </div>
            <div className='rate-detail-charges'>
              <dt>Gross Charge : {rate.grossCharge}</dt>
              <dt>Discount : {rate.discount}</dt>
              <dt>Fuel Surcharge : {rate.fuelSurcharge}</dt>
              {/* <dt>Gross Charge : {rate.grossCharge?.toLocaleString("en-US", { style: "currency", currency: "USD" })}</dt>
              <dt>Discount : {rate.discount?.toLocaleString("en-US", { style: "currency", currency: "USD" })}</dt>
              <dt>Fuel Surcharge : {rate.fuelSurcharge?.toLocaleString("en-US", { style: "currency", currency: "USD" })}</dt> */}
            </div>
            <div className='rate-detail-accessorials'>
              {rate.accessorialCharges?.map((charge, idx) => (
                <dt key={idx}>{charge.accessorialDescription} : {charge.accessorialCharge}</dt>
              ))}
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function Rate() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("ltl");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rate-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<string[]>([""]);
  const [sendRateIds, setSendRateIds] = useState<string[]>([]);
  const [sendValidationError, setSendValidationError] = useState("");

  const ratesFromStore = useAppSelector((state) => state.customerRate.rates) as CarrierRate[];
  const loadingRates = useAppSelector((state) => state.customerRate.loading);
  const quoteRequest = useAppSelector((state) => state.customerRate.quoteRequest);
  const accessorialsData = useAppSelector((state: any) => state.accessorials?.data) || [];

  const dynamicOrigin = quoteRequest 
    ? `${quoteRequest.origCity || ''}, ${quoteRequest.origState || ''} ${quoteRequest.origZip || ''}, ${quoteRequest.origCountry || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const dynamicDestination = quoteRequest
    ? `${quoteRequest.destCity || ''}, ${quoteRequest.destState || ''} ${quoteRequest.destZip || ''}, ${quoteRequest.destCountry || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const shipmentDate = quoteRequest?.shipmentDate 
    ? new Date(quoteRequest.shipmentDate).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })
    : "";

  const visibleRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (ratesFromStore || []).filter((rate) =>
      [rate.name, rate.code, rate.service].some((value) =>
        (value || "").toLowerCase().includes(query),
      ),
    );

    return [...matches].sort((first, second) => {
      if (sortBy === "rate-desc") return second.price - first.price;
      if (sortBy === "transit") {
        if (first.transitDays === second.transitDays) {
          return first.price - second.price;
        }
        return first.transitDays - second.transitDays;
      }
      return first.price - second.price;
    });
  }, [search, sortBy, ratesFromStore]);

  const validRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) > 0);
  }, [visibleRates]);

  const errorRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) <= 0);
  }, [visibleRates]);

  const handleSaveQuote = () => {
    dispatch(saveCustomerQuote())
      .unwrap()
      .then(() => {
        dispatch(clearQuoteFormData());
        messageApi.success("Quote saved successfully!");
        navigate("/quote-summary");
      })
      .catch((err: any) => {
        messageApi.error(err || "Failed to save quote.");
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
          quoteProducts: (quoteRequest?.shipments || []).map((s: any, idx: number) => ({
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
            hazmatClass: s.hazMatClass || s.hazmatClass || "",
            hazmatUN: s.hazMatUN || s.hazmatUN || "",
            isStackable: s.stackable ?? true,
          })),
          quoteAccessorials: (quoteRequest?.accessorialCodes || []).map((code: string) => ({ accCode: code })),
        },
        selectedCarrier: rate,
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

      <div className='rate-capacity-warning' role='alert'>
        <ExclamationCircleOutlined />
        <span>
          Your quote exceeds some carrier capacity rules, so we didn't include
          those carriers in this list.
        </span>
      </div>

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
            {quoteRequest?.shipments?.map((item: any, index: number) => (
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
                <dd>{quoteRequest?.shipments ? `${quoteRequest.shipments.reduce((acc: number, item: any) => acc + (item.weight || 0), 0)} lbs` : ''}</dd>
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
                {quoteRequest.accessorialCodes.map((acc: string, idx: number) => {
                  const match = accessorialsData.find((a: any) => a.accesorialCode === acc || a.accessorialName === acc);
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
              aria-selected={quoteMode === "ltl"}
              className={quoteMode === "ltl" ? "active" : ""}
              onClick={() => setQuoteMode("ltl")}>
              LTL <span>{(ratesFromStore || []).length}</span>
            </button>
            {/* <button
              type='button'
              role='tab'
              aria-selected={quoteMode === "volume"}
              className={quoteMode === "volume" ? "active" : ""}
              onClick={() => setQuoteMode("volume")}>
              Volume <span>0</span>
            </button> */}
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
            <p className='rate-results-count'>
              {`Showing ${quoteMode === "ltl" ? visibleRates.length : 0} of ${(ratesFromStore || []).length} carriers`}
            </p>
          )}
          {loadingRates && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spin size="large" />
            </div>
          )}

          {!loadingRates && quoteMode === "volume" ? (
            <div className='rate-empty-state'>
              <Empty description='No volume rates are available for this quote.' />
            </div>
          ) : !loadingRates && (validRates.length > 0 || errorRates.length > 0) ? (
            <>
              {validRates.length > 0 ? (
                <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                  {validRates.map((rate) => (
                    <CarrierCard
                      key={rate.id}
                      rate={rate}
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
                <section className='rate-error-section' aria-label='Carriers with errors'>
                  <h2 className='rate-error-heading'>
                    <span>With Errors</span>
                    <span className='rate-error-badge'>{errorRates.length}</span>
                  </h2>
                  <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                    {errorRates.map((rate) => (
                      <CarrierCard
                        key={rate.id}
                        rate={rate}
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
