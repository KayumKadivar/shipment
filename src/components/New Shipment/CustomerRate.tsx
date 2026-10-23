import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  ExclamationCircleOutlined,
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
  isFromReference = false,
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

  const isCorporate =
    propIsCorporate !== undefined
      ? propIsCorporate
      : (typeof selectedClient?.isCorporate === "boolean"
          ? selectedClient.isCorporate
          : (storeIsCorporate ??
            (typeof localStorage !== "undefined" &&
              localStorage.getItem("isCorporate") === "true")));

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  // Markup & Net Sell Rate states
  const [isMarkupEnabled, setIsMarkupEnabled] = useState<boolean>(false);
  const [markupDropdownOption, setMarkupDropdownOption] =
    useState<string>("% Freight");
  const [markup, setMarkup] = useState<string>("0");

  const [isNetSellRateEnabled, setIsNetSellRateEnabled] =
    useState<boolean>(false);
  const [netSellRate, setNetSellRate] = useState<string>("0");

  // Applied markup state (only active/recalculated when user clicks 'Apply')
  const [appliedMarkupConfig, setAppliedMarkupConfig] = useState<{
    isMarkupEnabled: boolean;
    markupDropdownOption: string;
    numericMarkup: number;
    isNetSellRateEnabled: boolean;
    numericNetSellRate: number;
  }>({
    isMarkupEnabled: false,
    markupDropdownOption: "% Freight",
    numericMarkup: 0,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
  });

  interface BaselineSnapshot {
    carrierName: string;
    isMarkupEnabled: boolean;
    markupDropdownOption: string;
    markup: string;
    isNetSellRateEnabled: boolean;
    netSellRate: string;
    topCount: string;
    baseBuyAmounts: Record<string, number>;
    baseDescriptions: Record<string, string>;
    baseCustomerAmounts: Record<string, number>;
  }

  const baselineRef = useRef<BaselineSnapshot | null>(null);
  const hasUserInteractedRef = useRef<boolean>(false);

  const syncBaselineMarkup = (opts: {
    isMarkupEnabled: boolean;
    markupDropdownOption?: string;
    markup?: string;
    isNetSellRateEnabled: boolean;
    netSellRate?: string;
  }) => {
    if (baselineRef.current) {
      baselineRef.current.isMarkupEnabled = opts.isMarkupEnabled;
      if (opts.markupDropdownOption !== undefined) {
        baselineRef.current.markupDropdownOption = opts.markupDropdownOption;
      }
      if (opts.markup !== undefined) {
        baselineRef.current.markup = opts.markup;
      }
      baselineRef.current.isNetSellRateEnabled = opts.isNetSellRateEnabled;
      if (opts.netSellRate !== undefined) {
        baselineRef.current.netSellRate = opts.netSellRate;
      }
    }
  };

  useEffect(() => {
    if (clientMarkupConfig) {
      if (clientMarkupConfig.markupType) {
        const raw = String(clientMarkupConfig.markupType).toLowerCase();
        if (raw.includes("netsell")) {
          setIsNetSellRateEnabled(true);
          setIsMarkupEnabled(false);
          if (clientMarkupConfig.rate != null) {
            setNetSellRate(String(clientMarkupConfig.rate));
          }
        } else {
          setIsMarkupEnabled(true);
          setIsNetSellRateEnabled(false);
          if (raw.includes("flat")) {
            setMarkupDropdownOption("Flat");
          } else if (raw.includes("acc")) {
            setMarkupDropdownOption("% Freight + Fuel + Accessorial");
          } else if (raw.includes("fuel")) {
            setMarkupDropdownOption("% Freight + Fuel");
          } else {
            setMarkupDropdownOption("% Freight");
          }
          if (clientMarkupConfig.minimum != null) {
            setMarkup(String(clientMarkupConfig.minimum));
          } else if (clientMarkupConfig.rate != null) {
            setMarkup(String(clientMarkupConfig.rate));
          }
        }
        const isNetSell = raw.includes("netsell");
        const opt = raw.includes("flat") ? "Flat" : raw.includes("acc") ? "% Freight + Fuel + Accessorial" : raw.includes("fuel") ? "% Freight + Fuel" : "% Freight";
        const valStr = String(clientMarkupConfig.minimum ?? clientMarkupConfig.rate ?? "0");
        const netStr = String(clientMarkupConfig.rate ?? "0");
        syncBaselineMarkup({
          isMarkupEnabled: !isNetSell,
          markupDropdownOption: opt,
          markup: valStr,
          isNetSellRateEnabled: isNetSell,
          netSellRate: netStr,
        });
      }
      return;
    }

    if (carrierData && (carrierData as any).markupType) {
      const raw = String((carrierData as any).markupType).toLowerCase();
      if (raw.includes("netsell")) {
        setIsNetSellRateEnabled(true);
        setIsMarkupEnabled(false);
        if ((carrierData as any).markup != null) {
          setNetSellRate(String((carrierData as any).markup));
        }
      } else {
        setIsMarkupEnabled(true);
        setIsNetSellRateEnabled(false);
        if (raw.includes("flat")) {
          setMarkupDropdownOption("Flat");
        } else if (raw.includes("acc")) {
          setMarkupDropdownOption("% Freight + Fuel + Accessorial");
        } else if (raw.includes("fuel")) {
          setMarkupDropdownOption("% Freight + Fuel");
        } else {
          setMarkupDropdownOption("% Freight");
        }
        if ((carrierData as any).minimum != null) {
          setMarkup(String((carrierData as any).minimum));
        } else if ((carrierData as any).markup != null) {
          setMarkup(String((carrierData as any).markup));
        }
      }
      const isNetSell = raw.includes("netsell");
      const opt = raw.includes("flat") ? "Flat" : raw.includes("acc") ? "% Freight + Fuel + Accessorial" : raw.includes("fuel") ? "% Freight + Fuel" : "% Freight";
      const valStr = String((carrierData as any).minimum ?? (carrierData as any).markup ?? "0");
      const netStr = String((carrierData as any).markup ?? "0");
      syncBaselineMarkup({
        isMarkupEnabled: !isNetSell,
        markupDropdownOption: opt,
        markup: valStr,
        isNetSellRateEnabled: isNetSell,
        netSellRate: netStr,
      });
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
                if (config.rate != null) {
                  setNetSellRate(String(config.rate));
                }
              } else {
                setIsMarkupEnabled(true);
                setIsNetSellRateEnabled(false);
                if (raw.includes("flat")) {
                  setMarkupDropdownOption("Flat");
                } else if (raw.includes("acc")) {
                  setMarkupDropdownOption("% Freight + Fuel + Accessorial");
                } else if (raw.includes("fuel")) {
                  setMarkupDropdownOption("% Freight + Fuel");
                } else {
                  setMarkupDropdownOption("% Freight");
                }
                if (config.minimum != null) {
                  setMarkup(String(config.minimum));
                } else if (config.rate != null) {
                  setMarkup(String(config.rate));
                }
              }
              const isNetSell = raw.includes("netsell");
              const opt = raw.includes("flat") ? "Flat" : raw.includes("acc") ? "% Freight + Fuel + Accessorial" : raw.includes("fuel") ? "% Freight + Fuel" : "% Freight";
              const valStr = String(config.minimum ?? config.rate ?? "0");
              const netStr = String(config.rate ?? "0");
              syncBaselineMarkup({
                isMarkupEnabled: !isNetSell,
                markupDropdownOption: opt,
                markup: valStr,
                isNetSellRateEnabled: isNetSell,
                netSellRate: netStr,
              });
            }
          }
        }
      } catch (error) {
        console.error("[CustomerRate] Error fetching GetClientMarkup:", error);
      }
    };

    fetchClientMarkup();
  }, [clientCode, clientMarkupConfig]);

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
  const [topCount, setTopCount] = useState<string>("10");

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
  const [editedAmounts, setEditedAmounts] = useState<
    Record<
      string,
      { buyAmount?: number; customerAmount?: number; description?: string }
    >
  >({});

  // Active carrier priority:
  // 1. prop `carrierData`
  // 2. or first rate in store `rates[0]`
  // 3. or null (clean blank state)
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

  // Sync carrier inputs only when activeCarrier actually changes from external source
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
      baselineRef.current = null;
      hasUserInteractedRef.current = false;
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

  const getBaseLineInfo = useCallback(() => {
    const buyAmounts: Record<string, number> = {};
    const descriptions: Record<string, string> = {};
    const customerAmounts: Record<string, number> = {};

    if (activeCarrier) {
      const gross =
        Number(activeCarrier.grossCharge) ||
        (Number(activeCarrier.price) > 0 ? Number(activeCarrier.price) : 0);
      const discount = Number(activeCarrier.discount) || 0;
      const fuel = Number(activeCarrier.fuelSurcharge) || 0;
      const accessorials = activeCarrier.accessorialCharges || [];

      buyAmounts["line-gross"] = gross;
      descriptions["line-gross"] = "Freight";
      customerAmounts["line-gross"] = gross;

      if (discount > 0 || activeCarrier.discountCode) {
        buyAmounts["line-discount"] = -Math.abs(discount);
        descriptions["line-discount"] = "Discount";
        customerAmounts["line-discount"] = -Math.abs(discount);
      }

      if (fuel > 0 || activeCarrier.fuelCode) {
        buyAmounts["line-fuel"] = fuel;
        descriptions["line-fuel"] = "Fuel surcharge";
        customerAmounts["line-fuel"] = fuel;
      }

      accessorials.forEach((acc: any, index: number) => {
        const id = `line-acc-${acc.code || index}`;
        const amt = Number(acc.accessorialCharge) || 0;
        buyAmounts[id] = amt;
        descriptions[id] = acc.accessorialDescription || "Accessorial";
        customerAmounts[id] = amt;
      });
    }

    return { buyAmounts, descriptions, customerAmounts };
  }, [activeCarrier]);

  // Capture baseline once activeCarrier is ready
  useEffect(() => {
    if (!activeCarrier) return;
    if (baselineRef.current !== null) return;

    const { buyAmounts, descriptions, customerAmounts } = getBaseLineInfo();
    baselineRef.current = {
      carrierName: activeCarrier.carrierName || "",
      isMarkupEnabled,
      markupDropdownOption,
      markup: String(markup || "0"),
      isNetSellRateEnabled,
      netSellRate: String(netSellRate || "0"),
      topCount: String(topCount || "10"),
      baseBuyAmounts: buyAmounts,
      baseDescriptions: descriptions,
      baseCustomerAmounts: customerAmounts,
    };
  }, [
    activeCarrier,
    getBaseLineInfo,
    isMarkupEnabled,
    markupDropdownOption,
    markup,
    isNetSellRateEnabled,
    netSellRate,
    topCount,
  ]);

  const checkIfRateChanged = useCallback((): boolean => {
    if (!hasUserInteractedRef.current) {
      return false;
    }
    const base = baselineRef.current;
    if (!base) return false;

    // 1. Carrier name check
    const currentCarrier = (carrierName || "").trim().toLowerCase();
    const baseCarrier = (base.carrierName || "").trim().toLowerCase();
    if (currentCarrier !== baseCarrier) {
      return true;
    }

    // 2. Markup checkbox check
    if (isMarkupEnabled !== base.isMarkupEnabled) {
      return true;
    }

    // 3. Markup dropdown & value (if enabled)
    if (isMarkupEnabled) {
      if (markupDropdownOption !== base.markupDropdownOption) {
        return true;
      }
      const curMarkupNum = Number(markup) || 0;
      const baseMarkupNum = Number(base.markup) || 0;
      if (Math.abs(curMarkupNum - baseMarkupNum) > 0.001) {
        return true;
      }
    }

    // 4. Net Sell Rate checkbox & value
    if (isNetSellRateEnabled !== base.isNetSellRateEnabled) {
      return true;
    }
    if (isNetSellRateEnabled) {
      const curNetSellNum = Number(netSellRate) || 0;
      const baseNetSellNum = Number(base.netSellRate) || 0;
      if (Math.abs(curNetSellNum - baseNetSellNum) > 0.001) {
        return true;
      }
    }

    // 5. Applied Markup Config
    if (appliedMarkupConfig.isMarkupEnabled) {
      if (appliedMarkupConfig.markupDropdownOption !== base.markupDropdownOption) {
        return true;
      }
      if (Math.abs(appliedMarkupConfig.numericMarkup - (Number(base.markup) || 0)) > 0.001) {
        return true;
      }
    }

    // 6. Get Top count check
    const curTop = (topCount || "10").trim();
    const baseTop = (base.topCount || "10").trim();
    if (curTop !== baseTop) {
      return true;
    }

    // 7. Custom charges check
    if (customCharges.length > 0) {
      return true;
    }

    // 8. Removed charges check
    if (removedLineIds.length > 0) {
      return true;
    }

    // 9. Saved row edits check
    for (const [id, edited] of Object.entries(editedAmounts)) {
      const baseBuy = base.baseBuyAmounts[id];
      const baseDesc = base.baseDescriptions[id];
      const baseCustomer = base.baseCustomerAmounts[id];

      if (edited.buyAmount !== undefined && baseBuy !== undefined) {
        if (Math.abs(edited.buyAmount - baseBuy) > 0.001) {
          return true;
        }
      }
      if (edited.description && baseDesc) {
        if (edited.description.trim() !== baseDesc.trim()) {
          return true;
        }
      }
      if (edited.customerAmount !== undefined && baseCustomer !== undefined) {
        if (Math.abs(edited.customerAmount - baseCustomer) > 0.001) {
          return true;
        }
      }
    }

    // 10. Active inline editing row check
    if (editingRowId) {
      const baseBuy = base.baseBuyAmounts[editingRowId];
      const baseCustomer = base.baseCustomerAmounts[editingRowId];
      const baseDesc = base.baseDescriptions[editingRowId];

      const curEditBuy = parseFloat(editBuyAmount);
      const curEditCustomer = parseFloat(editCustomerAmount);

      if (!isNaN(curEditBuy) && baseBuy !== undefined) {
        if (Math.abs(curEditBuy - Math.abs(baseBuy)) > 0.001) {
          return true;
        }
      }
      if (!isNaN(curEditCustomer) && baseCustomer !== undefined) {
        if (Math.abs(curEditCustomer - Math.abs(baseCustomer)) > 0.001) {
          return true;
        }
      }
      if (editDescription && baseDesc) {
        if (editDescription.trim() !== baseDesc.trim()) {
          return true;
        }
      }
    }

    return false;
  }, [
    carrierName,
    isMarkupEnabled,
    markupDropdownOption,
    markup,
    isNetSellRateEnabled,
    netSellRate,
    appliedMarkupConfig,
    topCount,
    customCharges,
    removedLineIds,
    editedAmounts,
    editingRowId,
    editBuyAmount,
    editCustomerAmount,
    editDescription,
  ]);

  const triggerRateChange = useCallback(() => {
    hasUserInteractedRef.current = true;
    if (isFromReference && onRateChanged) {
      onRateChanged(checkIfRateChanged());
    }
  }, [isFromReference, onRateChanged, checkIfRateChanged]);

  useEffect(() => {
    if (!isFromReference || !onRateChanged || !hasUserInteractedRef.current) return;
    const isChanged = checkIfRateChanged();
    onRateChanged(isChanged);
  }, [isFromReference, onRateChanged, checkIfRateChanged]);

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
    triggerRateChange();
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
    triggerRateChange();
  };

  const handleCarrierFocus = () => {
    if (carrierOptions.length === 0) {
      fetchCarriersList(carrierName || "");
    }
  };

  const numericMarkup = Math.max(0, Number(markup) || 0);
  const numericNetSellRate = Math.max(0, Number(netSellRate) || 0);

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

    const freightItems = rawItems.filter(
      (i) => !isDiscountCharge(i.code) && isFreightCharge(i.code),
    );
    const fuelItems = rawItems.filter((i) => isFuelCharge(i.code));
    const totalFreight = freightItems.reduce(
      (acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0),
      0,
    );
    const totalFuel = fuelItems.reduce(
      (acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0),
      0,
    );
    const totalFreightFuel = totalFreight + totalFuel;

    return rawItems.map((item) => {
      const isDiscount = isDiscountCharge(item.code);
      const isFreight = !isDiscount && isFreightCharge(item.code);
      const isFuel = isFuelCharge(item.code);

      let markupAmt = 0;

      if (
        appliedMarkupConfig.isMarkupEnabled &&
        appliedMarkupConfig.numericMarkup > 0
      ) {
        const option = appliedMarkupConfig.markupDropdownOption;
        const P = appliedMarkupConfig.numericMarkup;
        const isFlat = option === "Flat";
        const markupValue = isFlat ? P : (totalFreight * P) / 100;

        if (option === "% Freight") {
          if (isFreight) {
            if (totalFreightFuel > 0) {
              markupAmt = (markupValue * item.buyAmount) / totalFreightFuel;
            }
          }
        } else if (option === "% Freight + Fuel") {
          if (isFreight || isFuel) {
            if (totalFreightFuel > 0) {
              markupAmt = (markupValue * item.buyAmount) / totalFreightFuel;
            }
          }
        } else if (option === "% Freight + Fuel + Accessorial") {
          if (isFreight || isFuel) {
            if (totalFreightFuel > 0) {
              markupAmt = (markupValue * item.buyAmount) / totalFreightFuel;
            }
          } else if (!isDiscount) {
            const denom = totalFreight + item.buyAmount;
            if (denom > 0) {
              markupAmt = (markupValue * item.buyAmount) / denom;
            }
          }
        } else if (option === "Flat") {
          if (isFreight || isFuel) {
            if (totalFreightFuel > 0) {
              markupAmt = (markupValue * item.buyAmount) / totalFreightFuel;
            }
          }
        }
      }

      const overrideCust = editedAmounts[item.id]?.customerAmount;
      const custAmt =
        overrideCust !== undefined ? overrideCust : item.buyAmount + markupAmt;
      const finalMarkup =
        overrideCust !== undefined ? custAmt - item.buyAmount : markupAmt;

      let isItemEligible = false;
      if (appliedMarkupConfig.isMarkupEnabled) {
        const option = appliedMarkupConfig.markupDropdownOption;
        if (option === "% Freight") {
          isItemEligible = isFreight;
        } else if (option === "% Freight + Fuel") {
          isItemEligible = isFreight || isFuel;
        } else if (option === "% Freight + Fuel + Accessorial") {
          isItemEligible = !isDiscount;
        } else if (option === "Flat") {
          isItemEligible = isFreight || isFuel;
        }
      } else {
        isItemEligible = isFreight || isFuel;
      }

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        buyAmount: item.buyAmount,
        customerAmount: custAmt,
        markupAmount: finalMarkup,
        markupCalculation: "",
        markupSubtext: "",
        customerCalcSubtext: "",
        isCustom: item.isCustom,
        isEligibleForMarkup: isItemEligible || finalMarkup > 0,
      };
    });
  }, [
    activeCarrier,
    appliedMarkupConfig,
    customCharges,
    removedLineIds,
    editedAmounts,
  ]);

  // Totals
  const freightLines = lineItems.filter(
    (i) => !isDiscountCharge(i.code) && isFreightCharge(i.code),
  );
  const discountLines = lineItems.filter((i) => isDiscountCharge(i.code));
  // const fuelLines = lineItems.filter((i) => isFuelCharge(i.code, i.description));

  const netFreightBuy =
    freightLines.reduce((acc, item) => acc + item.buyAmount, 0) +
    discountLines.reduce((acc, item) => acc + item.buyAmount, 0);
  const netFreightCustomer =
    freightLines.reduce((acc, item) => acc + item.customerAmount, 0) +
    discountLines.reduce((acc, item) => acc + item.customerAmount, 0);
  const netFreightMarkup =
    freightLines.reduce((acc, item) => acc + item.markupAmount, 0) +
    discountLines.reduce((acc, item) => acc + item.markupAmount, 0);

  const totalBuy = lineItems.reduce((acc, item) => acc + item.buyAmount, 0);
  const totalCustomer = lineItems.reduce(
    (acc, item) => acc + item.customerAmount,
    0,
  );
  const totalMarkup = lineItems.reduce(
    (acc, item) => acc + item.markupAmount,
    0,
  );

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
    message.success(`Added charge: ${description}`);
    triggerRateChange();
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
    message.success("Charge removed.");
    triggerRateChange();
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
  };

  const handleBuyAmountChange = (val: string) => {
    hasUserInteractedRef.current = true;
    const cleaned = val.replace(/[^0-9.]/g, "");
    setEditBuyAmount(cleaned);
  };

  const handleCustomerAmountChange = (val: string) => {
    hasUserInteractedRef.current = true;
    const cleaned = val.replace(/[^0-9.]/g, "");
    setEditCustomerAmount(cleaned);
    setHasManuallyEditedCustomer(true);
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

    setEditedAmounts((prev) => {
      const baseBuy = baselineRef.current?.baseBuyAmounts[editingRowId];
      const baseCustomer = baselineRef.current?.baseCustomerAmounts[editingRowId];
      const baseDesc = baselineRef.current?.baseDescriptions[editingRowId] || targetItem.description;

      const isSameAsBase =
        baseBuy !== undefined &&
        Math.abs(newBuy - baseBuy) < 0.001 &&
        (!hasManuallyEditedCustomer || (baseCustomer !== undefined && Math.abs(newCustomer - baseCustomer) < 0.001)) &&
        (!editDescription || editDescription.trim() === baseDesc.trim());

      if (isSameAsBase) {
        const next = { ...prev };
        delete next[editingRowId];
        return next;
      }

      const existing = prev[editingRowId] || {};
      const updatedRow: {
        buyAmount: number;
        customerAmount?: number;
        description: string;
      } = {
        ...existing,
        buyAmount: newBuy,
        description: editDescription.trim() || targetItem.description,
      };

      if (hasManuallyEditedCustomer) {
        updatedRow.customerAmount = newCustomer;
      }

      return {
        ...prev,
        [editingRowId]: updatedRow,
      };
    });

    if (targetItem.isCustom) {
      setCustomCharges((prev) =>
        prev.map((c) =>
          c.id === editingRowId
            ? {
                ...c,
                buyAmount: newBuy,
                description: editDescription.trim() || c.description,
              }
            : c,
        ),
      );
    }

    setEditingRowId(null);
    message.success(`Updated ${targetItem.description}`);
    triggerRateChange();
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    triggerRateChange();
  };

  const handleApplyMarkup = () => {
    // Clear any frozen customerAmount in editedAmounts so the new markup calculates fresh on current buy amounts
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

    setAppliedMarkupConfig({
      isMarkupEnabled,
      markupDropdownOption,
      numericMarkup,
      isNetSellRateEnabled,
      numericNetSellRate,
    });
    if (isMarkupEnabled && numericMarkup > 0) {
      message.success(`Applied ${markupDropdownOption} markup`);
    } else if (isNetSellRateEnabled && numericNetSellRate > 0) {
      message.success("Applied Net Sell Rate");
    } else if (!isMarkupEnabled && !isNetSellRateEnabled) {
      message.info("Markup removed");
    } else {
      message.info("Applied");
    }
    triggerRateChange();
  };

  const handleRateClick = () => {
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
       
        <div className="mb-16 customer-rate-header-row">
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
                  triggerRateChange();
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
                    triggerRateChange();
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
                        triggerRateChange();
                      }}
                      style={{ minWidth: 230 }}
                      size="small"
                      options={[
                        { value: "% Freight", label: "% Freight" },
                        {
                          value: "% Freight + Fuel + Accessorial",
                          label: "% Freight + Fuel + Accessorial",
                        },
                        {
                          value: "% Freight + Fuel",
                          label: "% Freight + Fuel",
                        },
                        { value: "Flat", label: "Flat" },
                      ]}
                    />
                    <div className="markup-input-wrap">
                      {markupDropdownOption === "Flat" && (
                        <span className="markup-unit-symbol">$</span>
                      )}
                      <Input
                        value={markup}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          setMarkup(val);
                          triggerRateChange();
                        }}
                        onPressEnter={handleApplyMarkup}
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
                    triggerRateChange();
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
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        setNetSellRate(val);
                        triggerRateChange();
                      }}
                      onPressEnter={handleApplyMarkup}
                      className="input-sm-center"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Row 2: Get Top */}
        <Row gutter={[12, 12]} className="mb-16 flex-align-center">
          <Col>
            <span className="text-muted-13">Get Top</span>
          </Col>
          <Col>
            <Form.Item noStyle>
              <Input
                value={topCount}
                onChange={(e) => {
                  setTopCount(e.target.value.replace(/[^0-9]/g, ""));
                  triggerRateChange();
                }}
                className="input-sm-center"
              />
            </Form.Item>
          </Col>
          {isFromReference && hasRateChanged && (
            <Col>
              <span
                style={{
                  color: "#d4380d",
                  backgroundColor: "#fff2e8",
                  border: "1px solid #ffbb96",
                  padding: "4px 12px",
                  borderRadius: "4px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ExclamationCircleOutlined style={{ color: "#fa541c", fontSize: "14px" }} />
                You have changed the value. Please re-check rate.
              </span>
            </Col>
          )}
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
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setChargeAmount(val);
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
          {isCorporate && (
            <Col>
              <Button danger type="primary" onClick={handleApplyMarkup}>
                Apply
              </Button>
            </Col>
          )}
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
                        onChange={(e) => setEditDescription(e.target.value)}
                        onPressEnter={handleSaveEdit}
                        onClick={(e) => e.stopPropagation()}
                        className="rate-desc-edit-input"
                      />
                    ) : (
                      <span>{item.description}</span>
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
                          className="rate-inline-edit-input"
                          autoFocus
                        />
                      ) : (
                        formatCurrency(item.buyAmount)
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
                        className="rate-inline-edit-input"
                      />
                    ) : (
                      <div
                        className={
                          item.buyAmount > item.customerAmount
                            ? "rate-cell-loss"
                            : "rate-markup-val"
                        }
                      >
                        {formatCurrency(item.customerAmount)}
                      </div>
                    )}
                  </div>
                  {isCorporate && (
                    <div className="col-markup text-right">
                      {item.isEligibleForMarkup ? (
                        <span
                          className={`rate-markup-val ${item.markupAmount > 0 ? "has-markup" : ""}`}
                        >
                          {formatCurrency(item.markupAmount)}
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
            <div className="rate-total-summary-row mb-12 text-muted-13">
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
            </div>
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
                  <span>{formatCurrency(totalMarkup)}</span>
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
