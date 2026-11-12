import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  GoogleMap,
  PolylineF,
  useLoadScript,
  type Libraries,
} from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AdvancedMapMarker from "../lib/AdvancedMapMarker";
import {
  computeDrivingRoute,
  type ComputedRoute,
  type RouteLocation,
} from "../lib/googleRoutes";
import AuditTab from "../components/shipmentdetail/Audit";
import CarrierRateModal from "../components/New Shipment/CarrierRateModal";
import ChargesTab from "../components/shipmentdetail/Charges";
import DetailEditActions from "../components/shipmentdetail/DetailEditActions";
import DetailsTab from "../components/shipmentdetail/Details";
import {
  createShipmentDetailEditValues,
  formatApiDate,
  joinNonEmpty,
  text,
  type ShipmentDetailEditSection,
  type ShipmentDetailEditValues,
} from "../components/shipmentdetail/detailEditValues";
import DocumentTab from "../components/shipmentdetail/Document";
import LoadTab from "../components/shipmentdetail/LoadTab";
import TrackingTab from "../components/shipmentdetail/Tracking";
import {
  createShipmentRerateLoadValues,
  createShipmentRerateRequest,
} from "../components/shipmentdetail/shipmentRerateRequest";
import { fetchCarrierTracking } from "../store/carrierTrackingSlice";
import { fetchClientsAndSubclients } from "../store/customerLocationSlice";
import { applySavedShipment, fetchShipmentByLoadNumber, copyShipment } from "../store/shipmentSlice";
import { editShipment, resetEditShipment } from "../store/editShipmentSlice";
import { createEditShipmentRequest } from "../components/shipmentdetail/editShipmentRequest";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";
import {
  clearShipmentRerate,
  rerateShipment,
  selectShipmentRerateRate,
} from "../store/shipmentRerateSlice";
import type { ShipmentDetails } from "../types/shipment.types";
import type { CarrierRate } from "./Rate";

const apiKeyPlaceholder = "PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE";
const googleLibraries: Libraries = ["marker", "places", "routes"];
const googleMapId =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ||
  "DEMO_MAP_ID";
const usCenter = { lat: 39.5, lng: -98.35 };
const mapContainerStyle = { width: "100%", height: "100%" };
const shipmentDetailTabs = [
  "Details",
  "Load",
  "Charges",
  "Tracking",
  "Documents",
  "Audit",
].map((tab) => ({ key: tab, label: tab }));

type EditableTabKey = "load" | "charges" | "tracking";

type TabEditingState = Record<EditableTabKey, boolean>;

const initialTabEditingState: TabEditingState = {
  load: false,
  charges: false,
  tracking: false,
};

const RerateDetailFields = new Set<keyof ShipmentDetailEditValues>([
  "pickupCityStateZip",
  "deliveryCityStateZip",
  "schedulePickupDate",
]);

function displayRerateDate(value: string | null) {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue.startsWith("0001-01-01")) {
    return "N/A";
  }

  return normalizedValue;
}

