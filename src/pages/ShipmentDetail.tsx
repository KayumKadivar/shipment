import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Spin, Tabs, Tag, Typography } from "antd";
import {
  GoogleMap,
  PolylineF,
  useLoadScript,
  type Libraries,
} from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AdvancedMapMarker from "../lib/AdvancedMapMarker";
import {
  computeDrivingRoute,
  type ComputedRoute,
  type RouteLocation,
} from "../lib/googleRoutes";
import AuditTab from "../components/shipmentdetail/Audit";
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
import { fetchCarrierTracking } from "../store/carrierTrackingSlice";
import { fetchShipmentByLoadNumber } from "../store/shipmentSlice";
import type { ShipmentDetails } from "../types/shipment.types";

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
              strokeColor: "#d71920",
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
  const [activeTab, setActiveTab] = useState("Details");
  const initialDetailValues = createShipmentDetailEditValues(shipment);
  const [savedDetailValues, setSavedDetailValues] =
    useState<ShipmentDetailEditValues>(initialDetailValues);
  const [draftDetailValues, setDraftDetailValues] =
    useState<ShipmentDetailEditValues>(initialDetailValues);
  const [activeDetailEditor, setActiveDetailEditor] =
    useState<ShipmentDetailEditSection | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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

  const markChangesPending = useCallback(() => {
    setHasUnsavedChanges(true);
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
    const hasChanges = (
      Object.keys(draftDetailValues) as Array<keyof ShipmentDetailEditValues>
    ).some((field) => draftDetailValues[field] !== savedDetailValues[field]);

    setSavedDetailValues({ ...draftDetailValues });
    setActiveDetailEditor(null);
    if (hasChanges) markChangesPending();
  };

  const cancelDetailsEditing = () => {
    setDraftDetailValues({ ...savedDetailValues });
    setActiveDetailEditor(null);
  };

  const savePendingChanges = () => {
    setHasUnsavedChanges(false);
  };

  const cancelPendingChanges = () => {
    navigate("/shipments");
  };

  return (
    <section className='shipment-detail-page'>
      <div className='shipment-detail-top'>
        <button type='button' onClick={() => navigate("/shipments")}>
          ← All Shipments
        </button>
        <div className='shipment-detail-actions'>
          {hasUnsavedChanges ? (
            <>
              <span
                className='shipment-detail-unsaved-message'
                role='status'>
                Screen has some unsaved data!!
              </span>
              <Button
                type='primary'
                disabled={hasOpenInlineEditor}
                onClick={savePendingChanges}>
                Save
              </Button>
              <Button onClick={cancelPendingChanges}>Cancel</Button>
            </>
          ) : null}
          <Button danger>Cancel Shipment</Button>
          <Button>Copy Quote</Button>
        </div>
      </div>

      <header className='shipment-detail-header'>
        <div>
          <div className='shipment-detail-title-row'>
            <h1>Shipment: {shipment.loadNumber}</h1>
            <Tag className='shipment-detail-pro'>
              Pro&nbsp;&nbsp;{text(shipment.proNumber)}
            </Tag>
            <Tag color='red' className='shipment-detail-status'>
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
        onChange={setActiveTab}
      />

      <div className='shipment-detail-layout'>
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
                isEditing={isReferenceEditing}
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
                isEditing={isReferenceEditing}
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
            />
          </div>
          <div hidden={activeTab !== "Charges"}>
            <ChargesTab
              key={shipment.loadNumber}
              shipment={shipment}
              onChangeCommitted={markChangesPending}
              onEditorStateChange={handleChargesEditingStateChange}
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

    const shipmentRequest = dispatch(fetchShipmentByLoadNumber(loadNumber));
    const trackingRequest = dispatch(
      fetchCarrierTracking({ loadNumber }),
    );

    return () => {
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
