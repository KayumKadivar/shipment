import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setProductItems, addProductRow, removeProductRow, updateProductRow, setWeightUnit, resetProductItems, type ProductItem } from '../../store/productSlice';
import { setSelectedAccessorials, fetchAccessorials, clearSelectedAccessorials } from '../../store/accessorialsSlice';
import { fetchCarrierRates, clearRateError } from '../../store/customerRateSlice';
import {
  Button, Card, Input, Segmented, Checkbox, Select,
  Row, Col, Flex, message, Spin,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import './newshipment.css';
import OriginLocation from './OriginLocation';
import DestinationLocation from './DestinationLocation';
import ShipmentInformation from './ShipmentInformation';
import Accessorials from './Accessorials';
import CustomerRate from './CustomerRate';
import CarrierRateModal from './CarrierRateModal';
import type { CarrierRate } from '../../pages/Rate';
import BillToLocation from './BillToLocation';
import InternalNotes from './InternalNotes';
import InsuranceInfo from './InsuranceInfo';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_CLIENT_CODE, SRV_TOKEN } from '../../config/apiConfig';

const handlingUnitOptions = ["Pallet", "Crate", "Carton", "Drum", "Piece", "Box"].map(
  (value) => ({ value, label: value })
);

const classOptions = [
  "50", "55", "60", "65", "70", "77.5", "85", "92.5", "100",
  "110", "125", "150", "175", "200", "250", "300", "400", "500",
].map((value) => ({ value, label: value }));