function DetailField({
  label,
  value,
  isEditing = false,
  onChange,
}: {
  label: string;
  value: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div
      className={`shipment-detail-field${
        isEditing && onChange ? " shipment-detail-field--editing" : ""
      }`}
    >
      <span>{label}</span>
      {isEditing && onChange ? (
        <Input
          className='shipment-detail-field__input'
          size='small'
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function MapPlaceholder({ title, text }: { title: string; text: string }) {
  return (
    <div className='shipment-detail-map-empty'>
      <Typography.Text strong>{title}</Typography.Text>
      <Typography.Text>{text}</Typography.Text>
    </div>
  );
}

function ShipmentRouteMap({ shipment }: { shipment: ShipmentDetails }) {
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

  const originAddress = useMemo(
    () =>
      joinNonEmpty([
        shipment.originAddress1,
        shipment.originAddress2,
        shipment.orgCityName,
        shipment.orgStateCode,
        shipment.orgPostalCode,
        shipment.orgCountryCode,
      ]),
    [shipment],
  );
  const destinationAddress = useMemo(
    () =>
      joinNonEmpty([
        shipment.destAddress1,
        shipment.destAddress2,
        shipment.destCityName,
        shipment.destStateCode,
        shipment.destPostalCode,
        shipment.destCountryCode,
      ]),
    [shipment],
  );

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const points = route?.path.length
      ? route.path
      : markers.map((marker) => marker.position);

    if (!points.length) return;

    let animationFrame = 0;
    let idleListener: google.maps.MapsEventListener | null = null;

    const fitRoute = () => {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, { top: 22, right: 22, bottom: 22, left: 22 });

      idleListener?.remove();
      idleListener = window.google.maps.event.addListenerOnce(
        map,
        "idle",
        () => {
          const zoom = map.getZoom();
          if (typeof zoom === "number" && zoom > 14) map.setZoom(14);
        },
      );
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fitRoute);
    };

    scheduleFit();

    const resizeObserver = new ResizeObserver(() => {
      window.google.maps.event.trigger(map, "resize");
      scheduleFit();
    });
    resizeObserver.observe(map.getDiv());

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      idleListener?.remove();
    };
  }, [map, markers, route]);

  useEffect(() => {
    if (!hasApiKey || !isLoaded || !window.google) {
      return;
    }

    let cancelled = false;
    const routeTimer = window.setTimeout(() => {
      if (cancelled) return;

      setIsRouteLoading(true);
      setRouteError("");
      setRoute(null);
      setMarkers([]);

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
          if (!cancelled) {
            const start = computedRoute.path[0];
            const end = computedRoute.path[computedRoute.path.length - 1];

            setRoute(computedRoute);
            setMarkers([
              { address: `Pickup: ${originAddress}`, position: start },
              { address: `Destination: ${destinationAddress}`, position: end },
            ]);
          }
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
              setRouteError("Unable to load route for these addresses.");
            }
          }
        } finally {
          if (!cancelled) setIsRouteLoading(false);
        }
      };

      void loadRoute();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(routeTimer);
    };
  }, [destinationAddress, hasApiKey, isLoaded, originAddress]);

  if (!hasApiKey) {
    return (
      <MapPlaceholder
        title='Google Map Preview'
        text='Add VITE_GOOGLE_MAPS_API_KEY to show the shipment route.'
      />
    );
  }

  if (loadError) {
    return (
      <MapPlaceholder
        title='Map failed to load'
        text='Check your Google Maps API key and enabled APIs.'
      />
    );
  }

  if (!isLoaded) {
    return (
      <MapPlaceholder title='Loading Map' text='Preparing shipment route...' />
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
              strokeColor: "#a31d14",
              strokeOpacity: 0.9,
              strokeWeight: 5,
            }}
          />
        ) : null}
        {markers.map((marker) => (
          <AdvancedMapMarker
            key={`${marker.address}-${marker.position.lat}`}
            position={marker.position}
            title={marker.address}
          />
        ))}
      </GoogleMap>
      {isRouteLoading ? (
        <div className='shipment-detail-map-loader'>
          <Spin size='small' />
          <span>Loading route...</span>
        </div>
      ) : null}
      {routeError ? (
        <div className='shipment-detail-map-note'>{routeError}</div>
      ) : null}
    </>
  );
}

