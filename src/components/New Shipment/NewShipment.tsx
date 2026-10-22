import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setProductItems, addProductRow, removeProductRow, updateProductRow, updateProductHazmat, setWeightUnit, resetProductItems, type ProductItem } from '../../store/productSlice';
import { setSelectedAccessorials, fetchAccessorials, clearSelectedAccessorials } from '../../store/accessorialsSlice';
import { fetchCarrierRates, clearRateError } from '../../store/customerRateSlice';
import {
  Button, Card, Input, Segmented, Checkbox, Select,
  Row, Col, Flex, message, Spin, AutoComplete, Tooltip, Modal, Form,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DeleteOutlined, PlusOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';
import { fetchClientsAndSubclients } from '../../store/customerLocationSlice';
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
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import { calculatePCF } from '../../utils/calculatePCF';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_CLIENT_CODE, SRV_TOKEN } from '../../config/apiConfig';

const handlingUnitOptions = ["Pallet", "Crate", "Carton", "Drum", "Piece", "Box"].map(
  (value) => ({ value, label: value })
);

const classOptions = [
  "50", "55", "60", "65", "70", "77.5", "85", "92.5", "100",
  "110", "125", "150", "175", "200", "250", "300", "400", "500",
].map((value) => ({ value, label: value }));

interface ShipmentPrefillProduct {
  quoteProductId?: string | number;
  packagingGroup?: string;
  packageType?: string;
  handlingUnit?: string;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  weight?: string | number;
  density?: string | number;
  pcfDensity?: string | number;
  pallets?: string | number;
  units?: string | number;
  pieces?: string | number;
  description?: string;
  stackable?: boolean;
  isStackable?: boolean;
  isHazmat?: boolean;
  hazmat?: boolean;
  hazMat?: boolean;
  productNMFC?: string;
  nmfc?: string;
  productClass?: string | number;
  class?: string | number;
  freightClass?: string | number;
  hazmatClass?: string;
  hazMatClass?: string;
  hazmatUN?: string;
  hazMatUN?: string;
  hazmatProperShippingName?: string;
  hazMatProperShippingName?: string;
  hazmatPackingGroup?: string;
  hazMatPackingGroup?: string;
  hazmatGroup?: string;
  hazmatPhone?: string;
  hazMatPhone?: string;
  hazmatContact?: string;
  hazMatContact?: string;
  hazmatContactName?: string;
}

interface ShipmentPrefillQuote {
  quoteRequestId?: string | number;
  quoteProducts?: ShipmentPrefillProduct[];
  shipments?: ShipmentPrefillProduct[];
  quoteAccessorials?: Array<{ accCode?: string }>;
  clientName?: string;
  clientCode?: string;
  clientAddress1?: string;
  clientAddress2?: string;
  clientCountryCode?: string;
  clientCityName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientStateCode?: string;
  clientZipCode?: string;
  profileCode?: string;
  originZip?: string;
  originCity?: string;
  originStateCode?: string;
  originCountry?: string;
  pickupDate?: string;
  destinationZip?: string;
  destinationCity?: string;
  destinationStateCode?: string;
  destinationCountry?: string;
  mode?: string;
  equipment?: string;
  paymentTerms?: string;
  selectedCarrier?: ShipmentPrefillCarrier;
  quoteResults?: ShipmentPrefillCarrier[];
  rate?: ShipmentPrefillCarrier;
  carrierNote?: string;
  specialNotes?: string;
}

interface ShipmentPrefillCarrier {
  name?: string;
  code?: string;
  service?: string;
  price?: number;
  grossCharge?: number;
  discount?: number;
  fuelSurcharge?: number;
  carrierName?: string;
  scac?: string;
  serviceLevel?: string;
  totalShipmentCost?: number;
  netCharge?: number;
  quoteCostDetails?: Array<any>;
  costDetails?: Array<any>;
  accessorialCharges?: Array<{
    accessorialDescription?: string;
    accessorialCharge?: number;
    code?: string;
    amount?: number;
    description?: string;
    accName?: string;
  }>;
}