const formatNMFC = (raw: string): string => {
  const cleaned = raw.replace(/[^\d-]/g, "");
  const digits = cleaned.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 6) {
    if (digits.length === 6 && cleaned.includes("-")) {
      return `${digits}-`;
    }
    return digits;
  }
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}`;
};

const isValidNMFC = (val: string): boolean => {
  if (!val || val.trim() === "") return false;
  return /^\d{6}-\d{2}$/.test(val.trim());
};

const NewShipment: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();

  const prefillData = (location.state as any) || null;
  const quote = prefillData?.quote;
  const selectedCarrier = prefillData?.selectedCarrier;
  const reference = prefillData?.reference;

  const { data: accessorialsList = [], selectedAccessorialIds = [] } = useAppSelector((state) => state.accessorials);

  // Manage multiple product lines from Redux
  const items = useAppSelector((state) => state.product.items);
  const weightUnit = useAppSelector((state) => state.product.weightUnit);
  const [touchedNMFC, setTouchedNMFC] = useState<Record<string, boolean>>({});
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Carrier rate modal state
  const ratesFromStore = useAppSelector((state) => state.customerRate.rates) as CarrierRate[];
  const ratesLoading = useAppSelector((state) => state.customerRate.loading);
  const rateError = useAppSelector((state) => state.customerRate.error);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [selectedCarrierRate, setSelectedCarrierRate] = useState<CarrierRate | null>(null);

  useEffect(() => {
    dispatch(clearRateError());
    return () => {
      dispatch(clearRateError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  useEffect(() => {
    const productsSource = (quote?.quoteProducts && quote.quoteProducts.length > 0)
      ? quote.quoteProducts
      : (quote?.shipments && quote.shipments.length > 0 ? quote.shipments : null);

    if (productsSource && productsSource.length > 0) {
      const mapped: ProductItem[] = productsSource.map((p: any, idx: number) => {
        const rawPackage = String(p.packagingGroup || p.packageType || p.handlingUnit || "").trim();
        const matchedPackage = handlingUnitOptions.find(
          (opt) => opt.value.toLowerCase() === rawPackage.toLowerCase()
        );
        const packageType = matchedPackage ? matchedPackage.value : (rawPackage.toUpperCase() === "PLT" ? "Pallet" : rawPackage);

        const lengthVal = (p.length != null && p.length !== 0 && p.length !== "0") ? p.length : "";
        const widthVal = (p.width != null && p.width !== 0 && p.width !== "0") ? p.width : "";
        const heightVal = (p.height != null && p.height !== 0 && p.height !== "0") ? p.height : "";
        const weightVal = (p.weight != null && p.weight !== 0 && p.weight !== "0") ? p.weight : "";
        const pcfDensityVal = p.density ?? p.pcfDensity ?? "";

        return {
          id: String(p.quoteProductId ?? (idx + 1)),
          pallets: (p.pallets != null && p.pallets !== 0 && p.pallets !== "0") ? p.pallets : (p.units != null && p.units !== 0 ? p.units : (p.pieces != null && p.pieces !== 0 ? p.pieces : "")),
          pieces: (p.pieces != null && p.pieces !== 0 && p.pieces !== "0") ? p.pieces : (p.units != null && p.units !== 0 ? p.units : (p.pallets != null && p.pallets !== 0 ? p.pallets : "")),
          packageType: packageType,
          description: p.description || "",
          stackable: p.stackable ?? p.isStackable ?? false,
          hazmat: p.isHazmat ?? p.hazmat ?? p.hazMat ?? false,
          nmfc: p.productNMFC || p.nmfc || "",
          length: lengthVal,
          width: widthVal,
          height: heightVal,
          pcfDensity: pcfDensityVal,
          class: p.productClass ? String(p.productClass) : (p.class ? String(p.class) : (p.freightClass ? String(p.freightClass) : "")),
          weight: weightVal,
          hazmatClass: p.hazmatClass || p.hazMatClass || "",
          hazmatUN: p.hazmatUN || p.hazMatUN || "",
        };
      });
      dispatch(setProductItems(mapped));
    } else {
      dispatch(resetProductItems());
    }
  }, [quote, dispatch]);

  useEffect(() => {
    if (quote?.quoteAccessorials && quote.quoteAccessorials.length > 0 && accessorialsList.length > 0) {
      const quoteAccCodes = quote.quoteAccessorials.map((a: any) => String(a.accCode || "").toUpperCase());
      const matched = accessorialsList
        .filter((item) => {
          const c = String(item.accesorialCode || "").toUpperCase();
          const n = String(item.accessorialName || "").toUpperCase();
          return quoteAccCodes.includes(c) || quoteAccCodes.includes(n);
        })
        .map((item) => item.accessorialID);
      if (matched.length > 0) {
        dispatch(setSelectedAccessorials(matched));
      } else {
        dispatch(clearSelectedAccessorials());
      }
    } else {
      dispatch(clearSelectedAccessorials());
    }
  }, [quote, accessorialsList, dispatch]);

  const [originData, setOriginData] = useState<any>(() => {
    return {
      companyName: "",
      address1: "",
      address2: "",
      postal: quote?.originZip || "",
      city: quote?.originCity || "",
      state: quote?.originStateCode || "",
      country: quote?.originCountry || "USA",
      pickupDate: quote?.pickupDate ? new Date(quote.pickupDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "",
      expPickupDate: quote?.pickupDate ? new Date(quote.pickupDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "",
    };
  });

  const [destinationData, setDestinationData] = useState<any>(() => {
    return {
      companyName: "",
      address1: "",
      address2: "",
      postal: quote?.destinationZip || "",
      city: quote?.destinationCity || "",
      state: quote?.destinationStateCode || "",
      country: quote?.destinationCountry || "USA",
    };
  });

  const [originLocationsList, setOriginLocationsList] = useState<any[]>([]);
  const [destinationLocationsList, setDestinationLocationsList] = useState<any[]>([]);
  const [loadingOrigin, setLoadingOrigin] = useState<boolean>(() => Boolean((quote?.originZip || "").split(' - ')[0].trim()));
  const [loadingDestination, setLoadingDestination] = useState<boolean>(() => Boolean((quote?.destinationZip || "").split(' - ')[0].trim()));
  const searchedZipsRef = useRef<{ origin?: string; destination?: string }>({});

  useEffect(() => {
    const fetchLocationsData = async () => {
      const origZip = (quote?.originZip || "").split(' - ')[0].trim();
      const destZip = (quote?.destinationZip || "").split(' - ')[0].trim();
      const clientCode = quote?.clientCode || sessionStorage.getItem("customerLocation_selectedClientCode") || sessionStorage.getItem("quotes_selectedClientCode") || DEFAULT_CLIENT_CODE || "Devts";

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Call SearchLocations API for Origin (prevent duplicate calls)
      if (origZip && searchedZipsRef.current.origin !== origZip) {
        searchedZipsRef.current.origin = origZip;
        setLoadingOrigin(true);
        try {
          const payload = {
            clientCode,
            searchText: origZip,
            pageNumber: 1,
            pageSize: 20,
          };
          console.log("Calling SearchLocations API for Origin:", payload);
          const response = await axios.post(
            `${API_BASE_URL}/Location/SearchLocations`,
            payload,
            { headers }
          );
          console.log("SearchLocations API Origin response:", response.data);

          if (response.data?.isSuccess && response.data?.data) {
            let dataList = response.data.data;
            if (!Array.isArray(dataList) && dataList.items) {
              dataList = dataList.items;
            }
            if (Array.isArray(dataList) && dataList.length > 0) {
              setOriginLocationsList(dataList);
              const matched = dataList.find(
                (loc: any) => String(loc.zipCode || "").trim() === origZip
              ) || dataList[0];

              if (matched) {
                setOriginData((prev: any) => ({
                  ...prev,
                  locationId: matched.locationId,
                  companyName: matched.locationName || prev?.companyName || "",
                  address1: matched.address1 || prev?.address1 || "",
                  address2: matched.address2 || prev?.address2 || "",
                  city: matched.city || prev?.city || "",
                  state: matched.stateCode || prev?.state || "",
                  country: matched.countryCode || prev?.country || "USA",
                  postal: matched.zipCode || prev?.postal || origZip,
                  contactName: matched.contactName || prev?.contactName || "",
                  phone: matched.contactPhone || prev?.phone || "",
                  email: matched.contactEmail || prev?.email || "",
                  openTime: matched.openTime || prev?.openTime || undefined,
                  closeTime: matched.closeTime || prev?.closeTime || undefined,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Error fetching SearchLocations for origin:", error);
        } finally {
          setLoadingOrigin(false);
        }
      } else {
        setLoadingOrigin(false);
      }

      // Call SearchLocations API for Destination (prevent duplicate calls)
      if (destZip && searchedZipsRef.current.destination !== destZip) {
        searchedZipsRef.current.destination = destZip;
        setLoadingDestination(true);
        try {
          const payload = {
            clientCode,
            searchText: destZip,
            pageNumber: 1,
            pageSize: 20,
          };
          console.log("Calling SearchLocations API for Destination:", payload);
          const response = await axios.post(
            `${API_BASE_URL}/Location/SearchLocations`,
            payload,
            { headers }
          );
          console.log("SearchLocations API Destination response:", response.data);

          if (response.data?.isSuccess && response.data?.data) {
            let dataList = response.data.data;
            if (!Array.isArray(dataList) && dataList.items) {
              dataList = dataList.items;
            }
            if (Array.isArray(dataList) && dataList.length > 0) {
              setDestinationLocationsList(dataList);
              const matched = dataList.find(
                (loc: any) => String(loc.zipCode || "").trim() === destZip
              ) || dataList[0];

              if (matched) {
                setDestinationData((prev: any) => ({
                  ...prev,
                  locationId: matched.locationId,
                  companyName: matched.locationName || prev?.companyName || "",
                  address1: matched.address1 || prev?.address1 || "",
                  address2: matched.address2 || prev?.address2 || "",
                  city: matched.city || prev?.city || "",
                  state: matched.stateCode || prev?.state || "",
                  country: matched.countryCode || prev?.country || "USA",
                  postal: matched.zipCode || prev?.postal || destZip,
                  contactName: matched.contactName || prev?.contactName || "",
                  phone: matched.contactPhone || prev?.phone || "",
                  email: matched.contactEmail || prev?.email || "",
                  openTime: matched.openTime || prev?.openTime || undefined,
                  closeTime: matched.closeTime || prev?.closeTime || undefined,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Error fetching SearchLocations for destination:", error);
        } finally {
          setLoadingDestination(false);
        }
      } else {
        setLoadingDestination(false);
      }
    };

    fetchLocationsData();
  }, [quote]);

  const shipmentInfoData = {
    serviceLevel: selectedCarrier?.service || "",
    customerRef: String(reference || quote?.quoteRequestId || ""),
    mode: quote?.mode || "",
  };

  const rawCarrier = selectedCarrierRate || prefillData?.selectedCarrier || prefillData?.rate || quote?.selectedCarrier || quote?.quoteResults?.[0];

  const handleSelectRateFromModal = (rate: CarrierRate) => {
    setSelectedCarrierRate(rate);
    setIsRateModalOpen(false);
    message.success(`Selected carrier: ${rate.name || rate.code} ($${Number(rate.price).toFixed(2)})`);
  };

  const carrierRateData = useMemo(() => {
    if (!rawCarrier) return undefined;

    let grossCharge = Number(rawCarrier.grossCharge) || 0;
    let discount = Number(rawCarrier.discount) || 0;
    let fuelSurcharge = Number(rawCarrier.fuelSurcharge) || 0;
    const accessorialCharges: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[] = [];

    const costDetails = rawCarrier.quoteCostDetails || rawCarrier.costDetails;
    if (Array.isArray(costDetails) && costDetails.length > 0) {
      costDetails.forEach((cd: any) => {
        const code = (cd.accCode || cd.code || "").trim().toUpperCase();
        const name = (cd.accName || cd.name || cd.description || "").trim().toLowerCase();
        const amount = Number(cd.amount ?? cd.charge) || 0;

        if (code === "GROSS" || name.includes("gross") || name.includes("freight")) {
          grossCharge = amount;
        } else if (code === "DISC" || name.includes("discount")) {
          discount = amount;
        } else if (code === "FUEL" || name.includes("fuel")) {
          fuelSurcharge = amount;
        } else {
          accessorialCharges.push({
            code: cd.accCode || cd.code || "ACC",
            accessorialDescription: cd.accName || cd.name || cd.description || "Accessorial",
            accessorialCharge: amount,
          });
        }
      });
    } else if (Array.isArray(rawCarrier.accessorialCharges)) {
      rawCarrier.accessorialCharges.forEach((ac: any) => {
        accessorialCharges.push({
          code: ac.code || ac.accessorialCode || "ACC",
          accessorialDescription: ac.accessorialDescription || ac.description || ac.accName || "Accessorial",
          accessorialCharge: Number(ac.accessorialCharge ?? ac.amount) || 0,
        });
      });
    }

    const price = Number(rawCarrier.price) || Number(rawCarrier.totalShipmentCost) || Number(rawCarrier.netCharge) || 0;
    if (!grossCharge && price > 0) {
      grossCharge = price;
    }

    return {
      carrierName: rawCarrier.name || rawCarrier.carrierName || "",
      carrierCode: rawCarrier.code || rawCarrier.scac || "",
      service: rawCarrier.service || rawCarrier.serviceLevel || "",
      price: price > 0 ? price : (grossCharge - discount + fuelSurcharge),
      grossCharge,
      discount,
      fuelSurcharge,
      accessorialCharges,
    };
  }, [rawCarrier]);

  const handleFetchRatesForShipment = async () => {
    const origZip = (originData?.postal || quote?.originZip || "").split(' - ')[0].trim();
    const destZip = (destinationData?.postal || quote?.destinationZip || "").split(' - ')[0].trim();

    if (!origZip || !destZip) {
      message.warning("Please provide Origin and Destination ZIP codes before rating.");
      return;
    }

    if (!items || items.length === 0) {
      message.warning("Please add at least one product line before rating.");
      return;
    }

    const shipments = items.map((i) => ({
      class: String(i.class || 50),
      weight: Number(i.weight) || 0,
      weightUnit: weightUnit || "Lbs",
      units: Number(i.pallets) || 1,
      cubicFeet: 0,
      hazMat: Boolean(i.hazmat),
      hazMatClass: i.hazmatClass || undefined,
      hazMatUN: i.hazmatUN || undefined,
      nmfc: i.nmfc || undefined,
      description: i.description || "Freight",
      pallets: i.packageType === "Pallet" ? Number(i.pallets) || 1 : 0,
      pieces: Number(i.pieces) || 1,
      length: Number(i.length) || 0,
      width: Number(i.width) || 0,
      height: Number(i.height) || 0,
      packageType: i.packageType || "Pallet",
      linearFeet: 0,
      stackable: Boolean(i.stackable),
    }));

    const accessorialCodes = (accessorialsList || [])
      .filter((a: any) => (selectedAccessorialIds || []).includes(a.accessorialId))
      .map((a: any) => a.accesorialCode || a.accessorialName);

    const payload = {
      serviceToken: SRV_TOKEN,
      origZip,
      origCity: originData?.city || quote?.originCity || "",
      origState: originData?.state || quote?.originStateCode || "",
      origCountry: originData?.country || quote?.originCountry || "USA",
      destZip,
      destCity: destinationData?.city || quote?.destinationCity || "",
      destState: destinationData?.state || quote?.destinationStateCode || "",
      destCountry: destinationData?.country || quote?.destinationCountry || "USA",
      shipments,
      accessorialCodes,
      profileCode: quote?.profileCode,
      clientCode: quote?.clientCode || DEFAULT_CLIENT_CODE,
      clientName: quote?.clientName || "",
      scac: undefined,
      shipmentDate: new Date().toISOString(),
      zoneCode: undefined,
      miles: 0,
      isBatch: false,
      serviceLevelCode: undefined,
      route: undefined,
      clientResponseUrl: undefined,
      requestId: undefined,
      clientToken: undefined,
      mode: "LTL",
      isRateApiOnly: false,
      getBenchMarkCost: false,
      resultCount: 0,
      totalLength: 0,
      totalWidth: 0,
      totalHeight: 0,
      isAudit: false,
      shipmentValue: 0,
      originPortCode: undefined,
      destPortCode: undefined,
      equipment: undefined,
      codAmount: 0,
      totalLinearFeet: 0,
    };

    try {
      const res = await dispatch(fetchCarrierRates(payload));
      if (fetchCarrierRates.fulfilled.match(res)) {
        const rates = res.payload;
        if (!rates || rates.length === 0) {
          message.warning("No carrier rates returned from the API for the selected route.");
        } else {
          message.success("Carrier rates updated successfully.");
          setIsRateModalOpen(true);
        }
      } else {
        const errorMsg = (res.payload as string) || res.error?.message || "Failed to fetch rates from carrier service.";
        message.error(errorMsg);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err?.message || "Error fetching rates.");
    }
  };

  const handleAddLine = () => {
    dispatch(addProductRow());
  };

  const handleRemoveLine = (idToRemove: string) => {
    if (items.length > 1) {
      dispatch(removeProductRow(idToRemove));
    }
  };

  const handleUpdateField = (id: string, field: keyof ProductItem, value: any) => {
    if (field === 'stackable') {
      const isStackable = Boolean(value);
      dispatch(updateProductRow({ id, field: 'stackable', value: isStackable }));
      if (isStackable) {
        dispatch(updateProductRow({ id, field: 'hazmat', value: false }));
        dispatch(updateProductRow({ id, field: 'hazmatClass', value: '' }));
        dispatch(updateProductRow({ id, field: 'hazmatUN', value: '' }));
      }
      return;
    }
    if (field === 'hazmat') {
      const isHazmat = Boolean(value);
      dispatch(updateProductRow({ id, field: 'hazmat', value: isHazmat }));
      if (isHazmat) {
        dispatch(updateProductRow({ id, field: 'stackable', value: false }));
      } else {
        dispatch(updateProductRow({ id, field: 'hazmatClass', value: '' }));
        dispatch(updateProductRow({ id, field: 'hazmatUN', value: '' }));
      }
      return;
    }
    dispatch(updateProductRow({ id, field, value }));
  };

  const validateProductItems = (): boolean => {
    setFormSubmitted(true);
    for (const item of items) {
      if (!item.pallets || Number(item.pallets) <= 0) {
        message.error("Units is required and must be greater than 0.");
        return false;
      }
      if (!item.packageType) {
        message.error("Handling Unit is required.");
        return false;
      }
      if (!item.pieces || Number(item.pieces) <= 0) {
        message.error("Pieces is required and must be greater than 0.");
        return false;
      }
      if (!item.weight || Number(item.weight) <= 0) {
        message.error(`Weight [${weightUnit.toLowerCase()}] is required and must be greater than 0.`);
        return false;
      }
      if (!item.class) {
        message.error("Class is required.");
        return false;
      }
      if (!item.nmfc || !isValidNMFC(item.nmfc)) {
        setTouchedNMFC((prev) => ({ ...prev, [item.id]: true }));
        message.error(
          !item.nmfc
            ? "NMFC is required for all items (format: XXXXXX-XX, e.g. 123456-01)."
            : `NMFC "${item.nmfc}" is invalid. Must be in 6 digit - 2 digit format (XXXXXX-XX, e.g. 123456-01).`
        );
        return false;
      }
      if (item.hazmat) {
        if (!item.hazmatClass) {
          message.error("Hazmat Class is required when Hazmat is selected.");
          return false;
        }
        if (!item.hazmatUN) {
          message.error("Hazmat UN is required when Hazmat is selected.");
          return false;
        }
      }
    }
    return true;
  };

  const hasHazmat = items.some((i) => i.hazmat);
  const totalPallets = items.reduce((sum, item) => sum + (Number(item.pallets) || 0), 0);
  const totalPieces = items.reduce((sum, item) => sum + (Number(item.pieces) || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  const isPageLoading = Boolean(loadingOrigin || loadingDestination || ratesLoading);

  return (
    <div className="new-shipment-container">

      {/* ══ FULL PAGE LOADER ══ */}
      <Spin
        fullscreen
        spinning={isPageLoading}
        size="large"
        className="ns-fullscreen-spin"
      />

      {/* ── PAGE HEADER ── */}
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="ns-page-header">
        <div>
          <h1 className="ns-page-title">New Shipment</h1>
          <Flex align="center" gap={10} >
            <span>Client:</span>
            <strong>{quote?.clientName || ""}</strong>
            <span className='ns-credit-limit'>Credit limit: $0</span>
          </Flex>
        </div>
        <Flex gap={12}>
          <Button danger onClick={() => navigate('/shipments')}>Cancel</Button>
          <Button onClick={() => { if (!validateProductItems()) return; }}>Save Quote</Button>
          <Button type="primary" danger onClick={() => { if (!validateProductItems()) return; }}>Save Shipment</Button>
        </Flex>
      </Flex>

      {/* ══ Top Layout ══ */}
      <Row gutter={[16, 16]} align="stretch" className="ns-top-row">
        <Col xs={24} xl={16}>
          <Flex vertical gap={16} className="ns-left-col">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <OriginLocation
                  initialData={originData}
                  locationsList={originLocationsList}
                  loading={loadingOrigin}
                />
              </Col>
              <Col xs={24} md={12}>
                <DestinationLocation
                  initialData={destinationData}
                  locationsList={destinationLocationsList}
                  loading={loadingDestination}
                />
              </Col>
            </Row>
            <Card
              title={
                <Flex align="center" gap={8}>
                  Notes <DownOutlined className="ns-notes-icon" />
                </Flex>
              }
              className="notes-panel"
            >
              <Input.TextArea
                placeholder="Add shipment notes, special instructions, or internal comments..."
                className="notes-textarea"
              />
            </Card>
          </Flex>
        </Col>

        <Col xs={24} xl={8}>
          <Flex vertical gap={16}>
            <ShipmentInformation initialData={shipmentInfoData} />
            <Accessorials />
          </Flex>
        </Col>
      </Row>

      {/* ══ Product Table ══ */}
      <Card
        title="Product"
        className="product-panel ns-product-card"
        extra={
          <Flex align="center" gap={8} className="ns-product-extra">
            <span>Weight Unit</span>
            <Segmented 
              options={['Lbs', 'Kgs']} 
              value={weightUnit} 
              onChange={(val) => dispatch(setWeightUnit(val as "Lbs" | "Kgs"))} 
            />
          </Flex>
        }
      >
        <div className="shipment-product-table">
          <div className={`shipment-product-table__head ${hasHazmat ? 'has-hazmat' : ''}`}>
            <span>Units <em>*</em></span>
            <span>Handling Unit <em>*</em></span>
            <span>Pieces <em>*</em></span>
            <span>Weight [{weightUnit.toLowerCase()}] <em>*</em></span>
            <span>Class <em>*</em></span>
            <span>Dimensions [in]</span>
            <span>PCF/Density</span>
            <span>NMFC <em>*</em></span>
            <span>Description</span>
            <span className="col-center">Stackable</span>
            <span className="col-center">Hazmat</span>
            {hasHazmat && (
              <>
                <span>Hazmat Class <em>*</em></span>
                <span>Hazmat UN <em>*</em></span>
              </>
            )}
            <span />
          </div>

          {items.map((item) => (
            <div key={item.id} className={`shipment-product-item-row ${hasHazmat ? 'has-hazmat' : ''}`}>
              <div>
                <Input
                  value={item.pallets ?? ''}
                  status={formSubmitted && (!item.pallets || Number(item.pallets) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'pallets', e.target.value)}
                />
                {formSubmitted && (!item.pallets || Number(item.pallets) <= 0) && (
                  <div className="ns-field-error">Units is required</div>
                )}
              </div>

              <div>
                <Select
                  value={item.packageType || undefined}
                  placeholder="Package"
                  options={handlingUnitOptions}
                  status={formSubmitted && !item.packageType ? 'error' : undefined}
                  onChange={(val) => handleUpdateField(item.id, 'packageType', val)}
                />
                {formSubmitted && !item.packageType && (
                  <div className="ns-field-error">Handling unit is required</div>
                )}
              </div>

              <div>
                <Input
                  value={item.pieces ?? ''}
                  status={formSubmitted && (!item.pieces || Number(item.pieces) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'pieces', e.target.value)}
                />
                {formSubmitted && (!item.pieces || Number(item.pieces) <= 0) && (
                  <div className="ns-field-error">Pieces is required</div>
                )}
              </div>

              <div>
                <Input
                  value={item.weight ?? ''}
                  status={formSubmitted && (!item.weight || Number(item.weight) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'weight', e.target.value)}
                />
                {formSubmitted && (!item.weight || Number(item.weight) <= 0) && (
                  <div className="ns-field-error">Weight is required</div>
                )}
              </div>

              <div>
                <Select
                  value={item.class ? String(item.class) : undefined}
                  placeholder="Class"
                  options={classOptions}
                  status={formSubmitted && !item.class ? 'error' : undefined}
                  onChange={(val) => handleUpdateField(item.id, 'class', val)}
                />
                {formSubmitted && !item.class && (
                  <div className="ns-field-error">Class is required</div>
                )}
              </div>

              <div className="quote-item-combined quote-item-combined--dimensions">
                <Input
                  placeholder="L"
                  value={item.length ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'length', e.target.value)}
                />
                <Input
                  placeholder="W"
                  value={item.width ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'width', e.target.value)}
                />
                <Input
                  placeholder="H"
                  value={item.height ?? ''}
                  onChange={(e) => handleUpdateField(item.id, 'height', e.target.value)}
                />
              </div>

              <Input
                placeholder="PCF/Density"
                value={item.pcfDensity ?? ''}
                onChange={(e) => handleUpdateField(item.id, 'pcfDensity', e.target.value)}
              />

              <div>
                <Input
                  placeholder="XXXXXX-XX"
                  maxLength={9}
                  status={
                    ((formSubmitted || touchedNMFC[item.id]) && (!item.nmfc || !isValidNMFC(item.nmfc))) ||
                    (item.nmfc && !isValidNMFC(item.nmfc) && (touchedNMFC[item.id] || formSubmitted || item.nmfc.length >= 9))
                      ? "error"
                      : undefined
                  }
                  value={item.nmfc || ''}
                  onBlur={() => {
                    setTouchedNMFC((prev) => ({ ...prev, [item.id]: true }));
                  }}
                  onChange={(e) => handleUpdateField(item.id, 'nmfc', formatNMFC(e.target.value))}
                />
                {(formSubmitted || touchedNMFC[item.id]) && !item.nmfc ? (
                  <div className="ns-field-error">NMFC is required</div>
                ) : item.nmfc && !isValidNMFC(item.nmfc) && (touchedNMFC[item.id] || formSubmitted || item.nmfc.length >= 9) ? (
                  <div className="ns-field-error">NMFC is invalid</div>
                ) : null}
              </div>

              <Input
                placeholder="Description"
                value={item.description || ''}
                onChange={(e) => handleUpdateField(item.id, 'description', e.target.value)}
              />

              <div className="col-center">
                <Checkbox
                  checked={item.stackable}
                  onChange={(e) => handleUpdateField(item.id, 'stackable', e.target.checked)}
                />
              </div>

              <div className="col-center">
                <Checkbox
                  checked={item.hazmat}
                  onChange={(e) => handleUpdateField(item.id, 'hazmat', e.target.checked)}
                />
              </div>

              {hasHazmat && (
                item.hazmat ? (
                  <>
                    <div>
                      <Input
                        placeholder="Class"
                        value={item.hazmatClass || ''}
                        status={formSubmitted && !item.hazmatClass ? 'error' : undefined}
                        onChange={(e) => handleUpdateField(item.id, 'hazmatClass', e.target.value)}
                      />
                      {formSubmitted && !item.hazmatClass && (
                        <div className="ns-field-error">Hazmat Class is required</div>
                      )}
                    </div>

                    <div>
                      <Input
                        placeholder="UN"
                        value={item.hazmatUN || ''}
                        status={formSubmitted && !item.hazmatUN ? 'error' : undefined}
                        onChange={(e) => handleUpdateField(item.id, 'hazmatUN', e.target.value)}
                      />
                      {formSubmitted && !item.hazmatUN && (
                        <div className="ns-field-error">Hazmat UN is required</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                  </>
                )
              )}
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveLine(item.id)}
                disabled={items.length === 1}
              />
            </div>
          ))}

          <div className="shipment-product-summary-row">
            <div><span>Total Units:</span> <strong>{totalPallets}</strong></div>
            <div><span>Total Pieces:</span> <strong>{totalPieces}</strong></div>
            <div><span>Total Weight:</span> <strong>{totalWeight}</strong> {weightUnit.toLowerCase()}</div>
          </div>

          <div className="ns-add-line-wrap">
            <Button
              className="quote-add-item"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddLine}
            >
              Add Line
            </Button>
          </div>
        </div>
      </Card>

      {/* ══ Bottom 4-cell grid ══ */}
      <Row gutter={[16, 16]} align="stretch" className="ns-bottom-row">
        <Col xs={24} xl={16}><CustomerRate carrierData={carrierRateData} onRate={handleFetchRatesForShipment} loadingRate={ratesLoading} /></Col>
        <Col xs={24} xl={8}><BillToLocation clientCode={quote?.clientCode} /></Col>

        <Col xs={24} xl={16}><InsuranceInfo /></Col>

        <Col xs={24} xl={8} className="ns-internal-col">
          <InternalNotes />
        </Col>
      </Row>

      {/* ══ Carrier Rate Modal Popup (Image 2 UI) ══ */}
      <CarrierRateModal
        open={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        rates={ratesFromStore}
        loading={ratesLoading}
        error={rateError}
        onSelectRate={handleSelectRateFromModal}
        selectedRateId={selectedCarrierRate?.id}
      />

      {/* ══ FOOTER BUTTONS ══ */}
      <Flex justify="flex-end" gap={12} wrap="wrap">
        <Button onClick={() => navigate('/shipments')} className="btn-outline">✕ Close</Button>
        <Button className="btn-outline" onClick={() => { if (!validateProductItems()) return; }}>Save Quote</Button>
        <Button type="primary" danger onClick={() => { if (!validateProductItems()) return; }}>Save Shipment</Button>
      </Flex>

    </div>
  );
};

export default NewShipment;