function ShipmentDetailContent({ shipment }: { shipment: ShipmentDetails }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [committedShipment, setCommittedShipment] = useState(shipment);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const saveInProgress = useRef(false);
  const editState = useAppSelector((state) => state.editShipment);
  const username = useAppSelector((state) => state.app?.username);
  const savedCarrierName = useAppSelector((state) => state.shipment.shipments?.find(
    (row) => row.loadNumber === shipment.loadNumber)?.carrier);
  const saving = editState?.saving ?? false;
  const collectLoadValues = useCallback((values: Pick<ShipmentDetails, "products" | "accessorials" | "bolDispatchNotes">) => {
    setCommittedShipment((current) => ({ ...current, ...values }));
  }, []);
  const collectChargeValues = useCallback((values: Pick<ShipmentDetails, "buyRate" | "sellRate">) => {
    setCommittedShipment((current) => ({ ...current, ...values }));
  }, []);
  const [isResolvingRatingProfile, setIsResolvingRatingProfile] = useState(false);
  const ratingLookupRequest = useRef<{ abort: () => void } | null>(null);
  const rerateInProgress = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      ratingLookupRequest.current?.abort();
      ratingLookupRequest.current = null;
    };
  }, []);
  const rerateState = useAppSelector((state) => state.shipmentRerate);
  const rerateRates = rerateState?.rates;
  const reratedRate = rerateState?.rate ?? null;
  const rerateLoading = rerateState?.loading ?? false;
  const rerateError = rerateState?.error ?? null;
  const [activeTab, setActiveTab] = useState("Details");
  const initialDetailValues = createShipmentDetailEditValues(shipment);
  const [savedDetailValues, setSavedDetailValues] =
    useState<ShipmentDetailEditValues>(initialDetailValues);
  const [draftDetailValues, setDraftDetailValues] =
    useState<ShipmentDetailEditValues>(initialDetailValues);
  const [activeDetailEditor, setActiveDetailEditor] =
    useState<ShipmentDetailEditSection | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasPendingRerateChanges, setHasPendingRerateChanges] = useState(false);
  const [needsRerating, setNeedsRerating] = useState(false);
  const [isRerateModalOpen, setIsRerateModalOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [messageApi, messageContext] = message.useMessage();
  const [rerateValidationError, setRerateValidationError] = useState<
    string | null
  >(null);
  const [rerateLoadValues, setRerateLoadValues] = useState(() =>
    createShipmentRerateLoadValues(shipment),
  );
  const [tabEditingState, setTabEditingState] = useState<TabEditingState>(
    initialTabEditingState,
  );

  const carrier = text(shipment.sellSCAC || shipment.scac);
  const customer = text(shipment.clientName);
  const displayedDetailValues =
    activeDetailEditor === null ? savedDetailValues : draftDetailValues;
  const isReferenceEditing =
    activeTab === "Details" && activeDetailEditor === "referenceNumbers";
  const referenceDetailValues =
    isReferenceEditing ? draftDetailValues : savedDetailValues;
  const hasOpenInlineEditor =
    activeDetailEditor !== null || Object.values(tabEditingState).some(Boolean);
  const rerateModalRates = useMemo<CarrierRate[]>(
    () =>
      (rerateRates ?? []).map((rate) => ({
        id: rate.id,
        name: rate.carrierName,
        code: rate.scac ?? "",
        service: rate.rateType,
        price: rate.totalShipmentCost,
        sellPrice: rate.sellTotalShipmentCost,
        grossSell: rate.sellGrossCharge,
        discountSell: rate.sellDiscount,
        fuelSell: rate.sellFuelSurcharge,
        transitDays: rate.transitDays,
        estimatedDelivery: displayRerateDate(rate.deliveryDate),
        logoKind: "image",
        warning: rate.errorMessage ?? "",
        quoteExpiry: displayRerateDate(rate.quoteExpirationDate),
        liabilityNew: "",
        liabilityUsed: "",
        grossCharge: rate.grossCharge,
        discount: rate.discount,
        fuelSurcharge: rate.fuelSurcharge,
        accessorialCharges: rate.accessorialCharges,
      })),
    [rerateRates],
  );

  const markChangesPending = useCallback((requiresRerate = false) => {
    setHasUnsavedChanges(true);

    if (requiresRerate) {
      setHasPendingRerateChanges(true);
      setNeedsRerating(true);
    }
    setSaveValidationError(null);
  }, []);

  const updateTabEditingState = useCallback(
    (tab: EditableTabKey, isEditing: boolean) => {
      setTabEditingState((current) =>
        current[tab] === isEditing
          ? current
          : { ...current, [tab]: isEditing },
      );
    },
    [],
  );

  const handleLoadEditingStateChange = useCallback(
    (isEditing: boolean) => updateTabEditingState("load", isEditing),
    [updateTabEditingState],
  );
  const handleChargesEditingStateChange = useCallback(
    (isEditing: boolean) => updateTabEditingState("charges", isEditing),
    [updateTabEditingState],
  );
  const handleTrackingEditingStateChange = useCallback(
    (isEditing: boolean) => updateTabEditingState("tracking", isEditing),
    [updateTabEditingState],
  );

  const updateDraftDetailField = (
    field: keyof ShipmentDetailEditValues,
    value: string,
  ) => {
    setDraftDetailValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const beginDetailsEditing = (section: ShipmentDetailEditSection) => {
    setDraftDetailValues({ ...savedDetailValues });
    setActiveDetailEditor(section);
  };

  const saveDetailsEditing = () => {
    const changedFields = (
      Object.keys(draftDetailValues) as Array<keyof ShipmentDetailEditValues>
    ).filter((field) => draftDetailValues[field] !== savedDetailValues[field]);

    setSavedDetailValues({ ...draftDetailValues });
    setActiveDetailEditor(null);
    if (changedFields.length > 0) {
      markChangesPending(
        changedFields.some((field) => RerateDetailFields.has(field)),
      );
    }
  };

  const cancelDetailsEditing = () => {
    setDraftDetailValues({ ...savedDetailValues });
    setActiveDetailEditor(null);
  };

  const savePendingChanges = async () => {
    if (hasOpenInlineEditor || needsRerating || hasPendingRerateChanges || saving || saveInProgress.current) return;
    setSaveValidationError(null);
    saveInProgress.current = true;
    try {
      const payload = createEditShipmentRequest({
        shipment: {
          ...committedShipment,
          sellCarrierName: committedShipment.sellCarrierName || (savedCarrierName !== "—" ? savedCarrierName : "") || "",
        },
        detailValues: savedDetailValues,
        username,
      });
      const result = await dispatch(editShipment(payload));
      if (!isMounted.current) return;
      if (editShipment.fulfilled.match(result)) {
        const nextShipment: ShipmentDetails = {
          ...committedShipment, ...payload,
          proNumber: result.payload.data?.proNumber ?? payload.proNumber,
          bolStatus: result.payload.data?.shipmentStatus || payload.bolStatus,
        };
        setCommittedShipment(nextShipment);
        setSavedDetailValues(createShipmentDetailEditValues(nextShipment));
        setDraftDetailValues(createShipmentDetailEditValues(nextShipment));
        dispatch(applySavedShipment(nextShipment));
        setHasUnsavedChanges(false);
        setNeedsRerating(false);
        setHasPendingRerateChanges(false);
        dispatch(clearShipmentRerate());
        navigate("/shipments");
      } else if (editShipment.rejected.match(result)) {
        setSaveValidationError(getApiErrorMessage(result.payload, "Unable to save shipment."));
      }
    } catch (error: unknown) {
      if (isMounted.current) setSaveValidationError(getApiErrorMessage(error, "Unable to prepare shipment changes."));
    } finally {
      saveInProgress.current = false;
    }
  };

  const cancelPendingChanges = () => {
    navigate("/shipments");
  };

  const handleRerate = async () => {
    if (rerateInProgress.current) return;
    rerateInProgress.current = true;
    setIsResolvingRatingProfile(true);
    setRerateValidationError(null);

    try {
      const shipmentContext: unknown = location.state;
      const hasMatchingRowContext = shipmentContext !== null
        && typeof shipmentContext === "object"
        && "loadNumber" in shipmentContext
        && shipmentContext.loadNumber === shipment.loadNumber
        && "clientCode" in shipmentContext;
      const clientCode = hasMatchingRowContext
        ? (typeof shipmentContext.clientCode === "string" ? shipmentContext.clientCode.trim() : "")
        : shipment.clientCode?.trim() || "";
      if (!clientCode) {
        throw new Error("A shipment client code is required to re-rate the shipment.");
      }

      const request = dispatch(fetchClientsAndSubclients(clientCode));
      ratingLookupRequest.current = request;
      const clients = await request.unwrap();
      if (!isMounted.current || ratingLookupRequest.current !== request) return;
      ratingLookupRequest.current = null;
      const matchingClient = clients.find((client) => client.clientCode.trim() === clientCode);
      const ratingClientCode = matchingClient?.ratingClientCode?.trim();
      const ratingProfileCode = matchingClient?.ratingProfileCode?.trim();
      if (!ratingClientCode || !ratingProfileCode) {
        throw new Error(`Rating client and profile codes are unavailable for client ${clientCode}.`);
      }

      const payload = createShipmentRerateRequest({
        shipment: { ...shipment, clientCode },
        detailValues: savedDetailValues,
        loadValues: rerateLoadValues,
        ratingClientCode,
        ratingProfileCode,
      });
      const result = await dispatch(rerateShipment(payload));

      if (isMounted.current && rerateShipment.fulfilled.match(result)) {
        setIsRerateModalOpen(true);
      }
    } catch (error: unknown) {
      if (!isMounted.current) return;
      setRerateValidationError(
        error instanceof Error ? error.message
          : typeof error === "string" ? error
          : "Unable to prepare the shipment for re-rating.",
      );
    } finally {
      rerateInProgress.current = false;
      ratingLookupRequest.current = null;
      if (isMounted.current) setIsResolvingRatingProfile(false);
    }
  };

  const handleSelectRerateRate = (selectedRate: CarrierRate) => {
    setCommittedShipment((current) => ({
      ...current, scac: selectedRate.code, sellSCAC: selectedRate.code, sellCarrierName: selectedRate.name,
    }));
    dispatch(selectShipmentRerateRate(selectedRate.id));
    setIsRerateModalOpen(false);
    setActiveTab("Charges");
    setNeedsRerating(false);
    setHasPendingRerateChanges(false);
    setHasUnsavedChanges(true);
  };

  const handleCopyShipment = async () => {
    const bolNoToCopy = (shipment.loadNumber || (shipment as any).bolNo || "").trim();
    if (!bolNoToCopy) {
      messageApi.error("No valid BOL/Load number found to copy.");
      return;
    }

    setIsCopying(true);
    try {
      const res = await dispatch(copyShipment(bolNoToCopy)).unwrap();
      messageApi.success(res.message || "Shipment copied successfully!");
    } catch (err: any) {
      const errMsg =
        typeof err === "string"
          ? err
          : err?.message || "Failed to copy shipment.";
      messageApi.error(errMsg);
    } finally {
      setIsCopying(false);
    }
  };

  const rerateButton = (
    <Button
      loading={rerateLoading || isResolvingRatingProfile}
      disabled={!needsRerating || hasOpenInlineEditor || saving || rerateLoading || isResolvingRatingProfile}
      onClick={handleRerate}>
      Re-Rate
    </Button>
  );

  return (
    <ConfigProvider componentDisabled={saving}>
    <section className='shipment-detail-page'>
      {messageContext}
      <div className='shipment-detail-top'>
        <button type='button' disabled={saving} onClick={() => navigate("/shipments")}>
          ← All Shipments
        </button>
        <div className='shipment-detail-actions'>
          {hasUnsavedChanges || needsRerating ? (
            <div className='shipment-detail-status-messages'>
              {hasUnsavedChanges ? (
                <span
                  className='shipment-detail-unsaved-message'
                  role='status'>
                  Screen has some unsaved data!!
                </span>
              ) : null}
              {needsRerating ? (
                <span
                  className='shipment-detail-rerate-message'
                  role='status'>
                  Shipment Need to be re rated !
                </span>
              ) : null}
            </div>
          ) : null}
          {hasUnsavedChanges ? (
            <>
              <Button
                type='primary'
                loading={saving}
                disabled={hasOpenInlineEditor || needsRerating || hasPendingRerateChanges || rerateLoading || isResolvingRatingProfile}
                onClick={savePendingChanges}>
                Save
              </Button>
              <Button onClick={cancelPendingChanges}>Cancel</Button>
            </>
          ) : null}
          <Button danger>Cancel Shipment</Button>
          <Button loading={isCopying} onClick={handleCopyShipment}>
            Copy Shipment
          </Button>
        </div>
      </div>

      <header className='shipment-detail-header'>
        <div>
          <div className='shipment-detail-title-row'>
            <h1>Shipment: {shipment.loadNumber}</h1>
            <Tag className='shipment-detail-pro'>
              Pro&nbsp;&nbsp;{text(shipment.proNumber)}
            </Tag>
            <Tag color='#a31d14' className='shipment-detail-status'>
              • {text(shipment.bolStatus)}
            </Tag>
          </div>
          <p>
            {carrier} · {text(shipment.equipment || shipment.shipmentMode)} <span />
            Pickup: <strong>{formatApiDate(shipment.pickupdate)}</strong> <span />
            Tendered By: <strong>{text(shipment.orgWhoEntered)}</strong> <span />
            Created By: <strong>{text(shipment.userName)}</strong>
          </p>
        </div>
      </header>

      <Tabs
        className='shipment-detail-tabs'
        activeKey={activeTab}
        items={shipmentDetailTabs}
        animated={{ inkBar: true, tabPane: false }}
        aria-label='Shipment detail tabs'
        tabBarExtraContent={{
          right: rerateButton,
        }}
        onChange={setActiveTab}
      />

      <CarrierRateModal
        open={isRerateModalOpen}
        onClose={() => setIsRerateModalOpen(false)}
        rates={rerateModalRates}
        loading={rerateLoading}
        error={rerateError}
        onSelectRate={handleSelectRerateRate}
        selectedRateId={reratedRate?.id}
        actionLabel='Select'
      />

      {rerateValidationError || rerateError ? (
        <Alert
          type='error'
          showIcon
          title='Unable to re-rate shipment'
          description={rerateValidationError || rerateError}
        />
      ) : null}

      {saveValidationError || editState?.error ? (
        <Alert type='error' showIcon title='Unable to save shipment' description={saveValidationError || editState?.error} />
      ) : null}
      {!hasUnsavedChanges && editState?.successMessage ? (
        <p role='status'>{editState.successMessage}</p>
      ) : null}

      <div className='shipment-detail-layout' inert={saving}>
        <aside className='shipment-detail-left'>
          <div className='shipment-detail-map-card'>
            <ShipmentRouteMap shipment={shipment} />
          </div>

          <article className='shipment-detail-side-card'>
            <DetailField label='Customer' value={customer} />
            <DetailField
              label='Client Email'
              value={displayedDetailValues.clientEmail}
            />
            <DetailField label='Sales Rep' value='' />
            <DetailField label='Sales Group' value='' />
            <div className='shipment-detail-side-card__head'>
              <h3>Reference Numbers</h3>
              {activeTab === "Details" ? (
                <DetailEditActions
                  label='Reference Numbers'
                  isEditing={isReferenceEditing}
                  disabled={
                    activeDetailEditor !== null &&
                    activeDetailEditor !== "referenceNumbers"
                  }
                  onEdit={() => beginDetailsEditing("referenceNumbers")}
                  onSave={saveDetailsEditing}
                  onCancel={cancelDetailsEditing}
                />
              ) : null}
            </div>
            <div className='shipment-detail-reference-fields'>
              <DetailField
                label='BOL:'
                value={referenceDetailValues.referenceBol}
                isEditing={isReferenceEditing}
                onChange={(value) =>
                  updateDraftDetailField("referenceBol", value)
                }
              />
              <DetailField
                label='Carrier Pickup'
                value={referenceDetailValues.referenceCarrierPickup}
                isEditing={isReferenceEditing}
                onChange={(value) =>
                  updateDraftDetailField("referenceCarrierPickup", value)
                }
              />
              <DetailField
                label='Carrier Quote Number'
                value={referenceDetailValues.referenceCarrierQuoteNumber}
                isEditing={false}
                onChange={(value) =>
                  updateDraftDetailField("referenceCarrierQuoteNumber", value)
                }
              />
              <DetailField
                label='Tracking #'
                value={referenceDetailValues.referenceTrackingNumber}
                isEditing={isReferenceEditing}
                onChange={(value) =>
                  updateDraftDetailField("referenceTrackingNumber", value)
                }
              />
              <DetailField
                label='Load'
                value={referenceDetailValues.referenceLoad}
                isEditing={false}
                onChange={(value) =>
                  updateDraftDetailField("referenceLoad", value)
                }
              />
            </div>

            <h3>Booking Info</h3>
            <div className='shipment-detail-booking-fields'>
              <DetailField
                label='Created By'
                value={text(shipment.userName)}
              />
              <DetailField
                label='Tendered By'
                value={text(shipment.orgWhoEntered)}
              />
            </div>
          </article>

        </aside>

        <main className='shipment-detail-main'>
          {activeTab === "Details" && (
            <DetailsTab
              shipment={shipment}
              activeEditor={activeDetailEditor}
              values={displayedDetailValues}
              onFieldChange={updateDraftDetailField}
              onBeginEditing={beginDetailsEditing}
              onSaveEditing={saveDetailsEditing}
              onCancelEditing={cancelDetailsEditing}
            />
          )}
          <div hidden={activeTab !== "Load"}>
            <LoadTab
              key={shipment.loadNumber}
              shipment={shipment}
              onChangeCommitted={markChangesPending}
              onEditorStateChange={handleLoadEditingStateChange}
              onRateInputsChange={setRerateLoadValues}
              onValuesChange={collectLoadValues}
            />
          </div>
          <div hidden={activeTab !== "Charges"}>
            <ChargesTab
              key={shipment.loadNumber}
              shipment={shipment}
              onChangeCommitted={markChangesPending}
              onEditorStateChange={handleChargesEditingStateChange}
              reratedRate={reratedRate}
              onValuesChange={collectChargeValues}
              readOnlyUnsupported
            />
          </div>
          <div hidden={activeTab !== "Tracking"}>
            <TrackingTab
              key={shipment.loadNumber}
              shipment={shipment}
              onChangeCommitted={markChangesPending}
              onEditorStateChange={handleTrackingEditingStateChange}
            />
          </div>
          {activeTab === "Documents" && <DocumentTab />}
          {activeTab === "Audit" && <AuditTab />}
        </main>
      </div>
    </section>
    </ConfigProvider>
  );
}

function ShipmentDetail() {
  const { shipmentId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentShipment, loading, error, requestedLoadNumber } =
    useAppSelector((state) => state.shipment);
  const loadNumber = shipmentId ?? "";

  useEffect(() => {
    if (!loadNumber) return;

    dispatch(clearShipmentRerate());
    dispatch(resetEditShipment());
    const shipmentRequest = dispatch(fetchShipmentByLoadNumber(loadNumber));
    const trackingRequest = dispatch(
      fetchCarrierTracking({ loadNumber }),
    );

    return () => {
      dispatch(resetEditShipment());
      shipmentRequest.abort();
      trackingRequest.abort();
    };
  }, [dispatch, loadNumber]);

  if (loading || (loadNumber && requestedLoadNumber !== loadNumber)) {
    return (
      <section className='shipment-detail-page shipment-detail-page--empty'>
        <Spin size='large' tip={`Loading shipment ${loadNumber}...`} />
      </section>
    );
  }

  if (error) {
    return (
      <section className='shipment-detail-page shipment-detail-page--empty'>
        <Alert
          type='error'
          showIcon
          title='Unable to load shipment'
          description={error}
        />
        <Button
          type='primary'
          onClick={() => dispatch(fetchShipmentByLoadNumber(loadNumber))}>
          Retry
        </Button>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/shipments")}>
          Back to Shipments
        </Button>
      </section>
    );
  }

  if (!currentShipment) {
    return (
      <section className='shipment-detail-page shipment-detail-page--empty'>
        <Empty description='Shipment not found' />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/shipments")}>
          Back to Shipments
        </Button>
      </section>
    );
  }

  return (
    <ShipmentDetailContent
      key={currentShipment.loadNumber}
      shipment={currentShipment}
    />
  );
}

export default ShipmentDetail;