interface NewShipmentLocationState {
  quote?: ShipmentPrefillQuote;
  selectedCarrier?: ShipmentPrefillCarrier;
  rate?: ShipmentPrefillCarrier;
  reference?: string | number;
}
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

  const prefillData = location.state as NewShipmentLocationState | null;
  const quote = prefillData?.quote;
  const selectedCarrier = prefillData?.selectedCarrier;
  const reference = prefillData?.reference;

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryRef = queryParams.get("reference") || queryParams.get("ref") || queryParams.get("quoteRequestId");

  const isFromReference = Boolean(
    reference ||
    quote?.quoteRequestId ||
    selectedCarrier ||
    prefillData?.rate ||
    queryRef
  );
  const [hasRateChanged, setHasRateChanged] = useState<boolean>(false);

  const [originForm] = Form.useForm();
  const [destinationForm] = Form.useForm();

  const { data: accessorialsList = [], selectedAccessorialIds = [] } = useAppSelector((state) => state.accessorials);
  const { clients = [] } = useAppSelector((state) => state.customerLocation);

  const [selectedClientCode, setSelectedClientCode] = useState<string>(
    () =>
      quote?.clientCode ||
      sessionStorage.getItem("quotes_selectedClientCode") ||
      sessionStorage.getItem("customerLocation_selectedClientCode") ||
      DEFAULT_CLIENT_CODE ||
      ""
  );

  useEffect(() => {
    dispatch(fetchClientsAndSubclients());
  }, [dispatch]);

  useEffect(() => {
    if (quote?.clientCode) {
      setSelectedClientCode(quote.clientCode);
    }
  }, [quote?.clientCode]);

  useEffect(() => {
    if (!selectedClientCode && clients.length > 0) {
      const defaultClient =
        clients.find((c) => c.clientCode === DEFAULT_CLIENT_CODE) || clients[0];
      if (defaultClient?.clientCode) {
        setSelectedClientCode(defaultClient.clientCode);
      }
    }
  }, [clients, selectedClientCode]);

  const clientOptions = useMemo(() => {
    let list = [...clients];
    if (quote?.clientCode && !list.some((c) => c.clientCode === quote.clientCode)) {
      list.unshift({
        clientCode: quote.clientCode,
        clientName: quote.clientName || quote.clientCode,
      });
    }
    return list.map((client) => ({
      label: (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          {client.clientName}
        </span>
      ),
      value: client.clientCode,
      searchValue: `${client.clientName} ${client.clientCode}`,
    }));
  }, [clients, quote]);

  const selectedClient = useMemo(() => {
    return (
      clients.find((c) => c.clientCode === selectedClientCode) ||
      (quote?.clientCode === selectedClientCode
        ? { clientName: quote.clientName, clientCode: quote.clientCode }
        : null)
    );
  }, [clients, selectedClientCode, quote]);

  const handleClientChange = (value: string) => {
    setSelectedClientCode(value);
    sessionStorage.setItem("quotes_selectedClientCode", value);
    sessionStorage.setItem("customerLocation_selectedClientCode", value);
    searchedZipsRef.current = {};
  };

  // Manage multiple product lines from Redux
  const items = useAppSelector((state) => state.product.items);
  const weightUnit = useAppSelector((state) => state.product.weightUnit);
  const [touchedNMFC, setTouchedNMFC] = useState<Record<string, boolean>>({});
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Description autocomplete state (Products)
  const [productOptions, setProductOptions] = useState<
    { value: string; key: string; product: any; label: React.ReactNode }[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const searchProductTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  // Hazmat modal state
  const [isHazmatModalOpen, setIsHazmatModalOpen] = useState(false);
  const [activeHazmatItem, setActiveHazmatItem] = useState<ProductItem | null>(null);
  const [hazmatForm, setHazmatForm] = useState({
    hazmatUN: "",
    hazmatProperShippingName: "",
    hazmatClass: "",
    hazmatPackingGroup: "",
    hazmatPhone: "",
    hazmatContact: "",
  });

  // Carrier rate modal state
  const ratesFromStore = useAppSelector((state) => state.customerRate.rates) as CarrierRate[];
  const ratesLoading = useAppSelector((state) => state.customerRate.loading);
  const rateError = useAppSelector((state) => state.customerRate.error);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [selectedCarrierRate, setSelectedCarrierRate] = useState<CarrierRate | null>(null);
  const [selectedCarrierInfo, setSelectedCarrierInfo] = useState<{ carrierId: string; carrierName: string } | null>(null);

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
      const mapped: ProductItem[] = productsSource.map((p, idx) => {
        const rawPackage = String(p.packagingGroup || p.packageType || p.handlingUnit || "").trim();
        const matchedPackage = handlingUnitOptions.find(
          (opt) => opt.value.toLowerCase() === rawPackage.toLowerCase()
        );
        const packageType = matchedPackage ? matchedPackage.value : (rawPackage.toUpperCase() === "PLT" ? "Pallet" : rawPackage);

        const lengthVal = (p.length != null && p.length !== 0 && p.length !== "0") ? p.length : "";
        const widthVal = (p.width != null && p.width !== 0 && p.width !== "0") ? p.width : "";
        const heightVal = (p.height != null && p.height !== 0 && p.height !== "0") ? p.height : "";
        const weightVal = (p.weight != null && p.weight !== 0 && p.weight !== "0") ? p.weight : "";
        const palletsVal = (p.pallets != null && p.pallets !== 0 && p.pallets !== "0") ? p.pallets : (p.units != null && p.units !== 0 ? p.units : (p.pieces != null && p.pieces !== 0 ? p.pieces : ""));
        const pcfDensityVal = p.density ?? p.pcfDensity ?? calculatePCF(lengthVal, widthVal, heightVal, weightVal, palletsVal);

        return {
          id: String(p.quoteProductId ?? (idx + 1)),
          pallets: palletsVal,
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
          hazmatProperShippingName: p.hazmatProperShippingName || p.hazMatProperShippingName || "",
          hazmatPackingGroup: p.hazmatGroup || p.hazmatPackingGroup || p.hazMatPackingGroup || "",
          hazmatGroup: p.hazmatGroup || p.hazmatPackingGroup || p.hazMatPackingGroup || "",
          hazmatPhone: p.hazmatPhone || p.hazMatPhone || "",
          hazmatContact: p.hazmatContactName || p.hazmatContact || p.hazMatContact || "",
          hazmatContactName: p.hazmatContactName || p.hazmatContact || p.hazMatContact || "",
        };
      });
      dispatch(setProductItems(mapped));
    } else {
      dispatch(resetProductItems());
    }
  }, [quote, dispatch]);

  useEffect(() => {
    if (quote?.quoteAccessorials && quote.quoteAccessorials.length > 0 && accessorialsList.length > 0) {
      const quoteAccCodes = quote.quoteAccessorials.map((a) => String(a.accCode || "").toUpperCase());
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
      postal: (quote?.originZip || "").split(' - ')[0].trim(),
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
      postal: (quote?.destinationZip || "").split(' - ')[0].trim(),
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
      const clientCode =
        selectedClientCode ||
        quote?.clientCode ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "Devts";

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
                setOriginData((prev: any) => {
                  const updated = {
                    ...prev,
                    companyName: prev?.companyName || matched.locationName || "",
                    address1: prev?.address1 || matched.address1 || "",
                    address2: prev?.address2 || matched.address2 || "",
                    city: prev?.city || matched.city || "",
                    state: prev?.state || matched.stateCode || "",
                    country: prev?.country || matched.countryCode || "USA",
                    contactName: prev?.contactName || matched.contactName || "",
                    phone: prev?.phone || formatPhoneNumber(matched.contactPhone || ""),
                    email: prev?.email || matched.contactEmail || "",
                  };
                  originForm.setFieldsValue(updated);
                  return updated;
                });
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
                setDestinationData((prev: any) => {
                  const updated = {
                    ...prev,
                    companyName: prev?.companyName || matched.locationName || "",
                    address1: prev?.address1 || matched.address1 || "",
                    address2: prev?.address2 || matched.address2 || "",
                    city: prev?.city || matched.city || "",
                    state: prev?.state || matched.stateCode || "",
                    country: prev?.country || matched.countryCode || "USA",
                    contactName: prev?.contactName || matched.contactName || "",
                    phone: prev?.phone || formatPhoneNumber(matched.contactPhone || ""),
                    email: prev?.email || matched.contactEmail || "",
                  };
                  destinationForm.setFieldsValue(updated);
                  return updated;
                });
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
  }, [quote, selectedClientCode]);

  const fetchProducts = async (query: string) => {
    const trimmed = (query || "").trim();
    if (!trimmed) {
      setProductOptions([]);
      setLoadingProducts(false);
      return;
    }

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setLoadingProducts(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const clientCodeToUse =
        selectedClientCode ||
        quote?.clientCode ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      const payload = {
        clientCode: clientCodeToUse,
        searchText: trimmed,
        pageNumber: 1,
        pageSize: 100,
      };

      const response = await axios.post(
        `${API_BASE_URL}/Product/SearchProducts`,
        payload,
        {
          headers,
          signal: controller.signal,
        }
      );

      let dataList: any[] = [];
      if (response.data?.isSuccess && response.data?.data) {
        const raw = response.data.data;
        dataList = Array.isArray(raw) ? raw : (raw.items || []);
      }

      if (dataList.length > 0) {
        const options = dataList.map((prod: any, idx: number) => {
          const prodDesc = prod.productDescription || prod.description || "";
          const subtext = [
            prod.productClass ? `Class: ${prod.productClass}` : "",
            prod.productNMFC ? `NMFC: ${prod.productNMFC}` : "",
            prod.weight ? `${prod.weight} lbs` : "",
            prod.commodity || "",
          ]
            .filter(Boolean)
            .join(" | ");

          return {
            value: prodDesc,
            key: `prod-opt-${prod.productId || idx}-${idx}`,
            product: prod,
            label: (
              <div>
                <span className="product-option-desc">
                  {prodDesc || "Unnamed Product"}
                </span>
                {subtext && (
                  <span className="product-option-meta">
                    {subtext}
                  </span>
                )}
              </div>
            ),
          };
        });
        setProductOptions(options);
      } else {
        setProductOptions([]);
      }
    } catch (error: any) {
      if (axios.isCancel(error) || error?.name === "CanceledError") {
        return;
      }
      console.error("Error calling SearchProducts API for description:", error);
      setProductOptions([]);
    } finally {
      if (searchAbortControllerRef.current === controller) {
        setLoadingProducts(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (searchProductTimeoutRef.current) {
        clearTimeout(searchProductTimeoutRef.current);
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearchProducts = (searchText: string) => {
    if (searchProductTimeoutRef.current) {
      clearTimeout(searchProductTimeoutRef.current);
    }
    const trimmed = (searchText || "").trim();

    if (!trimmed) {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      setProductOptions([]);
      setLoadingProducts(false);
      return;
    }

    setLoadingProducts(true);
    searchProductTimeoutRef.current = setTimeout(() => {
      fetchProducts(trimmed);
    }, 400);
  };

  const shipmentInfoData = {
    serviceLevel: selectedCarrier?.service || "",
    customerRef: String(reference || quote?.quoteRequestId || ""),
    mode: quote?.mode || "",
    equipment: quote?.equipment || "",
    paymentTerms: quote?.paymentTerms || "",
  };

  const rawCarrier: any = selectedCarrierRate || prefillData?.selectedCarrier || prefillData?.rate || quote?.selectedCarrier || quote?.quoteResults?.[0];

  const handleSelectRateFromModal = (rate: CarrierRate) => {
    setSelectedCarrierRate(rate);
    setIsRateModalOpen(false);
    setHasRateChanged(false);
    setSelectedCarrierInfo({
      carrierId: rate.code || "",
      carrierName: rate.name || "",
    });
    message.success(`Selected carrier: ${rate.name || rate.code} ($${Number(rate.price).toFixed(2)})`);
  };

  const carrierRateData = useMemo(() => {
    if (!rawCarrier) return undefined;

    const matchingQuoteResult = quote?.quoteResults?.find(
      (r: any) =>
        (rawCarrier.id && String(r.quoteResultId) === String(rawCarrier.id)) ||
        (rawCarrier.code && r.scac?.toUpperCase() === rawCarrier.code?.toUpperCase()) ||
        (rawCarrier.name && r.carrierName?.toLowerCase() === rawCarrier.name?.toLowerCase())
    );

    let grossCharge = Number(rawCarrier.grossCharge ?? matchingQuoteResult?.grossCharge) || 0;
    let discount = Number(rawCarrier.discount ?? matchingQuoteResult?.discount) || 0;
    let fuelSurcharge = Number(rawCarrier.fuelSurcharge ?? matchingQuoteResult?.fuelSurcharge) || 0;
    const accessorialCharges: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[] = [];

    const costDetails = rawCarrier.quoteCostDetails || rawCarrier.costDetails || matchingQuoteResult?.quoteCostDetails;
    if (Array.isArray(costDetails) && costDetails.length > 0) {
      costDetails.forEach((cd: any) => {
        const code = (cd.accCode || cd.code || "").trim().toUpperCase();
        const name = (cd.accName || cd.name || cd.description || "").trim().toLowerCase();
        const amount = Number(cd.amount ?? cd.charge) || 0;

        if (
          code === "GROSS" ||
          code === "FRT" ||
          code === "FREIGHT" ||
          code === "BASE" ||
          name.includes("gross") ||
          name.includes("freight") ||
          name === "freight"
        ) {
          grossCharge = amount;
        } else if (
          code === "DISC" ||
          code === "DSC" ||
          code === "DISCOUNT" ||
          name.includes("discount")
        ) {
          discount = Math.abs(amount);
        } else if (
          code === "FUEL" ||
          code === "FSC" ||
          code === "FUEL SURCHARGE" ||
          name.includes("fuel")
        ) {
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

    const price =
      Number(rawCarrier.price) ||
      Number(rawCarrier.totalShipmentCost ?? matchingQuoteResult?.totalShipmentCost) ||
      Number(rawCarrier.netCharge ?? matchingQuoteResult?.netCharge) ||
      0;
    if (!grossCharge && price > 0) {
      grossCharge = price;
    }

    return {
      carrierName: rawCarrier.name || rawCarrier.carrierName || matchingQuoteResult?.carrierName || "",
      carrierCode: rawCarrier.code || rawCarrier.scac || matchingQuoteResult?.scac || "",
      service: rawCarrier.service || rawCarrier.serviceLevel || matchingQuoteResult?.serviceLevel || "",
      price: price > 0 ? price : (grossCharge - discount + fuelSurcharge),
      grossCharge,
      discount,
      fuelSurcharge,
      accessorialCharges,
      grossCode: "FRT",
      discountCode: "DSC",
      fuelCode: "FSC",
    };
  }, [rawCarrier, quote]);

  const handleFetchRatesForShipment = async (scacParam?: string) => {
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
      hazMatProperShippingName: i.hazmatProperShippingName || undefined,
      hazMatPackingGroup: i.hazmatPackingGroup || undefined,
      hazMatPhone: i.hazmatPhone || undefined,
      hazMatContact: i.hazmatContact || undefined,
      hazmatProperShippingName: i.hazmatProperShippingName || "",
      hazmatClass: i.hazmatClass || "",
      hazmatUN: i.hazmatUN || "",
      hazmatPhone: i.hazmatPhone || "",
      hazmatContactName: i.hazmatContactName || i.hazmatContact || "",
      hazmatGroup: i.hazmatGroup || i.hazmatPackingGroup || "",
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

    const scacToUse = scacParam || selectedCarrierInfo?.carrierId || undefined;
    const firstHazmat = items.find((i) => i.hazmat) || items[0];

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
      hazmatProperShippingName: firstHazmat?.hazmatProperShippingName || "",
      hazmatClass: firstHazmat?.hazmatClass || "",
      hazmatUN: firstHazmat?.hazmatUN || "",
      hazmatPhone: firstHazmat?.hazmatPhone || "",
      hazmatContactName: firstHazmat?.hazmatContactName || firstHazmat?.hazmatContact || "",
      hazmatGroup: firstHazmat?.hazmatGroup || firstHazmat?.hazmatPackingGroup || "",
      shipments,
      accessorialCodes,
      profileCode: quote?.profileCode,
      clientCode: selectedClientCode || quote?.clientCode || DEFAULT_CLIENT_CODE,
      clientName: selectedClient?.clientName || quote?.clientName || "",
      scac: scacToUse,
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
      equipment: undefined,
      codAmount: 0,
      totalLinearFeet: 0,
    };

    try {
      setIsRateModalOpen(true);
      const res = await dispatch(fetchCarrierRates(payload));
      if (fetchCarrierRates.fulfilled.match(res)) {
        const rates = res.payload;
        if (!rates || rates.length === 0) {
          message.warning("No carrier rates returned from the API for the selected route.");
        } else {
          message.success("Carrier rates updated successfully.");
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

  const handleOpenHazmatModal = (item: ProductItem) => {
    setActiveHazmatItem(item);
    setHazmatForm({
      hazmatUN: item.hazmatUN || "",
      hazmatProperShippingName: item.hazmatProperShippingName || "",
      hazmatClass: item.hazmatClass || "",
      hazmatPackingGroup: item.hazmatPackingGroup || "",
      hazmatPhone: item.hazmatPhone || "",
      hazmatContact: item.hazmatContact || "",
    });
    setIsHazmatModalOpen(true);
  };

  const handleHazmatModalOk = () => {
    if (activeHazmatItem) {
      dispatch(
        updateProductHazmat({
          id: activeHazmatItem.id,
          hazmat: true,
          hazmatUN: hazmatForm.hazmatUN,
          hazmatProperShippingName: hazmatForm.hazmatProperShippingName,
          hazmatClass: hazmatForm.hazmatClass,
          hazmatPackingGroup: hazmatForm.hazmatPackingGroup,
          hazmatGroup: hazmatForm.hazmatPackingGroup,
          hazmatPhone: hazmatForm.hazmatPhone,
          hazmatContact: hazmatForm.hazmatContact,
          hazmatContactName: hazmatForm.hazmatContact,
        })
      );
    }
    setIsHazmatModalOpen(false);
    setActiveHazmatItem(null);
  };

  const handleHazmatModalCancel = () => {
    setIsHazmatModalOpen(false);
    setActiveHazmatItem(null);
  };

  const renderWithTooltip = (
    child: React.ReactElement,
    errorMessage: string,
    hasError: boolean
  ) => (
    <Tooltip
      title={hasError ? errorMessage : ""}
      open={hasError ? undefined : false}
      placement="top"
      trigger={["hover", "focus"]}
      color="#df2027"
      overlayClassName="quote-item-error-tooltip"
      arrow={{ pointAtCenter: true }}
    >
      <div className="w-100">{child}</div>
    </Tooltip>
  );

  const handleUpdateField = (id: string, field: keyof ProductItem, value: any) => {
    if (field === 'stackable') {
      const isStackable = Boolean(value);
      dispatch(updateProductRow({ id, field: 'stackable', value: isStackable }));
      if (isStackable) {
        dispatch(
          updateProductHazmat({
            id,
            hazmat: false,
            hazmatClass: '',
            hazmatUN: '',
            hazmatProperShippingName: '',
            hazmatPackingGroup: '',
            hazmatPhone: '',
            hazmatContact: '',
          })
        );
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
      if (item.nmfc && !isValidNMFC(item.nmfc)) {
        setTouchedNMFC((prev) => ({ ...prev, [item.id]: true }));
        message.error(`NMFC "${item.nmfc}" is invalid. Must be in 6 digit - 2 digit format (XXXXXX-XX, e.g. 123456-01).`);
        return false;
      }
      if (item.hazmat) {
        if (!item.hazmatUN) {
          message.error("Hazmat UN is required when Hazmat is selected.");
          return false;
        }
      }
    }
    return true;
  };

  const totalPallets = items.reduce((sum, item) => sum + (Number(item.pallets) || 0), 0);
  const totalPieces = items.reduce((sum, item) => sum + (Number(item.pieces) || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  // Refs to capture input values across all forms WITHOUT triggering re-render cascades
  const originFormValuesRef = useRef<any>({});
  const destinationFormValuesRef = useRef<any>({});
  const shipmentNotesRef = useRef<string>("");
  const carrierNotesRef = useRef<string>("");
  const specialNotesRef = useRef<string>("");
  const shipmentInfoValuesRef = useRef<any>({
    mode: "LTL",
    equipment: "LTL",
    serviceLevel: "Standard",
    // priority: "Standard",
    paymentTerms: "3rd Party Prep",
    sendCarrierPickupReq: false,
  });
  const billToValuesRef = useRef<any>({ country: "USA" });
  const insuranceValuesRef = useRef<any>({
    shipmentValue: "",
    codAmount: "",
    insuranceType: "None",
    specialInstructions: "",
  });
  const internalNotesListRef = useRef<any[]>([]);
  const rateDetailsRef = useRef<{
    buyRate: { freight: number; fuel: number; discount: number; accesorialCostDetails: any[] };
    sellRate: { freight: number; fuel: number; discount: number; accesorialCostDetails: any[] };
  }>({
    buyRate: { freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] },
    sellRate: { freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] },
  });
  const [isSavingShipment, setIsSavingShipment] = useState<boolean>(false);

  const toIsoOrCurrent = (dateStr?: string): string => {
    if (!dateStr || !dateStr.trim()) return new Date().toISOString();
    const parsed = new Date(dateStr.trim());
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return new Date().toISOString();
  };

  const handleSaveShipment = async () => {
    if (!validateProductItems()) return;

    const originVals = {
      ...(originData || {}),
      ...(originFormValuesRef.current || {}),
      ...(originForm?.getFieldsValue?.(true) || {}),
    };
    const destinationVals = {
      ...(destinationData || {}),
      ...(destinationFormValuesRef.current || {}),
      ...(destinationForm?.getFieldsValue?.(true) || {}),
    };

    const origName = (originVals.companyName || "").trim();
    const origAddress = (originVals.address1 || "").trim();
    const origZip = (originVals.postal || quote?.originZip || "").split(' - ')[0].trim();
    const origCity = (originVals.city || quote?.originCity || "").trim();
    const origState = (originVals.state || quote?.originStateCode || "").trim();

    const destName = (destinationVals.companyName || "").trim();
    const destAddress = (destinationVals.address1 || "").trim();
    const destZip = (destinationVals.postal || quote?.destinationZip || "").split(' - ')[0].trim();
    const destCity = (destinationVals.city || quote?.destinationCity || "").trim();
    const destState = (destinationVals.state || quote?.destinationStateCode || "").trim();

    if (!origName) {
      message.error("Origin Company Name is required.");
      originForm.validateFields(['companyName']).catch(() => {});
      return;
    }
    if (!origAddress) {
      message.error("Origin Address Line 1 is required.");
      originForm.validateFields(['address1']).catch(() => {});
      return;
    }
    if (!origZip) {
      message.error("Origin postal/ZIP code is required.");
      originForm.validateFields(['postal']).catch(() => {});
      return;
    }
    if (!destName) {
      message.error("Destination Company Name is required.");
      destinationForm.validateFields(['companyName']).catch(() => {});
      return;
    }
    if (!destAddress) {
      message.error("Destination Address Line 1 is required.");
      destinationForm.validateFields(['address1']).catch(() => {});
      return;
    }
    if (!destZip) {
      message.error("Destination postal/ZIP code is required.");
      destinationForm.validateFields(['postal']).catch(() => {});
      return;
    }

    const readyTime = (
      originVals.openTime ||
      originVals.pickupOpenTime ||
      originForm?.getFieldValue?.("openTime") ||
      originForm?.getFieldValue?.("pickupOpenTime") || ""
    ).trim();

    const closeTime = (
      originVals.closeTime ||
      originVals.pickupCloseTime ||
      originForm?.getFieldValue?.("closeTime") ||
      originForm?.getFieldValue?.("pickupCloseTime") ||
      "05:00 PM"
    ).trim();

    if (!readyTime) {
      message.error("Pickup time is required.");
      originForm.validateFields(['openTime']).catch(() => {});
      return;
    }

    const shipmentNotes = shipmentNotesRef.current || "";
    const shipmentInfoValues = shipmentInfoValuesRef.current || {};
    const billToValues = billToValuesRef.current || {};
    const insuranceValues = insuranceValuesRef.current || {};
    const internalNotesList = internalNotesListRef.current || [];
    const rateDetails = rateDetailsRef.current || {
      buyRate: { freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] },
      sellRate: { freight: 0, fuel: 0, discount: 0, accesorialCostDetails: [] },
    };

    setIsSavingShipment(true);
    try {
      const clientCodeToUse =
        selectedClientCode ||
        quote?.clientCode ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      const loggedInUser =
        localStorage.getItem("userName") ||
        sessionStorage.getItem("userName") ||
        localStorage.getItem("user") ||
        "Portal User";

      const rawPhone = originVals.phone || originData.phone || "";
      const phoneDigits = rawPhone.replace(/\D/g, "");
      const orgPhoneAreaCode = phoneDigits.length >= 10 ? phoneDigits.slice(0, 3) : "";
      const orgPhoneNumber = rawPhone;

      const contactPerson = originVals.contactName || originData.contactName || "";
      const nameParts = contactPerson.trim().split(/\s+/);
      const orgContactFirstName = nameParts[0] || "";
      const orgContactLastName = nameParts.slice(1).join(" ") || "";

      const scacCode =
        selectedCarrierInfo?.carrierId ||
        carrierRateData?.carrierCode ||
        rawCarrier?.code ||
        rawCarrier?.scac ||
        "";

      const carrierName =
        selectedCarrierInfo?.carrierName ||
        carrierRateData?.carrierName ||
        rawCarrier?.name ||
        rawCarrier?.carrierName ||
        "";

      const selectedAccessorialCodes: string[] = (accessorialsList || [])
        .filter((a: any) => (selectedAccessorialIds || []).includes(a.accessorialID ?? a.accessorialId))
        .map((a: any) => String(a.accesorialCode || a.accessorialName || "").trim())
        .filter(Boolean);

      const bolDispatchNotes = (internalNotesList || []).map((n: any) => n.text).filter(Boolean);

      const mappedProducts = items.map((i) => ({
        productDescription: i.description || "Freight",
        productClass: String(i.class || "50"),
        productWeight: Math.round(Number(i.weight) || 0),
        pallets: Math.round(Number(i.pallets) || 0),
        pieces: Math.round(Number(i.pieces) || 0),
        nmfc: i.nmfc || "",
        hazMat: Boolean(i.hazmat),
        length: Math.round(Number(i.length) || 0),
        width: Math.round(Number(i.width) || 0),
        height: Math.round(Number(i.height) || 0),
        pcf: Math.round(Number(i.pcfDensity) || 0),
        packageType: i.packageType || "Pallet",
        skuNumber: "",
        accountNumber: "",
        linearFeet: 0,
        hazmatProperShippingName: i.hazmatProperShippingName || "",
        hazmatClass: i.hazmatClass || "",
        hazmatUnNaNumber: i.hazmatUN || "",
        hazmatPhone: i.hazmatPhone || "",
        hazmatGroup: i.hazmatPackingGroup || i.hazmatGroup || "",
        hazmatContact: i.hazmatContact || i.hazmatContactName || "",
        stackable: Boolean(i.stackable),
      }));

      const buyRate =
        rateDetails.buyRate.freight > 0 ||
        rateDetails.buyRate.accesorialCostDetails.length > 0 ||
        rateDetails.buyRate.fuel > 0
          ? rateDetails.buyRate
          : {
              freight: Number(carrierRateData?.grossCharge) || (Number(carrierRateData?.price) > 0 ? Number(carrierRateData?.price) : 0),
              fuel: Number(carrierRateData?.fuelSurcharge) || 0,
              discount: Number(carrierRateData?.discount) || 0,
              accesorialCostDetails: (carrierRateData?.accessorialCharges || []).map((ac: any) => ({
                accCode: ac.code || "ACC",
                ratedCost: Number(ac.accessorialCharge) || 0,
                description: ac.accessorialDescription || "",
                billedCost: Number(ac.accessorialCharge) || 0,
              })),
            };

      const sellRate =
        rateDetails.sellRate.freight > 0 ||
        rateDetails.sellRate.accesorialCostDetails.length > 0 ||
        rateDetails.sellRate.fuel > 0
          ? rateDetails.sellRate
          : {
              freight: Number(carrierRateData?.grossCharge) || (Number(carrierRateData?.price) > 0 ? Number(carrierRateData?.price) : 0),
              fuel: Number(carrierRateData?.fuelSurcharge) || 0,
              discount: Number(carrierRateData?.discount) || 0,
              accesorialCostDetails: (carrierRateData?.accessorialCharges || []).map((ac: any) => ({
                accCode: ac.code || "ACC",
                ratedCost: Number(ac.accessorialCharge) || 0,
                description: ac.accessorialDescription || "",
                billedCost: Number(ac.accessorialCharge) || 0,
              })),
            };

      const totalLength = Math.round(items.reduce((sum, i) => sum + (Number(i.length) || 0), 0));
      const totalWidth = Math.round(items.reduce((sum, i) => sum + (Number(i.width) || 0), 0));
      const totalHeight = Math.round(items.reduce((sum, i) => sum + (Number(i.height) || 0), 0));
      const totalWeightCalc = Math.round(items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0));
      const declaredVal = Number(insuranceValues.shipmentValue) || 0;
      const valPerPound = totalWeightCalc > 0 ? Number((declaredVal / totalWeightCalc).toFixed(2)) : 0;

      const sendCarrierPickupReq = Boolean(shipmentInfoValues.sendCarrierPickupReq);
      const createLoadInTms = true;

      const payload = {
        createLoadInTms,
        sendCarrierPickupReq,
        originName: origName,
        originAddress1: origAddress,
        originAddress2: originVals.address2 || "",
        orgCountryCode: originVals.country || "",
        orgStateCode: origState,
        orgPostalCode: origZip,
        orgCityName: origCity,
        destName: destName,
        destAddress1: destAddress,
        destAddress2: destinationVals.address2 || "",
        destCountryCode: destinationVals.country || "",
        destStateCode: destState,
        destPostalCode: destZip,
        destCityName: destCity,
        pickupdate: toIsoOrCurrent(originVals.pickupDate || originVals.expPickupDate),
        proNumber: shipmentInfoValues.proNumber || "",
        scac: scacCode,
        sellSCAC: scacCode,
        clientCode: clientCodeToUse,
        srvToken: SRV_TOKEN,
        products: mappedProducts,
        orgCompanyName: origName,
        orgContactFirstName,
        orgContactLastName,
        orgPhoneAreaCode,
        orgPhoneNumber,
        orgWhoEntered: loggedInUser,
        orgWhoPhoneNumber: orgPhoneNumber,
        pickUpReadyTime: readyTime,
        pickUpCloseTime: closeTime,
        isTestMode: true,
        brokerCode: quote?.profileCode || "",
        clientAddress1: quote?.clientAddress1 || "",
        clientAddress2: quote?.clientAddress2 || "",
        clientCountryCode: quote?.clientCountryCode || "",
        clientCityName: quote?.clientCityName || "",
        clientEmail: quote?.clientEmail || "",
        clientName: selectedClient?.clientName || quote?.clientName || "",
        clientPhone: quote?.clientPhone || "",
        clientStateCode: quote?.clientStateCode || "",
        clientZipCode: quote?.clientZipCode || "",
        pickupTime: readyTime,
        originFax: originVals.fax || "",
        originEmail: originVals.email || "",
        originNote: originVals.shipperNotes || originVals.originNote || shipmentNotes || "",
        destContact: destinationVals.contactName || "",
        destPhoneNo: destinationVals.phone || "",
        destEmail: destinationVals.email || "",
        destFaxNo: destinationVals.fax || "",
        destNote: destinationVals.consigneeNotes || destinationVals.destNote || "",
        ref1Value: shipmentInfoValues.customerRef || (reference ? String(reference) : ""),
        ref2Value: "",
        ref3Value: "",
        pickupNo: shipmentInfoValues.pickupNo || "",
        poNumber: shipmentInfoValues.poNumber || "",
        brokerRefNo: shipmentInfoValues.inlandLd || shipmentInfoValues.customerRef || (reference ? String(reference) : ""),
        expectedShipDate: toIsoOrCurrent(originVals.expPickupDate || originVals.pickupDate),
        requestedDeliveryDate: toIsoOrCurrent(destinationVals.requestedDeliveryDate || destinationVals.expDeliveryDate || destinationVals.deliveryDate),
        requestedDeliveryTime: destinationVals.delOpenTime || destinationVals.openTime || destinationForm?.getFieldValue?.("delOpenTime") || destinationForm?.getFieldValue?.("openTime") || "08:00 AM",
        shipmentValue: declaredVal,
        valuePerPound: valPerPound,
        specialNotes: specialNotesRef.current || insuranceValues.specialInstructions || shipmentNotes || "",
        carrierNote: carrierNotesRef.current || shipmentNotes || "",
        billToName: billToValues.companyName || "",
        billToAddress1: billToValues.address1 || "",
        billToAddress2: billToValues.address2 || "",
        billToCountryCode: billToValues.country || "",
        billToPostalCode: (billToValues.postal || "").split(' - ')[0].trim(),
        billToStateCode: billToValues.state || "",
        billToCityName: billToValues.city || "",
        billToFaxNo: billToValues.fax || "",
        bolDispatchNotes,
        accessorials: selectedAccessorialCodes,
        paymentTerms: shipmentInfoValues.paymentTerms || "3rd Party Prep",
        orgContactPerson: contactPerson,
        deliveryDate: toIsoOrCurrent(destinationVals.deliveryDate || destinationVals.expDeliveryDate),
        deliveryTime: destinationVals.delOpenTime || destinationVals.openTime || destinationForm?.getFieldValue?.("delOpenTime") || destinationForm?.getFieldValue?.("openTime") || "08:00 AM",
        carrierBolNo: shipmentInfoValues.carrierBolNo || "",
        buyRate,
        sellRate,
        // shipmentMode: shipmentInfoValues.mode || quote?.mode || "LTL",
        equipment: shipmentInfoValues.equipment || "LTL",
        totalLength,
        totalWidth,
        totalHeight,
        wiseTechTransactionNo: "",
        userName: loggedInUser,
        originPortCode: "",
        destinationPortCode: "",
        requestedDeliveryTimeTo: destinationVals.delCloseTime || destinationVals.closeTime || destinationForm?.getFieldValue?.("delCloseTime") || destinationForm?.getFieldValue?.("closeTime") || "05:00 PM",
        codAmount: Number(insuranceValues.codAmount) || 0,
        totalLinearFeet: 0,
        sellCarrierName: carrierName,
      };

      console.log("=== BookShipment Payload (Formatted JSON) ===");
      console.log(JSON.stringify(payload, null, 2));
      console.log("=== BookShipment Payload (Object) ===", payload);

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await axios.post(
        `${API_BASE_URL}/BookShipment/BookShipment`,
        payload,
        { headers }
      );

      console.log("BookShipment Response:", response.data);

      if (response.data?.isSuccess || response.status === 200 || response.status === 201) {
        message.success(response.data?.message || "Shipment booked and saved successfully!");
        navigate('/shipments');
      } else {
        message.error(response.data?.message || "Failed to book shipment.");
      }
    } catch (err: any) {
      console.error("BookShipment API Error:", err);
      let apiErrMsg = err.response?.data?.message;
      if (!apiErrMsg && err.response?.data?.errors) {
        const errorEntries = Object.entries(err.response.data.errors)
          .map(([field, msgs]: [string, any]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`);
        if (errorEntries.length > 0) {
          apiErrMsg = errorEntries.join(' | ');
        }
      }
      if (!apiErrMsg) {
        apiErrMsg =
          err.response?.data?.title ||
          err.message ||
          "An error occurred while saving the shipment.";
      }
      message.error(apiErrMsg);
    } finally {
      setIsSavingShipment(false);
    }
  };

  const isPageLoading = Boolean(loadingOrigin || loadingDestination || isSavingShipment);

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
          <Flex align="center" gap={10} wrap="wrap">
            <span>Client:</span>
            {!quote ? (
              <Select
                id="new-shipment-client-select"
                showSearch
                placeholder="Select client..."
                value={selectedClientCode || undefined}
                onChange={handleClientChange}
                style={{ minWidth: 260 }}
                filterOption={(input, option) =>
                  String((option as any)?.searchValue || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={clientOptions}
                loading={clients.length === 0}
              />
            ) : (
              <strong>{quote?.clientName || selectedClient?.clientName || ""}</strong>
            )}
            <span className='ns-credit-limit'>Credit limit: $0</span>
          </Flex>
        </div>
        <Flex gap={12}>
          <Button danger onClick={() => navigate('/shipments')}>Cancel</Button>
          <Button
            onClick={() => { if (!validateProductItems()) return; }}
            disabled={isFromReference && hasRateChanged}
          >
            Save Quote
          </Button>
          <Button
            type="primary"
            danger
            loading={isSavingShipment}
            onClick={handleSaveShipment}
            disabled={isFromReference && hasRateChanged}
          >
            Save Shipment
          </Button>
        </Flex>
      </Flex>

      {/* ══ Top Layout ══ */}
      <Row gutter={[16, 16]} align="stretch" className="ns-top-row">
        <Col xs={24} xl={16} className="ns-top-left-col">
          <Flex vertical gap={16} className="ns-left-col">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <OriginLocation
                  form={originForm}
                  initialData={originData}
                  locationsList={originLocationsList}
                  loading={loadingOrigin}
                  clientCode={selectedClientCode || quote?.clientCode}
                  onChange={(vals) => { originFormValuesRef.current = vals; }}
                  onLocationSelect={(loc) => {
                    const newOrigin = {
                      locationId: loc.locationId || loc.LocationId,
                      companyName: loc.locationName || loc.LocationName || "",
                      address1: loc.address1 || loc.Address1 || loc.address || loc.Address || "",
                      address2: loc.address2 || loc.Address2 || "",
                      city: loc.city || loc.City || "",
                      state: loc.stateCode || loc.StateCode || loc.state || loc.State || "",
                      country: loc.countryCode || loc.CountryCode || loc.country || loc.Country || "USA",
                      postal: String(loc.zipCode || loc.ZipCode || loc.postal || loc.Postal || "").split(' - ')[0].trim(),
                      contactName: loc.contactName || loc.ContactName || loc.contactPerson || "",
                      phone: formatPhoneNumber(loc.contactPhone || loc.ContactPhone || loc.phone || ""),
                      email: loc.contactEmail || loc.ContactEmail || loc.email || "",
                      openTime: loc.openTime || loc.OpenTime || undefined,
                      closeTime: loc.closeTime || loc.CloseTime || undefined,
                    };
                    setOriginData((prev: any) => ({ ...prev, ...newOrigin }));
                    originForm.setFieldsValue(newOrigin);
                    originFormValuesRef.current = { ...originFormValuesRef.current, ...newOrigin };
                  }}
                />
              </Col>
              <Col xs={24} md={12}>
                <DestinationLocation
                  form={destinationForm}
                  initialData={destinationData}
                  locationsList={destinationLocationsList}
                  loading={loadingDestination}
                  clientCode={selectedClientCode || quote?.clientCode}
                  onChange={(vals) => { destinationFormValuesRef.current = vals; }}
                  onLocationSelect={(loc) => {
                    const newDest = {
                      locationId: loc.locationId || loc.LocationId,
                      companyName: loc.locationName || loc.LocationName || "",
                      address1: loc.address1 || loc.Address1 || loc.address || loc.Address || "",
                      address2: loc.address2 || loc.Address2 || "",
                      city: loc.city || loc.City || "",
                      state: loc.stateCode || loc.StateCode || loc.state || loc.State || "",
                      country: loc.countryCode || loc.CountryCode || loc.country || loc.Country || "USA",
                      postal: String(loc.zipCode || loc.ZipCode || loc.postal || loc.Postal || "").split(' - ')[0].trim(),
                      contactName: loc.contactName || loc.ContactName || loc.contactPerson || "",
                      phone: formatPhoneNumber(loc.contactPhone || loc.ContactPhone || loc.phone || ""),
                      email: loc.contactEmail || loc.ContactEmail || loc.email || "",
                      openTime: loc.openTime || loc.OpenTime || undefined,
                      closeTime: loc.closeTime || loc.CloseTime || undefined,
                    };
                    setDestinationData((prev: any) => ({ ...prev, ...newDest }));
                    destinationForm.setFieldsValue(newDest);
                    destinationFormValuesRef.current = { ...destinationFormValuesRef.current, ...newDest };
                  }}
                />
              </Col>
            </Row>
            <Row gutter={[16, 16]} className="notes-row-stretch">
              <Col xs={24} md={12} className="notes-col-stretch">
                <Card
                  title="Carrier notes"
                  className="notes-panel"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Add shipment notes, special instructions, or internal comments..."
                    className="notes-textarea"
                    defaultValue={quote?.carrierNote || ""}
                    onChange={(e) => {
                      carrierNotesRef.current = e.target.value;
                      shipmentNotesRef.current = e.target.value;
                    }}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12} className="notes-col-stretch">
                <Card
                  title="Special Notes"
                  className="notes-panel"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Add shipment notes, special instructions, or internal comments..."
                    className="notes-textarea"
                    defaultValue={quote?.specialNotes || ""}
                    onChange={(e) => {
                      specialNotesRef.current = e.target.value;
                    }}
                  />
                </Card>
              </Col>
            </Row>
          </Flex>
        </Col>

        <Col xs={24} xl={8} className="ns-top-right-col">
          <Flex vertical gap={16} className="ns-right-col">
            <ShipmentInformation
              initialData={shipmentInfoData}
              onChange={(vals) => { shipmentInfoValuesRef.current = vals; }}
            />
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
              options={['Lbs']} 
              value={weightUnit} 
              onChange={(val) => dispatch(setWeightUnit(val as "Lbs" | "Kgs"))} 
            />
          </Flex>
        }
      >
        <div className="shipment-product-table">
          <div className="shipment-product-table__head">
            <span>Description</span>
            <span>Units <em>*</em></span>
            <span>Handling Unit <em>*</em></span>
            <span>Pieces <em>*</em></span>
            <span>Weight [{weightUnit.toLowerCase()}] <em>*</em></span>
            <span>Class <em>*</em></span>
            <span>Dimensions [in]</span>
            <span>PCF/Density</span>
            <span>NMFC</span>
            <span className="col-center">Stackable</span>
            <span className="col-center">Hazmat</span>
            <span />
          </div>

          {items.map((item) => (
            <div key={item.id} className="shipment-product-item-row">
              <AutoComplete
                value={item.description}
                options={productOptions}
                onSearch={handleSearchProducts}
                onChange={(val) => handleUpdateField(item.id, 'description', val)}
                onSelect={(val, option) => {
                  if (searchProductTimeoutRef.current) {
                    clearTimeout(searchProductTimeoutRef.current);
                  }
                  if (searchAbortControllerRef.current) {
                    searchAbortControllerRef.current.abort();
                  }
                  setLoadingProducts(false);
                  handleUpdateField(item.id, 'description', val);
                  const prod = (option as any)?.product;
                  if (prod) {
                    if (prod.productClass) handleUpdateField(item.id, 'class', String(prod.productClass));
                    if (prod.productNMFC) handleUpdateField(item.id, 'nmfc', String(prod.productNMFC));
                    if (prod.weight) handleUpdateField(item.id, 'weight', String(prod.weight));
                    if (prod.length) handleUpdateField(item.id, 'length', String(prod.length));
                    if (prod.width) handleUpdateField(item.id, 'width', String(prod.width));
                    if (prod.height) handleUpdateField(item.id, 'height', String(prod.height));
                    if (prod.isHazmat || prod.hazmat) handleUpdateField(item.id, 'hazmat', true);
                  }
                }}
                notFoundContent={loadingProducts ? <div className="product-autocomplete-loading"><Spin size="small" /></div> : undefined}
                className="quote-item-autocomplete"
              >
                <Input
                  placeholder="Description"
                  aria-label="Description"
                  allowClear
                />
              </AutoComplete>

              {renderWithTooltip(
                <Input
                  value={item.pallets ?? ''}
                  status={formSubmitted && (!item.pallets || Number(item.pallets) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'pallets', e.target.value)}
                />,
                "Units is required",
                Boolean(formSubmitted && (!item.pallets || Number(item.pallets) <= 0))
              )}

              {renderWithTooltip(
                <Select
                  value={item.packageType || undefined}
                  placeholder="Package"
                  options={handlingUnitOptions}
                  status={formSubmitted && !item.packageType ? 'error' : undefined}
                  onChange={(val) => handleUpdateField(item.id, 'packageType', val)}
                />,
                "Handling unit is required",
                Boolean(formSubmitted && !item.packageType)
              )}

              {renderWithTooltip(
                <Input
                  value={item.pieces ?? ''}
                  status={formSubmitted && (!item.pieces || Number(item.pieces) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'pieces', e.target.value)}
                />,
                "Pieces is required",
                Boolean(formSubmitted && (!item.pieces || Number(item.pieces) <= 0))
              )}

              {renderWithTooltip(
                <Input
                  value={item.weight ?? ''}
                  status={formSubmitted && (!item.weight || Number(item.weight) <= 0) ? 'error' : undefined}
                  onChange={(e) => handleUpdateField(item.id, 'weight', e.target.value)}
                />,
                `Weight [${weightUnit.toLowerCase()}] is required`,
                Boolean(formSubmitted && (!item.weight || Number(item.weight) <= 0))
              )}

              {renderWithTooltip(
                <Select
                  value={item.class ? String(item.class) : undefined}
                  placeholder="Class"
                  options={classOptions}
                  status={formSubmitted && !item.class ? 'error' : undefined}
                  onChange={(val) => handleUpdateField(item.id, 'class', val)}
                />,
                "Class is required",
                Boolean(formSubmitted && !item.class)
              )}

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
                readOnly
                tabIndex={-1}
                className="pcf-density-input"
              />

              {(() => {
                const isNmfcError = Boolean(
                  item.nmfc && !isValidNMFC(item.nmfc) && (touchedNMFC[item.id] || formSubmitted || item.nmfc.length >= 9)
                );
                const nmfcMsg = "NMFC must be XXXXXX-XX";
                return renderWithTooltip(
                  <Input
                    placeholder="XXXXXX-XX"
                    maxLength={9}
                    status={isNmfcError ? "error" : undefined}
                    value={item.nmfc || ''}
                    onBlur={() => {
                      setTouchedNMFC((prev) => ({ ...prev, [item.id]: true }));
                    }}
                    onChange={(e) => handleUpdateField(item.id, 'nmfc', formatNMFC(e.target.value))}
                  />,
                  nmfcMsg,
                  isNmfcError
                );
              })()}

              <div className="col-center">
                <Checkbox
                  checked={item.stackable}
                  onChange={(e) => handleUpdateField(item.id, 'stackable', e.target.checked)}
                />
              </div>

              <div className="col-center hazmat-col">
                <Checkbox
                  checked={item.hazmat}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleOpenHazmatModal(item);
                    } else {
                      dispatch(
                        updateProductHazmat({
                          id: item.id,
                          hazmat: false,
                          hazmatUN: "",
                          hazmatProperShippingName: "",
                          hazmatClass: "",
                          hazmatPackingGroup: "",
                          hazmatPhone: "",
                          hazmatContact: "",
                        })
                      );
                    }
                  }}
                />
                {item.hazmat && (
                  <Button
                    onClick={() => handleOpenHazmatModal(item)}
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    title="Edit Hazmat"
                    danger
                  />
                )}
              </div>

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
        <Col xs={24} xl={16}>
          <CustomerRate
            carrierData={carrierRateData}
            onRate={handleFetchRatesForShipment}
            loadingRate={ratesLoading}
            onSelectCarrier={setSelectedCarrierInfo}
            onRateDetailsChange={(rates) => { rateDetailsRef.current = rates; }}
            clientCode={selectedClientCode || quote?.clientCode}
            isFromReference={isFromReference}
            hasRateChanged={hasRateChanged}
            onRateChanged={setHasRateChanged}
          />
        </Col>
        <Col xs={24} xl={8}>
          <BillToLocation
            clientCode={selectedClientCode || quote?.clientCode}
            onChange={(vals) => { billToValuesRef.current = vals; }}
          />
        </Col>

        <Col xs={24} xl={16}>
          <InsuranceInfo
            onChange={(vals) => { insuranceValuesRef.current = vals; }}
          />
        </Col>

        <Col xs={24} xl={8} className="ns-internal-col">
          <InternalNotes
            onNotesChange={(notes) => { internalNotesListRef.current = notes; }}
          />
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

      {/* ══ Hazmat Details Modal Popup ══ */}
      <Modal
        title="Hazmat Details"
        open={isHazmatModalOpen}
        onCancel={handleHazmatModalCancel}
        centered
        width={500}
        footer={[
          <Button key="ok" type="primary" danger onClick={handleHazmatModalOk}>
            OK
          </Button>,
        ]}
      >
        <div className="hazmat-modal-body">
          <Form layout="horizontal" labelCol={{ span: 11 }} wrapperCol={{ span: 13 }} labelAlign="left">
            <Form.Item label="HAZMAT UN/NA#" className="hazmat-form-item">
              <Input
                value={hazmatForm.hazmatUN}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatUN: e.target.value }))}
                placeholder="HAZMAT UN/NA#"
                autoFocus
              />
            </Form.Item>
            <Form.Item label="Hazmat Proper Shipping Name" className="hazmat-form-item">
              <Input
                value={hazmatForm.hazmatProperShippingName}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatProperShippingName: e.target.value }))}
                placeholder="Hazmat Proper Shipping Name"
              />
            </Form.Item>
            <Form.Item label="Hazmat Class" className="hazmat-form-item">
              <Input
                value={hazmatForm.hazmatClass}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatClass: e.target.value }))}
                placeholder="Hazmat Class"
              />
            </Form.Item>
            <Form.Item label="Hazmat Packing Group" className="hazmat-form-item">
              <Input
                value={hazmatForm.hazmatPackingGroup}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatPackingGroup: e.target.value }))}
                placeholder="Hazmat Packing Group"
              />
            </Form.Item>
            <Form.Item label="Hazmat Phone" className="hazmat-form-item">
              <Input
                value={hazmatForm.hazmatPhone}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatPhone: formatPhoneNumber(e.target.value, prev.hazmatPhone) }))}
                placeholder="(___) ___-____"
                maxLength={14}
              />
            </Form.Item>
            <Form.Item label="Hazmat Contact" className="hazmat-form-item-last">
              <Input
                value={hazmatForm.hazmatContact}
                onChange={(e) => setHazmatForm((prev) => ({ ...prev, hazmatContact: e.target.value }))}
                placeholder="Hazmat Contact"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* ══ FOOTER BUTTONS ══ */}
      <Flex justify="flex-end" gap={12} wrap="wrap">
        <Button onClick={() => navigate('/shipments')} className="btn-outline">✕ Close</Button>
        <Button
          className="btn-outline"
          onClick={() => { if (!validateProductItems()) return; }}
          disabled={isFromReference && hasRateChanged}
        >
          Save Quote
        </Button>
        <Button
          type="primary"
          danger
          loading={isSavingShipment}
          onClick={handleSaveShipment}
          disabled={isFromReference && hasRateChanged}
        >
          Save Shipment
        </Button>
      </Flex>

    </div>
  );
};

export default NewShipment;
