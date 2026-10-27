import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Spin,
  message,
  Alert,
  Checkbox,
  AutoComplete,
  Flex,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import type { AppDispatch, RootState } from "../../app/store";
import {
  fetchCarrierRates,
  clearRateError,
  type CarrierSearchResult,
} from "../../store/customerRateSlice";
import { fetchAccessorials } from "../../store/accessorialsSlice";
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from "../../config/apiConfig";
import "./newshipment.css";

export interface CustomerRateProps {
  carrierData?: {
    carrierName?: string;
    carrierCode?: string;
    service?: string;
    price?: number;
    grossCharge?: number;
    discount?: number;
    fuelSurcharge?: number;
    grossCode?: string;
    discountCode?: string;
    fuelCode?: string;
    accessorialCharges?: {
      accessorialDescription?: string;
      accessorialCharge?: number;
      code?: string;
    }[];
  };
  clientCode?: string;
  isCorporate?: boolean;
  onRate?: (scac?: string) => void | Promise<void>;
  loadingRate?: boolean;
  rateError?: string | null;
  onClearError?: () => void;
  onSelectCarrier?: (
    carrier: { carrierId: string; carrierName: string } | null,
  ) => void;
  onRateDetailsChange?: (rates: {
    buyRate: {
      freight: number;
      fuel: number;
      discount: number;
      accesorialCostDetails: any[];
    };
    sellRate: {
      freight: number;
      fuel: number;
      discount: number;
      accesorialCostDetails: any[];
    };
  }) => void;
  clientMarkupConfig?: any;
  isFromReference?: boolean;
  hasRateChanged?: boolean;
  onRateChanged?: (changed: boolean) => void;
}

interface RateLineItem {
  id: string;
  code: string;
  description: string;
  buyAmount: number;
  customerAmount: number;
  markupAmount: number;
  markupCalculation?: string;
  markupSubtext?: string;
  customerCalcSubtext?: string;
  isCustom?: boolean;
  isEligibleForMarkup?: boolean;
}

const formatCurrency = (val: number): string => {
  if (val == null || isNaN(val)) return "$0.00";
  const isNeg = val < 0;
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNeg ? `($${abs})` : `$${abs}`;
};

const formatMarkup = (val: number, isPercent: boolean): string => {
  if (val == null || isNaN(val)) return isPercent ? "0.00%" : "$0.00";
  const isNeg = val < 0;
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (isPercent) {
    return isNeg ? `(${abs}%)` : `${abs}%`;
  }
  return isNeg ? `($${abs})` : `$${abs}`;
};

const CustomerRate: React.FC<CustomerRateProps> = ({
  carrierData,
  clientCode,
  isCorporate: propIsCorporate,
  onRate,
  loadingRate,
  rateError,
  onClearError,
  onSelectCarrier,
  onRateDetailsChange,
  clientMarkupConfig,
  isFromReference: _isFromReference = false,
  hasRateChanged = false,
  onRateChanged,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const customerRate = useSelector((state: RootState) => state.customerRate);
  const accessorialsList =
    useSelector((state: RootState) => state.accessorials?.data) || [];
  const { loading = false, error: storeError } = customerRate || {};
  const isRating = loadingRate ?? loading;
  const activeError = rateError !== undefined ? rateError : storeError;

  // isCorporate: true shows BUY AMOUNT and MARKUP; false hides them (read from Redux store / prop / localStorage)
  const storeIsCorporate = useSelector(
    (state: RootState) => state.app.isCorporate,
  );
  const clients =
    useSelector((state: RootState) => state.customerLocation?.clients) || [];
  const selectedClient = clientCode
    ? clients.find((c) => c.clientCode === clientCode)
    : undefined;

  const clientCorporateFlag = (
    selectedClient as { isCorporate?: boolean } | undefined
  )?.isCorporate;

  const isCorporate =
    propIsCorporate !== undefined
      ? propIsCorporate
      : typeof clientCorporateFlag === "boolean"
        ? clientCorporateFlag
        : (storeIsCorporate ??
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("isCorporate") === "true"));

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  // Markup & Net Sell Rate states
  const [isMarkupEnabled, setIsMarkupEnabled] = useState<boolean>(false);
  const [markupDropdownOption, setMarkupDropdownOption] =
    useState<string>("Flat");
  const [markupRate, setMarkupRate] = useState<string>("0");
  const [isMarkupRateDirty, setIsMarkupRateDirty] = useState<boolean>(false);
  const [markup, setMarkup] = useState<string>("0");
  const [isMarkupDirty, setIsMarkupDirty] = useState<boolean>(false);

  // Net Sell Rate states
  const [isNetSellRateEnabled, setIsNetSellRateEnabled] =
    useState<boolean>(false);
  const [netSellRate, setNetSellRate] = useState<string>("0");
  const [isNetSellDirty, setIsNetSellDirty] = useState<boolean>(false);

  // Charge amount input dirty state
  const [isChargeAmountDirty, setIsChargeAmountDirty] =
    useState<boolean>(false);

  // Track which table cells have been edited to keep border-bottom applied
  const [editedCellKeys, setEditedCellKeys] = useState<string[]>([]);

  // Reset red borders when rate is refreshed or clean
  useEffect(() => {
    if (!hasRateChanged) {
      setIsMarkupRateDirty(false);
      setIsMarkupDirty(false);
      setIsNetSellDirty(false);
      setIsChargeAmountDirty(false);
      setEditedCellKeys([]);
    }
  }, [hasRateChanged]);

  // Applied markup state (active and recalculated on table when applied)
  const [appliedMarkupConfig, setAppliedMarkupConfig] = useState<{
    isMarkupEnabled: boolean;
    markupDropdownOption: string;
    numericMarkup: number;
    numericMarkupRate?: number;
    isNetSellRateEnabled: boolean;
    numericNetSellRate: number;
    ppsFreight: number;
    ppsFuel: number;
  }>({
    isMarkupEnabled: false,
    markupDropdownOption: "Flat",
    numericMarkup: 0,
    numericMarkupRate: 0,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
    ppsFreight: 0,
    ppsFuel: 0,
  });

  useEffect(() => {
    if (clientMarkupConfig) {
      if (clientMarkupConfig.markupType) {
        const raw = String(clientMarkupConfig.markupType).toLowerCase();
        if (raw.includes("netsell")) {
          setIsNetSellRateEnabled(true);
          setIsMarkupEnabled(false);
          const rateVal =
            clientMarkupConfig.rate != null
              ? String(clientMarkupConfig.rate)
              : "0";
          setNetSellRate(rateVal);
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
          const rateVal =
            clientMarkupConfig.rate != null
              ? String(clientMarkupConfig.rate)
              : "0";
          setMarkupRate(rateVal);
          const val =
            clientMarkupConfig.minimum != null
              ? String(clientMarkupConfig.minimum)
              : clientMarkupConfig.rate != null
                ? String(clientMarkupConfig.rate)
                : "0";
          setMarkup(val);
        }
      }
      return;
    }

    if (carrierData && (carrierData as any).markupType) {
      const raw = String((carrierData as any).markupType).toLowerCase();
      if (raw.includes("netsell")) {
        setIsNetSellRateEnabled(true);
        setIsMarkupEnabled(false);
        const rateVal =
          (carrierData as any).markup != null
            ? String((carrierData as any).markup)
            : "0";
        setNetSellRate(rateVal);
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
        const rateVal =
          (carrierData as any).rate != null
            ? String((carrierData as any).rate)
            : "0";
        setMarkupRate(rateVal);
        const val =
          (carrierData as any).minimum != null
            ? String((carrierData as any).minimum)
            : (carrierData as any).markup != null
              ? String((carrierData as any).markup)
              : "0";
        setMarkup(val);
      }
      return;
    }

    const fetchClientMarkup = async () => {
      const clientCodeToUse =
        clientCode ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      if (!clientCodeToUse) return;

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      try {
        console.log(
          `[CustomerRate] Calling GetClientMarkup API for clientCode: ${clientCodeToUse}`,
        );
        const response = await axios.get(
          `${API_BASE_URL}/ClientMarkupConfig/GetClientMarkup/${encodeURIComponent(clientCodeToUse)}`,
          { headers },
        );
        console.log(
          "[CustomerRate] GetClientMarkup API response:",
          response.data,
        );

        if (response.data?.isSuccess && response.data?.data) {
          const rawData = response.data.data;
          const config = Array.isArray(rawData) ? rawData[0] : rawData;
          if (config) {
            if (config.markupType) {
              const raw = String(config.markupType).toLowerCase();
              if (raw.includes("netsell")) {
                setIsNetSellRateEnabled(true);
                setIsMarkupEnabled(false);
                const rateVal = config.rate != null ? String(config.rate) : "0";
                setNetSellRate(rateVal);
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
                const val =
                  config.minimum != null
                    ? String(config.minimum)
                    : config.rate != null
                      ? String(config.rate)
                      : "0";
                setMarkup(val);
              }
            }
          }
        }
      } catch (error) {
        console.error("[CustomerRate] Error fetching GetClientMarkup:", error);
      }
    };

    fetchClientMarkup();
  }, [clientCode, clientMarkupConfig, carrierData]);

  // Carrier inputs and autocomplete state
  const [carrierName, setCarrierName] = useState<string>("");
  const [selectedCarrier, setSelectedCarrier] =
    useState<CarrierSearchResult | null>(null);
  const [carrierOptions, setCarrierOptions] = useState<
    {
      value: string;
      key: string;
      carrier: CarrierSearchResult;
      label: React.ReactNode;
    }[]
  >([]);
  const [loadingCarriers, setLoadingCarriers] = useState<boolean>(false);
  const searchCarrierTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom charge additions
  const [selectedChargeType, setSelectedChargeType] = useState<
    string | undefined
  >(undefined);
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [customCharges, setCustomCharges] = useState<
    { id: string; code: string; description: string; buyAmount: number }[]
  >([]);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Edit charge state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editBuyAmount, setEditBuyAmount] = useState<string>("");
  const [editCustomerAmount, setEditCustomerAmount] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [hasManuallyEditedCustomer, setHasManuallyEditedCustomer] =
    useState<boolean>(false);
  const [isBuyInputDirty, setIsBuyInputDirty] = useState<boolean>(false);
  const [isCustomerInputDirty, setIsCustomerInputDirty] =
    useState<boolean>(false);
  const [isDescInputDirty, setIsDescInputDirty] = useState<boolean>(false);
  const [editedAmounts, setEditedAmounts] = useState<
    Record<
      string,
      { buyAmount?: number; customerAmount?: number; description?: string }
    >
  >({});

  const activeCarrier = useMemo(() => {
    if (
      carrierData &&
      (carrierData.carrierName || carrierData.price || carrierData.grossCharge)
    ) {
      return carrierData;
    }
    return null;
  }, [carrierData]);

  const prevActiveCarrierRef = useRef<any>(null);

  useEffect(() => {
    const prev = prevActiveCarrierRef.current;
    const hasChanged =
      prev?.carrierName !== activeCarrier?.carrierName ||
      prev?.carrierCode !== activeCarrier?.carrierCode ||
      prev?.price !== activeCarrier?.price;

    if (hasChanged) {
      prevActiveCarrierRef.current = activeCarrier;
      setRemovedLineIds([]);
      setEditedAmounts({});
      setEditingRowId(null);
      setEditedCellKeys([]);
      setIsMarkupRateDirty(false);
      setAppliedMarkupConfig({
        isMarkupEnabled: false,
        markupDropdownOption: "Flat",
        numericMarkup: 0,
        numericMarkupRate: 0,
        isNetSellRateEnabled: false,
        numericNetSellRate: 0,
        ppsFreight: 0,
        ppsFuel: 0,
      });
      if (activeCarrier) {
        setCarrierName(activeCarrier.carrierName || "");
        if (activeCarrier.carrierCode || activeCarrier.carrierName) {
          setSelectedCarrier({
            carrierId: activeCarrier.carrierCode || "",
            carrierName: activeCarrier.carrierName || "",
          });
        }
      }
    }
  }, [activeCarrier]);

  // Clean up timeouts and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (searchCarrierTimeoutRef.current) {
        clearTimeout(searchCarrierTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch carriers from GET /api/Carrier/SearchCarriers
  const fetchCarriersList = async (query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingCarriers(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await axios.get(
        `${API_BASE_URL}/Carrier/SearchCarriers`,
        {
          params: { searchText: query || "" },
          headers,
          signal: controller.signal,
        },
      );

      let list: CarrierSearchResult[] = [];
      if (
        response.data &&
        response.data.isSuccess &&
        Array.isArray(response.data.data)
      ) {
        list = response.data.data;
      } else if (Array.isArray(response.data?.data)) {
        list = response.data.data;
      } else if (Array.isArray(response.data)) {
        list = response.data;
      }

      const options = list.map((c, idx) => ({
        value: c.carrierName || c.carrierId,
        key: `carrier-${c.carrierId || idx}-${idx}`,
        carrier: c,
        label: (
          <div className="carrier-select-option">
            <span className="carrier-select-name">{c.carrierName}</span>
            {c.carrierId && (
              <span className="carrier-select-badge">{c.carrierId}</span>
            )}
          </div>
        ),
      }));

      setCarrierOptions(options);
    } catch (err: any) {
      if (err.name !== "CanceledError" && !axios.isCancel(err)) {
        console.error("Error fetching carriers:", err);
      }
    } finally {
      setLoadingCarriers(false);
    }
  };

  const handleSearchCarriers = (searchText: string) => {
    if (searchCarrierTimeoutRef.current) {
      clearTimeout(searchCarrierTimeoutRef.current);
    }
    searchCarrierTimeoutRef.current = setTimeout(() => {
      fetchCarriersList(searchText);
    }, 300);
  };

  const handleSelectCarrier = (val: string, option: any) => {
    const carrier: CarrierSearchResult = option?.carrier || {
      carrierId: "",
      carrierName: val,
    };
    setCarrierName(carrier.carrierName);
    setSelectedCarrier(carrier);
    setRemovedLineIds([]);
    setEditedAmounts({});
    setEditingRowId(null);
    if (onSelectCarrier) {
      onSelectCarrier(carrier);
    }
  };

  const handleChangeCarrier = (val: string) => {
    const textVal =
      typeof val === "string" ? val : ((val as any)?.target?.value ?? "");
    setCarrierName(textVal);
    if (!textVal) {
      setSelectedCarrier(null);
      setRemovedLineIds([]);
      setEditedAmounts({});
      setEditingRowId(null);
      if (onSelectCarrier) {
        onSelectCarrier(null);
      }
      fetchCarriersList("");
    }
  };

  const handleCarrierFocus = () => {
    if (carrierOptions.length === 0) {
      fetchCarriersList(carrierName || "");
    }
  };

  const isFreightCharge = (code?: string, description?: string) => {
    const c = (code || "").trim().toUpperCase();
    const d = (description || "").trim().toLowerCase();
    return c === "FRT" || d === "freight";
  };

  const isFuelCharge = (code?: string, _description?: string) => {
    return (code || "").trim().toUpperCase() === "FSC";
  };

  const isDiscountCharge = (code?: string, _description?: string) => {
    const c = (code || "").trim().toUpperCase();
    return c === "DSC" || c === "DISC";
  };

  // Line items
  const lineItems = useMemo<RateLineItem[]>(() => {
    const rawItems: {
      id: string;
      code: string;
      description: string;
      buyAmount: number;
      isCustom?: boolean;
    }[] = [];

    if (activeCarrier) {
      const gross =
        Number(activeCarrier.grossCharge) ||
        (Number(activeCarrier.price) > 0 ? Number(activeCarrier.price) : 0);
      const discount = Number(activeCarrier.discount) || 0;
      const fuel = Number(activeCarrier.fuelSurcharge) || 0;
      const accessorials = activeCarrier.accessorialCharges || [];

      // 1. FREIGHT Charge
      if (!removedLineIds.includes("line-gross")) {
        const customBuy = editedAmounts["line-gross"]?.buyAmount;
        rawItems.push({
          id: "line-gross",
          code: "FRT",
          description: editedAmounts["line-gross"]?.description || "Freight",
          buyAmount: customBuy !== undefined ? customBuy : gross,
        });
      }

      // 2. DISCOUNT
      if (
        (discount > 0 || activeCarrier.discountCode) &&
        !removedLineIds.includes("line-discount")
      ) {
        const customBuy = editedAmounts["line-discount"]?.buyAmount;
        rawItems.push({
          id: "line-discount",
          code: "DSC",
          description:
            editedAmounts["line-discount"]?.description || "Discount",
          buyAmount: customBuy !== undefined ? customBuy : -Math.abs(discount),
        });
      }

      // 3. FUEL Surcharge
      if (!removedLineIds.includes("line-fuel")) {
        const customBuy = editedAmounts["line-fuel"]?.buyAmount;
        rawItems.push({
          id: "line-fuel",
          code: "FSC",
          description:
            editedAmounts["line-fuel"]?.description || "Fuel surcharge",
          buyAmount: customBuy !== undefined ? customBuy : fuel,
        });
      }

      // 4. Accessorial charges
      accessorials.forEach((acc, idx) => {
        const amt = Number(acc.accessorialCharge) || 0;
        const accId = `line-acc-${idx}`;
        if (amt > 0 && !removedLineIds.includes(accId)) {
          const customBuy = editedAmounts[accId]?.buyAmount;
          rawItems.push({
            id: accId,
            code: acc.code || (acc as any).accesorialCode || "",
            description:
              editedAmounts[accId]?.description ||
              acc.accessorialDescription ||
              "",
            buyAmount: customBuy !== undefined ? customBuy : amt,
          });
        }
      });
    }

    // 5. Custom charges added by user
    customCharges.forEach((c) => {
      if (!removedLineIds.includes(c.id)) {
        const customBuy = editedAmounts[c.id]?.buyAmount;
        rawItems.push({
          id: c.id,
          code: c.code,
          description: editedAmounts[c.id]?.description || c.description,
          buyAmount: customBuy !== undefined ? customBuy : c.buyAmount,
          isCustom: true,
        });
      }
    });

    const isMarkupActive =
      appliedMarkupConfig.isMarkupEnabled &&
      (appliedMarkupConfig.numericMarkup > 0 ||
        (appliedMarkupConfig.numericMarkupRate ?? 0) > 0);
    const isNetSellActive =
      appliedMarkupConfig.isNetSellRateEnabled &&
      appliedMarkupConfig.numericNetSellRate > 0;

    const ppsFreight =
      isMarkupActive || isNetSellActive
        ? appliedMarkupConfig.ppsFreight || 0
        : 0;
    const ppsFuel =
      isMarkupActive || isNetSellActive ? appliedMarkupConfig.ppsFuel || 0 : 0;

    return rawItems.map((item) => {
      const isDiscount = isDiscountCharge(item.code);
      const isFreight = !isDiscount && isFreightCharge(item.code);
      const isFuel = isFuelCharge(item.code);

      const overrideCust = editedAmounts[item.id]?.customerAmount;

      let currentBuy = item.buyAmount;
      let calculatedCust = item.buyAmount;
      let calculatedMarkup = 0;
      let isEligible = false;

      if (isNetSellActive) {
        if (isFreight) {
          isEligible = true;
          currentBuy = item.buyAmount;
          calculatedCust = appliedMarkupConfig.numericNetSellRate;
          calculatedMarkup = appliedMarkupConfig.numericNetSellRate;
        } else if (isFuel) {
          isEligible = true;
          currentBuy = 0;
          calculatedCust = 0;
          calculatedMarkup = 0;
        } else {
          isEligible = false;
          currentBuy = 0;
          calculatedCust = 0;
          calculatedMarkup = 0;
        }
      } else {
        if (isFreight) {
          isEligible = true;
          calculatedMarkup = ppsFreight;
          calculatedCust = item.buyAmount + ppsFreight;
        } else if (isFuel) {
          isEligible = true;
          calculatedMarkup = ppsFuel;
          calculatedCust = item.buyAmount + ppsFuel;
        }
      }

      const custAmt =
        overrideCust !== undefined ? overrideCust : calculatedCust;
      const finalMarkup = calculatedMarkup;

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        buyAmount: currentBuy,
        customerAmount: custAmt,
        markupAmount: finalMarkup,
        markupCalculation: "",
        markupSubtext: "",
        customerCalcSubtext: "",
        isCustom: item.isCustom,
        isEligibleForMarkup: isEligible || finalMarkup > 0,
      };
    });
  }, [
    activeCarrier,
    customCharges,
    removedLineIds,
    editedAmounts,
    appliedMarkupConfig,
  ]);

  // Totals
  const freightLines = lineItems.filter(
    (i) => !isDiscountCharge(i.code) && isFreightCharge(i.code),
  );
  const discountLines = lineItems.filter((i) => isDiscountCharge(i.code));
  // const fuelLines = lineItems.filter((i) => isFuelCharge(i.code, i.description));

  // const netFreightBuy =
  //   freightLines.reduce((acc, item) => acc + item.buyAmount, 0) +
  //   discountLines.reduce((acc, item) => acc + item.buyAmount, 0);
  // const netFreightCustomer =
  //   freightLines.reduce((acc, item) => acc + item.customerAmount, 0) +
  //   discountLines.reduce((acc, item) => acc + item.customerAmount, 0);
  // const netFreightMarkup =
  //   freightLines.reduce((acc, item) => acc + item.markupAmount, 0) +
  //   discountLines.reduce((acc, item) => acc + item.markupAmount, 0);

  const totalBuy = lineItems.reduce((acc, item) => acc + item.buyAmount, 0);
  const totalCustomer = lineItems.reduce(
    (acc, item) => acc + item.customerAmount,
    0,
  );
  const totalMarkup = lineItems.reduce(
    (acc, item) => acc + item.markupAmount,
    0,
  );

  const isPercentMarkup = useMemo(() => {
    if (appliedMarkupConfig.isNetSellRateEnabled || isNetSellRateEnabled) {
      return false;
    }
    const activeOption = appliedMarkupConfig.isMarkupEnabled
      ? appliedMarkupConfig.markupDropdownOption
      : markupDropdownOption;
    return Boolean(activeOption && activeOption.includes("%"));
  }, [
    appliedMarkupConfig.isNetSellRateEnabled,
    appliedMarkupConfig.isMarkupEnabled,
    appliedMarkupConfig.markupDropdownOption,
    isNetSellRateEnabled,
    markupDropdownOption,
  ]);

  const prevRatesRef = useRef<string>("");

  useEffect(() => {
    if (!onRateDetailsChange) return;

    const buyFreight = freightLines.reduce(
      (acc, item) => acc + item.buyAmount,
      0,
    );
    const buyDiscount = Math.abs(
      discountLines.reduce((acc, item) => acc + item.buyAmount, 0),
    );
    const fuelLines = lineItems.filter((i) => isFuelCharge(i.code));
    const buyFuel = fuelLines.reduce((acc, item) => acc + item.buyAmount, 0);

    const sellFreight = freightLines.reduce(
      (acc, item) => acc + item.customerAmount,
      0,
    );
    const sellDiscount = Math.abs(
      discountLines.reduce((acc, item) => acc + item.customerAmount, 0),
    );
    const sellFuel = fuelLines.reduce(
      (acc, item) => acc + item.customerAmount,
      0,
    );

    const otherLines = lineItems.filter(
      (i) =>
        !isFreightCharge(i.code) &&
        !isDiscountCharge(i.code) &&
        !isFuelCharge(i.code),
    );

    const buyAccesorials = otherLines.map((i) => ({
      accCode: i.code || "ACC",
      ratedCost: Number(i.buyAmount) || 0,
      description: i.description || "",
      billedCost: Number(i.buyAmount) || 0,
    }));

    const sellAccesorials = otherLines.map((i) => ({
      accCode: i.code || "ACC",
      ratedCost: Number(i.customerAmount) || 0,
      description: i.description || "",
      billedCost: Number(i.customerAmount) || 0,
    }));

    const ratesObj = {
      buyRate: {
        freight: buyFreight,
        fuel: buyFuel,
        discount: buyDiscount,
        accesorialCostDetails: buyAccesorials,
      },
      sellRate: {
        freight: sellFreight,
        fuel: sellFuel,
        discount: sellDiscount,
        accesorialCostDetails: sellAccesorials,
      },
    };

    const serialized = JSON.stringify(ratesObj);
    if (prevRatesRef.current !== serialized) {
      prevRatesRef.current = serialized;
      onRateDetailsChange(ratesObj);
    }
  }, [lineItems, onRateDetailsChange]);

  // Options for Charge type Select dropdown from Accessorials API list
  const chargeTypeOptions = useMemo(() => {
    if (!Array.isArray(accessorialsList) || accessorialsList.length === 0) {
      return [];
    }
    return accessorialsList
      .filter((a: any) =>
        Boolean(a.accessorialName || a.description || a.accesorialCode),
      )
      .map((a: any) => {
        const name = (a.accessorialName || a.description || "").trim();
        const code = (a.accesorialCode || "").trim().toUpperCase();
        const isAlreadyAdded = lineItems.some((item) => {
          const matchCode = Boolean(
            code && item.code && item.code.trim().toUpperCase() === code,
          );
          const matchDesc = Boolean(
            item.description &&
            item.description.trim().toLowerCase() === name.toLowerCase(),
          );
          return matchCode || matchDesc;
        });

        return {
          value: name,
          label: name,
          code: code,
          key: `acc-${a.accessorialID || name}`,
          disabled: isAlreadyAdded,
        };
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      );
  }, [accessorialsList, lineItems]);

  // Add charge handler
  const handleAddCharge = () => {
    if (!selectedChargeType) {
      message.warning("Please select a Charge type first.");
      return;
    }
    const amt = parseFloat(chargeAmount);
    if (isNaN(amt) || amt <= 0) {
      message.warning("Please enter a valid amount greater than 0.");
      return;
    }

    const matched = chargeTypeOptions.find(
      (o) => o.value === selectedChargeType || o.label === selectedChargeType,
    );
    const code = matched?.code || "";
    const description = matched?.label || selectedChargeType;

    // Check if charge is already in the table
    const isDuplicate = lineItems.some((item) => {
      const matchCode = Boolean(
        code && item.code && item.code.trim().toUpperCase() === code,
      );
      const matchDesc = Boolean(
        item.description &&
        item.description.trim().toLowerCase() ===
          description.trim().toLowerCase(),
      );
      return matchCode || matchDesc;
    });

    if (isDuplicate) {
      message.warning(`"${description}" is already added.`);
      return;
    }

    const newCharge = {
      id: `custom-${Date.now()}`,
      code,
      description,
      buyAmount: amt,
    };

    setCustomCharges((prev) => [...prev, newCharge]);
    setChargeAmount("");
    setSelectedChargeType(undefined);
    onRateChanged?.(true);
    message.success(`Added charge: ${description}`);
  };

  // Remove charge handler
  const handleRemoveCharge = (idToRemove?: string) => {
    const targetId = idToRemove || selectedRowId;
    if (!targetId) {
      const removableItems = lineItems.filter(
        (i) => !isFreightCharge(i.code, i.description),
      );
      if (removableItems.length > 0) {
        const last = removableItems[removableItems.length - 1];
        handleRemoveCharge(last.id);
      } else {
        message.info("Select a charge row to remove.");
      }
      return;
    }

    const targetItem = lineItems.find((item) => item.id === targetId);
    if (
      targetItem &&
      isFreightCharge(targetItem.code, targetItem.description)
    ) {
      message.warning("Freight charge cannot be removed.");
      return;
    }

    const isCustom = customCharges.some((c) => c.id === targetId);
    if (isCustom) {
      setCustomCharges((prev) => prev.filter((c) => c.id !== targetId));
    } else {
      setRemovedLineIds((prev) =>
        prev.includes(targetId) ? prev : [...prev, targetId],
      );
    }

    if (selectedRowId === targetId) setSelectedRowId(null);
    if (editingRowId === targetId) setEditingRowId(null);
    onRateChanged?.(true);
    message.success("Charge removed.");
  };

  // Edit charge handlers
  const handleStartEdit = (item: RateLineItem) => {
    setEditingRowId(item.id);
    const buyVal =
      item.buyAmount < 0
        ? String(Math.abs(item.buyAmount))
        : String(item.buyAmount);
    const custVal =
      item.customerAmount < 0
        ? String(Math.abs(item.customerAmount))
        : String(item.customerAmount);
    setEditBuyAmount(buyVal);
    setEditCustomerAmount(custVal);
    setEditDescription(item.description);
    setHasManuallyEditedCustomer(false);
    setIsBuyInputDirty(false);
    setIsCustomerInputDirty(false);
    setIsDescInputDirty(false);
  };

  const handleBuyAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setEditBuyAmount(cleaned);
    setIsBuyInputDirty(true);
    setIsCustomerInputDirty(false);
    setHasManuallyEditedCustomer(false);
    onRateChanged?.(true);
  };

  const handleCustomerAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setEditCustomerAmount(cleaned);
    setHasManuallyEditedCustomer(true);
    setIsCustomerInputDirty(true);
    setIsBuyInputDirty(false);
    onRateChanged?.(true);
  };

  const handleSaveEdit = () => {
    if (!editingRowId) return;

    const targetItem = lineItems.find((i) => i.id === editingRowId);
    if (!targetItem) {
      setEditingRowId(null);
      return;
    }

    const isDiscount = isDiscountCharge(
      targetItem.code,
      targetItem.description,
    );
    const rawBuy = parseFloat(editBuyAmount) || 0;
    const rawCustomer = parseFloat(editCustomerAmount) || 0;

    const newBuy = isDiscount ? -Math.abs(rawBuy) : Math.max(0, rawBuy);
    const newCustomer = isDiscount
      ? -Math.abs(rawCustomer)
      : Math.max(0, rawCustomer);

    const isBuyChanged =
      isBuyInputDirty && Math.abs(newBuy - targetItem.buyAmount) > 0.001;
    const isCustomerChanged =
      isCustomerInputDirty &&
      hasManuallyEditedCustomer &&
      Math.abs(newCustomer - targetItem.customerAmount) > 0.001;
    const isDescChanged =
      isDescInputDirty && editDescription.trim() !== targetItem.description;

    setEditedAmounts((prev) => {
      const existing = prev[editingRowId] || {};
      const updatedRow: {
        buyAmount?: number;
        customerAmount?: number;
        description?: string;
      } = { ...existing };

      if (isBuyChanged && !isCustomerChanged) {
        updatedRow.buyAmount = newBuy;
        updatedRow.customerAmount = targetItem.customerAmount;
      } else if (isCustomerChanged && !isBuyChanged) {
        updatedRow.customerAmount = newCustomer;
        delete updatedRow.buyAmount;
      } else if (isBuyChanged && isCustomerChanged) {
        updatedRow.buyAmount = newBuy;
        updatedRow.customerAmount = newCustomer;
      }

      if (isDescChanged) {
        updatedRow.description = editDescription.trim();
      }

      return {
        ...prev,
        [editingRowId]: updatedRow,
      };
    });

    setEditedCellKeys((prev) => {
      const next = prev.filter(
        (key) =>
          key !== `${editingRowId}-buy` &&
          key !== `${editingRowId}-customer` &&
          key !== `${editingRowId}-desc`,
      );
      if (isBuyChanged) {
        next.push(`${editingRowId}-buy`);
      } else if (isCustomerChanged) {
        next.push(`${editingRowId}-customer`);
      }
      if (isDescChanged) {
        next.push(`${editingRowId}-desc`);
      }
      return next;
    });

    if (targetItem.isCustom) {
      setCustomCharges((prev) =>
        prev.map((c) =>
          c.id === editingRowId
            ? {
                ...c,
                buyAmount: isBuyChanged ? newBuy : c.buyAmount,
                description: isDescChanged
                  ? editDescription.trim()
                  : c.description,
              }
            : c,
        ),
      );
    }

    setEditingRowId(null);
    setIsBuyInputDirty(false);
    setIsCustomerInputDirty(false);
    setIsDescInputDirty(false);
    message.success(`Updated ${targetItem.description}`);
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setIsBuyInputDirty(false);
    setIsCustomerInputDirty(false);
    setIsDescInputDirty(false);
  };

  const handleApplyMarkup = () => {
    setEditedAmounts((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((key) => {
        next[key] = {
          buyAmount: prev[key].buyAmount,
          description: prev[key].description,
        };
      });
      return next;
    });

    const numRate = Math.max(0, Number(markupRate) || 0);
    const numMin = Math.max(0, Number(markup) || 0);
    const numMarkup = numRate > 0 ? numRate : numMin;
    const numNetSell = Math.max(0, Number(netSellRate) || 0);

    const currentFreightBuy =
      lineItems
        .filter((i) => !isDiscountCharge(i.code) && isFreightCharge(i.code))
        .reduce((acc, i) => acc + i.buyAmount, 0) +
      lineItems
        .filter((i) => isDiscountCharge(i.code))
        .reduce((acc, i) => acc + i.buyAmount, 0);

    const currentFuelBuy = lineItems
      .filter((i) => isFuelCharge(i.code))
      .reduce((acc, i) => acc + i.buyAmount, 0);

    const currentTotalBuy = lineItems.reduce((acc, i) => acc + i.buyAmount, 0);

    let ppsFreight = 0;
    let ppsFuel = 0;

    if (isNetSellRateEnabled && numNetSell > 0) {
      ppsFreight = numNetSell;
      ppsFuel = 0;
    } else if (isMarkupEnabled && (numRate > 0 || numMin > 0)) {
      const rateToUse = numRate > 0 ? numRate : numMin;
      let calculatedMarkup = 0;

      if (markupDropdownOption === "Flat") {
        calculatedMarkup = rateToUse;
      } else if (markupDropdownOption === "% Freight") {
        calculatedMarkup = currentFreightBuy * (rateToUse / 100);
        if (calculatedMarkup < numMin) {
          calculatedMarkup = numMin;
        }
      } else if (markupDropdownOption === "% Freight + Fuel") {
        calculatedMarkup =
          (currentFreightBuy + currentFuelBuy) * (rateToUse / 100);
        if (calculatedMarkup < numMin) {
          calculatedMarkup = numMin;
        }
      } else if (markupDropdownOption === "% Freight + Fuel + Accessorial") {
        calculatedMarkup = currentTotalBuy * (rateToUse / 100);
        if (calculatedMarkup < numMin) {
          calculatedMarkup = numMin;
        }
      }

      const totalMarkupToDistribute = calculatedMarkup;

      const baseTotal = currentFreightBuy + currentFuelBuy;
      if (totalMarkupToDistribute > 0 && baseTotal > 0) {
        const freightPercent =
          Math.round((currentFreightBuy / baseTotal) * 10000) / 100;
        const fuelPercent =
          Math.round((currentFuelBuy / baseTotal) * 10000) / 100;

        ppsFreight =
          Math.round(((totalMarkupToDistribute * freightPercent) / 100) * 100) /
          100;
        ppsFuel =
          Math.round(((totalMarkupToDistribute * fuelPercent) / 100) * 100) /
          100;

        if (Math.abs(ppsFreight + ppsFuel - totalMarkupToDistribute) > 0.0001) {
          ppsFuel =
            Math.round((totalMarkupToDistribute - ppsFreight) * 100) / 100;
        }
      }
    }

    setAppliedMarkupConfig({
      isMarkupEnabled,
      markupDropdownOption,
      numericMarkup: numMin,
      numericMarkupRate: numRate,
      isNetSellRateEnabled,
      numericNetSellRate: numNetSell,
      ppsFreight,
      ppsFuel,
    });

    if (isMarkupEnabled && numMarkup > 0) {
      message.success(`Applied ${markupDropdownOption} markup`);
    } else if (isNetSellRateEnabled && numNetSell > 0) {
      message.success("Applied Net Sell Rate");
    } else if (!isMarkupEnabled && !isNetSellRateEnabled) {
      message.info("Markup removed");
    } else {
      message.info("Applied");
    }
  };

  const handleRateClick = () => {
    setIsMarkupRateDirty(false);
    setIsMarkupDirty(false);
    setIsNetSellDirty(false);
    setIsChargeAmountDirty(false);
    setEditedCellKeys([]);
    onRateChanged?.(false);
    if (onRate) {
      onRate(selectedCarrier?.carrierId);
    } else {
      dispatch(fetchCarrierRates({ scac: selectedCarrier?.carrierId }));
    }
  };

  return (
    <Card title="Customer Rate" className="customer-rate-panel">
      {activeError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => {
            dispatch(clearRateError());
            if (onClearError) onClearError();
          }}
          message="Rating API Error"
          description={activeError}
        />
      )}

      <Form layout="vertical" className="compact-form">
        {/* Row 1: Carrier + Markup / Net Sell Rate */}
        <div className="mb-16 customer-rate-header-row">
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
                    onRateChanged?.(true);
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
                        onRateChanged?.(true);
                      }}
                      style={{ minWidth: 230 }}
                      size="medium"
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
                      <Input
                        value={markupRate}
                        status={isMarkupRateDirty ? "error" : undefined}
                        className={`input-sm-center ${isMarkupRateDirty ? "border-red-highlight" : ""}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          setMarkupRate(val);
                          setIsMarkupRateDirty(true);
                          onRateChanged?.(true);
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
                      {markupDropdownOption === "Flat" && (
                        <span className="markup-unit-symbol">$</span>
                      )}
                      <Input
                        value={markup}
                        disabled
                        className="input-sm-center"
                      />
                      {markupDropdownOption !== "Flat" && (
                        <span className="markup-unit-symbol">%</span>
                      )}
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
                    onRateChanged?.(true);
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
                        onRateChanged?.(true);
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

        <Row className="mb-16">
          <div className="cr-carrier-col">
            <Form.Item noStyle>
              <AutoComplete
                value={carrierName}
                options={carrierOptions}
                onSearch={handleSearchCarriers}
                onSelect={handleSelectCarrier}
                onChange={handleChangeCarrier}
                onFocus={handleCarrierFocus}
                onClear={() => {
                  setCarrierName("");
                  setSelectedCarrier(null);
                  if (onSelectCarrier) onSelectCarrier(null);
                  fetchCarriersList("");
                }}
                placeholder="Carrier"
                allowClear
                className="w-100"
                notFoundContent={
                  loadingCarriers ? (
                    <div className="carrier-select-loading">
                      <Spin size="small" />
                    </div>
                  ) : undefined
                }
              />
            </Form.Item>
          </div>
        </Row>

        {/* Row 3: Charge type + Amount + Add + Apply + Rate */}
        <Row gutter={[12, 12]} className="mb-16 flex-align-center">
          <Col xs={24} md={10}>
            <Form.Item noStyle>
              <Select
                placeholder="Charge type"
                className="w-100"
                value={selectedChargeType}
                onChange={(val) => setSelectedChargeType(val)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.label || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={chargeTypeOptions}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={5}>
            <Form.Item noStyle>
              <Input
                placeholder="Amount"
                value={chargeAmount}
                status={isChargeAmountDirty ? "error" : undefined}
                className={isChargeAmountDirty ? "border-red-highlight" : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setChargeAmount(val);
                  setIsChargeAmountDirty(true);
                  onRateChanged?.(true);
                }}
                onPressEnter={handleAddCharge}
              />
            </Form.Item>
          </Col>
          <Col>
            <Button
              type="primary"
              className="btn-warning"
              onClick={handleAddCharge}
            >
              Add
            </Button>
          </Col>

          <Col>
            <Button
              type="primary"
              className="btn-success"
              onClick={handleRateClick}
              loading={isRating}
            >
              Rate
            </Button>
          </Col>
        </Row>
      </Form>

      {/* Rate Table */}
      <div className="rate-table-wrapper">
        <div className="rate-table-content">
          <div className="rate-header-row">
            <div className="col-code">CODE</div>
            <div className="col-desc">DESCRIPTION</div>
            {isCorporate && (
              <div className="col-buy text-right">BUY AMOUNT</div>
            )}
            <div className="col-customer text-right">CUSTOMER AMOUNT</div>
            {isCorporate && <div className="col-markup text-right">MARKUP</div>}
            {isCorporate && <div className="col-actions" />}
          </div>
          {lineItems.length > 0 ? (
            lineItems.map((item) => {
              const isEditing = editingRowId === item.id;
              const isBuyEdited = editedCellKeys.includes(`${item.id}-buy`);
              const isCustomerEdited = editedCellKeys.includes(
                `${item.id}-customer`,
              );
              const isDescEdited = editedCellKeys.includes(`${item.id}-desc`);

              const buyInputClass =
                isBuyInputDirty || (isBuyEdited && !isCustomerInputDirty)
                  ? "table-input-edited"
                  : "";
              const custInputClass =
                isCustomerInputDirty || (isCustomerEdited && !isBuyInputDirty)
                  ? "table-input-edited"
                  : "";
              const descInputClass =
                isDescInputDirty || isDescEdited ? "table-input-edited" : "";

              return (
                <div
                  key={item.id}
                  className={`rate-item-row ${selectedRowId === item.id ? "is-selected" : ""} ${isEditing ? "is-editing" : ""}`}
                  onClick={() =>
                    setSelectedRowId(selectedRowId === item.id ? null : item.id)
                  }
                  onDoubleClick={() => handleStartEdit(item)}
                >
                  <div className="col-code">{item.code}</div>
                  <div className="col-desc">
                    {isEditing && item.isCustom ? (
                      <Input
                        size="small"
                        value={editDescription}
                        onChange={(e) => {
                          setEditDescription(e.target.value);
                          setIsDescInputDirty(true);
                          onRateChanged?.(true);
                        }}
                        onPressEnter={handleSaveEdit}
                        onClick={(e) => e.stopPropagation()}
                        className={`rate-desc-edit-input ${descInputClass}`}
                      />
                    ) : (
                      <span
                        className={
                          isDescEdited ? "table-cell-edited" : undefined
                        }
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                  {isCorporate && (
                    <div className="col-buy text-right">
                      {isEditing ? (
                        <Input
                          size="small"
                          prefix="$"
                          value={editBuyAmount}
                          onChange={(e) =>
                            handleBuyAmountChange(e.target.value)
                          }
                          onPressEnter={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`rate-inline-edit-input ${buyInputClass}`}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={
                            isBuyEdited ? "table-cell-edited" : undefined
                          }
                        >
                          {formatCurrency(item.buyAmount)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="col-customer text-right">
                    {isEditing ? (
                      <Input
                        size="small"
                        prefix="$"
                        value={editCustomerAmount}
                        onChange={(e) =>
                          handleCustomerAmountChange(e.target.value)
                        }
                        onPressEnter={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`rate-inline-edit-input ${custInputClass}`}
                      />
                    ) : (
                      <span
                        className={`
                          ${item.buyAmount > item.customerAmount ? "rate-cell-loss" : "rate-markup-val"}
                          ${isCustomerEdited ? "table-cell-edited" : ""}
                        `}
                      >
                        {formatCurrency(item.customerAmount)}
                      </span>
                    )}
                  </div>
                  {isCorporate && (
                    <div className="col-markup text-right">
                      {item.isEligibleForMarkup ? (
                        <span
                          className={`rate-markup-val ${item.markupAmount > 0 ? "has-markup" : ""}`}
                        >
                          {formatMarkup(item.markupAmount, isPercentMarkup)}
                        </span>
                      ) : (
                        <span className="rate-markup-dash">-</span>
                      )}
                    </div>
                  )}
                  {isCorporate && (
                    <div className="col-actions">
                      <Flex align="center" justify="flex-end" gap={4}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="rate-action-btn rate-save-btn"
                              title="Save"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit();
                              }}
                            >
                              <CheckOutlined />
                            </button>
                            <button
                              type="button"
                              className="rate-action-btn rate-cancel-btn"
                              title="Cancel"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                            >
                              <CloseOutlined />
                            </button>
                          </>
                        ) : (
                          <>
                            <Button
                              title="Edit charge"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(item);
                              }}
                              icon={<EditOutlined />}
                              danger
                              type="text"
                              size="small"
                            />

                            {!isFreightCharge(item.code, item.description) ? (
                              <Button
                                title="Remove charge"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCharge(item.id);
                                }}
                                icon={<DeleteOutlined />}
                                danger
                                type="text"
                                size="small"
                              />
                            ) : (
                              <span className="rate-action-placeholder" />
                            )}
                          </>
                        )}
                      </Flex>
                    </div>
                  )}
                </div>
              );
            })
          ) : isRating ? (
            <div className="rate-empty-state">
              <Spin />
            </div>
          ) : (
            <div className="rate-empty-state">
              No rates added yet. Click Rate to fetch carrier pricing.
            </div>
          )}

          {/* Totals inside rate-table-content for 100% synchronized horizontal alignment */}
          <div className="rate-totals-section">
            {/* <div className="rate-total-summary-row mb-12 text-muted-13">
              <div className="col-code"></div>
              <div className="col-desc">Net Freight</div>
              {isCorporate && (
                <div className="col-buy text-right">
                  <strong className="text-dark-13">
                    {formatCurrency(netFreightBuy)}
                  </strong>
                </div>
              )}
              <div className="col-customer text-right">
                <strong
                  className={`text-dark-13 ${netFreightBuy > netFreightCustomer ? "rate-cell-loss" : ""}`}
                >
                  {formatCurrency(netFreightCustomer)}
                </strong>
              </div>
              {isCorporate && (
                <div className="col-markup text-right">
                  <strong className="text-dark-13">
                    {formatCurrency(netFreightMarkup)}
                  </strong>
                </div>
              )}
              {isCorporate && <div className="col-actions" />}
            </div> */}
            <div className="rate-total-summary-row mb-16 rate-total-row">
              <div className="col-code"></div>
              <div className="col-desc">Total</div>
              {isCorporate && (
                <div className="col-buy text-right">
                  <span>{formatCurrency(totalBuy)}</span>
                </div>
              )}
              <div className="col-customer text-right">
                <span
                  className={totalBuy > totalCustomer ? "rate-cell-loss" : ""}
                >
                  {formatCurrency(totalCustomer)}
                </span>
              </div>
              {isCorporate && (
                <div className="col-markup text-right">
                  <span>{formatMarkup(totalMarkup, isPercentMarkup)}</span>
                </div>
              )}
              {isCorporate && <div className="col-actions" />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CustomerRate;
