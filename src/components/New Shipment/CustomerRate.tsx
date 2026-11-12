import { useAppSelector } from "../../app/hooks";
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
import { API_BASE_URL } from "../../config/apiConfig";
import { calculateMarkupDistribution } from "../../utils/markupCalculator";
import "./newshipment.css";

export interface CustomerRateProps {
  carrierData?: {
    carrierName?: string;
    carrierCode?: string;
    service?: string;
    price?: number;
    sellPrice?: number;
    grossCharge?: number;
    grossSell?: number;
    grossSellAmount?: number;
    discount?: number;
    discountSell?: number;
    fuelSurcharge?: number;
    fuelSell?: number;
    markupAmount?: number;
    ppsFreight?: number;
    ppsFuel?: number;
    markupType?: string;
    rate?: string | number;
    minimum?: string | number;
    grossCode?: string;
    discountCode?: string;
    fuelCode?: string;
    accessorialCharges?: {
      accessorialDescription?: string;
      accessorialCharge?: number;
      sellCharge?: number;
      code?: string;
    }[];
    quoteCostDetails?: any[];
    costDetails?: any[];
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
    totalMarkup?: number;
    minimumMarkup?: number;
    markupDropdownOption?: string;
    isMarkupEnabled?: boolean;
    hasUnappliedChanges?: boolean;
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

const formatMarkup = (val: number, _isPercent?: boolean): string => {
  return formatCurrency(val);
};

const CustomerRate: React.FC<CustomerRateProps> = ({
  carrierData,
  clientCode,
  isCorporate: propIsCorporate,
  onRate,
  rateError,
  onClearError,
  onSelectCarrier,
  onRateDetailsChange,
  
  isFromReference: _isFromReference = false,
  hasRateChanged = false,
  onRateChanged,
}) => {
  const reduxApp = useAppSelector((state) => state.app);
  const reduxClientContext = useAppSelector((state) => state.clientContext);
  const dispatch = useDispatch<AppDispatch>();
  const customerRate = useSelector((state: RootState) => state.customerRate);
  const accessorialsList =
    useSelector((state: RootState) => state.accessorials?.data) || [];
  const { error: storeError } = customerRate || {};
  const activeError = rateError !== undefined ? rateError : storeError;

 
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
        : (storeIsCorporate ?? false);

  const customerRateAccessorialsFetchedRef = useRef(false);
  useEffect(() => {
   
    if (!customerRateAccessorialsFetchedRef.current && (!accessorialsList || accessorialsList.length === 0)) {
      customerRateAccessorialsFetchedRef.current = true;
      dispatch(fetchAccessorials());
    }
  }, []); 

  // Markup & Net Sell Rate states
  const [minimumRate, setMinimumRate] = useState<number>(0);
  const [isMarkupEnabled, setIsMarkupEnabled] = useState<boolean>(true);
  const [markupDropdownOption, setMarkupDropdownOption] =
    useState<string>("");
  const [markupRate, setMarkupRate] = useState<string>("0");
  const [isMarkupRateDirty, setIsMarkupRateDirty] = useState<boolean>(false);
  const [markup, setMarkup] = useState<string>("");
  const [, setIsMarkupDirty] = useState<boolean>(false);

  // Net Sell Rate states
  const [isNetSellRateEnabled, setIsNetSellRateEnabled] =
    useState<boolean>(false);
  const [netSellRate, setNetSellRate] = useState<string>("0");
  const [isNetSellDirty, setIsNetSellDirty] = useState<boolean>(false);

  // Charge amount input dirty state
  const [isChargeAmountDirty, setIsChargeAmountDirty] =
    useState<boolean>(false);

  // Track unapplied rate or input changes
  const [hasUnappliedChanges, setHasUnappliedChanges] =
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
  // const fetchedMarkupClientRef = useRef<string | null>(null);
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
    markupDropdownOption: "",
    numericMarkup: 0,
    numericMarkupRate: 0,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
    ppsFreight: 0,
    ppsFuel: 0,
  });

  useEffect(() => {
    const clientCodeToUse =
      clientCode ||
      reduxClientContext?.customerLocation_selectedClientCode ||
      reduxClientContext?.quotes_selectedClientCode ||
      reduxApp?.clientCode ||
      "";

    if (!clientCodeToUse) return;

    const fetchClientMarkup = async () => {
      const token = reduxApp?.token;
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
            const raw = String(config.markupType || "").toLowerCase();
            if (raw.includes("netsell")) {
              setIsNetSellRateEnabled(true);
              setIsMarkupEnabled(false);
              const rateVal = config.rate != null ? String(config.rate) : "0";
              setNetSellRate(rateVal);
              setAppliedMarkupConfig({
                isMarkupEnabled: false,
                markupDropdownOption: "",
                numericMarkup: 0,
                numericMarkupRate: 0,
                isNetSellRateEnabled: true,
                numericNetSellRate: Number(rateVal) || 0,
                ppsFreight: 0,
                ppsFuel: 0,
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
              setMinimumRate(Number(minVal) || 0);

              setAppliedMarkupConfig({
                isMarkupEnabled: true,
                markupDropdownOption: opt,
                numericMarkup: Number(minVal) || 0,
                numericMarkupRate: Number(rateVal) || 0,
                isNetSellRateEnabled: false,
                numericNetSellRate: 0,
                ppsFreight: (carrierData as any)?.ppsFreight || 0,
                ppsFuel: (carrierData as any)?.ppsFuel || 0,
              });
            }
          }
        }
      } catch (error) {
        console.error("[CustomerRate] Error fetching GetClientMarkup:", error);
      }
    };

    fetchClientMarkup();
  }, [clientCode, reduxApp?.token, reduxApp?.clientCode, reduxClientContext?.customerLocation_selectedClientCode, reduxClientContext?.quotes_selectedClientCode]);

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
      setIsNetSellDirty(false);
      setHasUnappliedChanges(false);
      setAppliedMarkupConfig({
        isMarkupEnabled: false,
        markupDropdownOption: "",
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
      const token = reduxApp?.token;
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
      initialCustomerAmount?: number;
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
        const initialCust =
          activeCarrier.grossSell !== undefined && activeCarrier.grossSell !== null
            ? Number(activeCarrier.grossSell)
            : activeCarrier.grossSellAmount !== undefined && activeCarrier.grossSellAmount !== null
              ? Number(activeCarrier.grossSellAmount)
              : (() => {
                  const details = activeCarrier.quoteCostDetails || activeCarrier.costDetails;
                  if (Array.isArray(details)) {
                    const frt = details.find((cd: any) => {
                      const code = (cd.accCode || cd.code || "").trim().toUpperCase();
                      const name = (cd.accName || cd.name || "").trim().toLowerCase();
                      return code === "FRT" || code === "GROSS" || name.includes("gross") || name.includes("freight");
                    });
                    if (frt && frt.sellAmount != null) return Number(frt.sellAmount);
                  }
                  if (activeCarrier.ppsFreight != null && Number(activeCarrier.ppsFreight) > 0) {
                    return gross + Number(activeCarrier.ppsFreight);
                  }
                  if (activeCarrier.markupAmount != null && Number(activeCarrier.markupAmount) > 0) {
                    return gross + Number(activeCarrier.markupAmount);
                  }
                  return undefined;
                })();
        rawItems.push({
          id: "line-gross",
          code: "FRT",
          description: editedAmounts["line-gross"]?.description || "Freight",
          buyAmount: customBuy !== undefined ? customBuy : gross,
          initialCustomerAmount: initialCust,
        });
      }

      // 2. DISCOUNT
      if (
        (discount > 0 || activeCarrier.discountCode) &&
        !removedLineIds.includes("line-discount")
      ) {
        const customBuy = editedAmounts["line-discount"]?.buyAmount;
        const initialCust =
          activeCarrier.discountSell !== undefined && activeCarrier.discountSell !== null
            ? -Math.abs(Number(activeCarrier.discountSell))
            : (() => {
                const details = activeCarrier.quoteCostDetails || activeCarrier.costDetails;
                if (Array.isArray(details)) {
                  const dsc = details.find((cd: any) => {
                    const code = (cd.accCode || cd.code || "").trim().toUpperCase();
                    const name = (cd.accName || cd.name || "").trim().toLowerCase();
                    return code === "DSC" || code === "DISC" || name.includes("discount");
                  });
                  if (dsc && dsc.sellAmount != null) return -Math.abs(Number(dsc.sellAmount));
                }
                return undefined;
              })();
        rawItems.push({
          id: "line-discount",
          code: "DSC",
          description:
            editedAmounts["line-discount"]?.description || "Discount",
          buyAmount: customBuy !== undefined ? customBuy : -Math.abs(discount),
          initialCustomerAmount: initialCust,
        });
      }

      // 3. FUEL Surcharge
      if (!removedLineIds.includes("line-fuel")) {
        const customBuy = editedAmounts["line-fuel"]?.buyAmount;
        const initialCust =
          activeCarrier.fuelSell !== undefined && activeCarrier.fuelSell !== null
            ? Number(activeCarrier.fuelSell)
            : (() => {
                const details = activeCarrier.quoteCostDetails || activeCarrier.costDetails;
                if (Array.isArray(details)) {
                  const fuelCd = details.find((cd: any) => {
                    const code = (cd.accCode || cd.code || "").trim().toUpperCase();
                    const name = (cd.accName || cd.name || "").trim().toLowerCase();
                    return code === "FSC" || code === "FUEL" || name.includes("fuel");
                  });
                  if (fuelCd && fuelCd.sellAmount != null) return Number(fuelCd.sellAmount);
                }
                if (activeCarrier.ppsFuel != null && Number(activeCarrier.ppsFuel) > 0) {
                  return fuel + Number(activeCarrier.ppsFuel);
                }
                return undefined;
              })();
        rawItems.push({
          id: "line-fuel",
          code: "FSC",
          description:
            editedAmounts["line-fuel"]?.description || "Fuel surcharge",
          buyAmount: customBuy !== undefined ? customBuy : fuel,
          initialCustomerAmount: initialCust,
        });
      }

      // 4. Accessorial charges
      accessorials.forEach((acc, idx) => {
        const amt = Number(acc.accessorialCharge) || 0;
        const sellAmt = (acc as any).sellCharge !== undefined ? Number((acc as any).sellCharge) : (amt > 0 ? amt : undefined);
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
            initialCustomerAmount: sellAmt,
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
    const isNetSellActive = appliedMarkupConfig.isNetSellRateEnabled;

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
      const overrideBuy = editedAmounts[item.id]?.buyAmount;

      let currentBuy = overrideBuy !== undefined ? overrideBuy : item.buyAmount;
      let baseCust = item.initialCustomerAmount !== undefined ? item.initialCustomerAmount : currentBuy;
      let calculatedCust = baseCust;
      let calculatedMarkup = baseCust - currentBuy;
      let isEligible = false;

      if (isNetSellActive) {
        if (isFreight) {
          isEligible = true;
          calculatedCust = appliedMarkupConfig.numericNetSellRate;
          calculatedMarkup = calculatedCust - currentBuy;
        } else {
          isEligible = false;
          currentBuy = 0;
          calculatedCust = 0;
          calculatedMarkup = 0;
        }
      } else if (isMarkupActive) {
        if (isFreight) {
          isEligible = true;
          calculatedMarkup = ppsFreight;
          calculatedCust = currentBuy + ppsFreight;
        } else if (isFuel) {
          isEligible = true;
          calculatedMarkup = ppsFuel;
          calculatedCust = currentBuy + ppsFuel;
        }
      }

      const custAmt =
        isNetSellActive && !isFreight
          ? 0
          : overrideCust !== undefined
            ? overrideCust
            : calculatedCust;
      const buyAmt =
        isNetSellActive && !isFreight
          ? 0
          : overrideBuy !== undefined
            ? overrideBuy
            : currentBuy;
      const finalMarkup = isNetSellActive
        ? isFreight
          ? custAmt - buyAmt
          : 0
        : calculatedMarkup;

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        buyAmount: buyAmt,
        customerAmount: custAmt,
        markupAmount: finalMarkup,
        markupCalculation: "",
        markupSubtext: "",
        customerCalcSubtext: "",
        isCustom: item.isCustom,
        isEligibleForMarkup: isNetSellActive
          ? isFreight
          : isEligible || finalMarkup !== 0,
      };
    });
  }, [
    activeCarrier,
    customCharges,
    removedLineIds,
    editedAmounts,
    appliedMarkupConfig,
    editedCellKeys,
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

    const effectiveMinimum =
      minimumRate > 0 ? minimumRate : Number(markup) || 0;

    const activeOption = appliedMarkupConfig.isMarkupEnabled
      ? appliedMarkupConfig.markupDropdownOption
      : (isMarkupEnabled ? markupDropdownOption : "Flat");

    const isAnyRateUnapplied =
      hasUnappliedChanges ||
      isMarkupRateDirty ||
      isNetSellDirty ||
      Boolean(editingRowId && (isBuyInputDirty || isCustomerInputDirty));

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
      totalMarkup,
      minimumMarkup: effectiveMinimum,
      markupDropdownOption: activeOption,
      isMarkupEnabled: appliedMarkupConfig.isMarkupEnabled || isMarkupEnabled,
      hasUnappliedChanges: isAnyRateUnapplied,
    };

    const serialized = JSON.stringify(ratesObj);
    if (prevRatesRef.current !== serialized) {
      prevRatesRef.current = serialized;
      onRateDetailsChange(ratesObj);
    }
  }, [
    lineItems,
    markup,
    minimumRate,
    totalMarkup,
    markupDropdownOption,
    isMarkupEnabled,
    appliedMarkupConfig,
    hasUnappliedChanges,
    isMarkupRateDirty,
    isNetSellDirty,
    editingRowId,
    isBuyInputDirty,
    isCustomerInputDirty,
    onRateDetailsChange,
  ]);

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
    setHasUnappliedChanges(true);
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
    setHasUnappliedChanges(true);
    onRateChanged?.(true);
    message.success("Charge removed.");
  };

  // Edit charge handlers
  const handleStartEdit = (item: RateLineItem) => {
    if (editingRowId === item.id) return;
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
    onRateChanged?.(true);
  };

  const handleCustomerAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setEditCustomerAmount(cleaned);
    setHasManuallyEditedCustomer(true);
    setIsCustomerInputDirty(true);
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
        updatedRow.buyAmount = targetItem.buyAmount;
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
      }
      if (isCustomerChanged) {
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

    if (isBuyChanged || isCustomerChanged) {
      setHasUnappliedChanges(true);
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
    if (isNetSellRateEnabled) {
      setEditedAmounts({});
      setEditedCellKeys([]);
    } else {
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
    }

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

    const { ppsFreight, ppsFuel } = calculateMarkupDistribution({
      netFreightBuy: currentFreightBuy,
      fuelBuy: currentFuelBuy,
      totalBuy: currentTotalBuy,
      markupDropdownOption,
      markupRate: numRate,
      minimum: numMin,
      isMarkupEnabled,
      isNetSellRateEnabled,
      netSellRate: numNetSell,
    });

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

    setIsNetSellDirty(false);
    setIsMarkupRateDirty(false);
    setIsMarkupDirty(false);
    setHasUnappliedChanges(false);

    if (isMarkupEnabled && numMarkup > 0) {
      message.success(`Applied ${markupDropdownOption} markup`);
    } else if (isNetSellRateEnabled) {
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
                    setHasUnappliedChanges(true);
                    onRateChanged?.(true);
                  }}
                  className="markup-checkbox"
                >
                  Mark Up
                </Checkbox>

                {isMarkupEnabled && (
                  <>
                    <Select
                      value={markupDropdownOption || undefined}
                      placeholder="Select markup type"
                      onChange={(val) => {
                        setMarkupDropdownOption(val);
                        setHasUnappliedChanges(true);
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
                          setHasUnappliedChanges(true);
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
                      {/* {markupDropdownOption === "Flat" ? (
                        <span className="markup-unit-symbol">$</span>
                      ) : (
                        <span className="markup-unit-symbol">%</span>
                      )} */}
                      <span className="markup-unit-symbol">$</span>
                      <Input
                        value={markup}
                        className="input-sm-center"
                        disabled={markupDropdownOption === "Flat"}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          setMarkup(val);
                          setHasUnappliedChanges(true);
                          onRateChanged?.(true);
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
                    setHasUnappliedChanges(true);
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
                        setHasUnappliedChanges(true);
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
                  onDoubleClick={() => {
                    if (!isEditing) handleStartEdit(item);
                  }}
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
                        onDoubleClick={(e) => e.stopPropagation()}
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
                    <div
                      className="col-buy text-right"
                      onDoubleClick={(e) => {
                        if (isEditing) e.stopPropagation();
                      }}
                    >
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
                          onDoubleClick={(e) => e.stopPropagation()}
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
                  <div
                    className="col-customer text-right"
                    onDoubleClick={(e) => {
                      if (isEditing) e.stopPropagation();
                    }}
                  >
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
                        onDoubleClick={(e) => e.stopPropagation()}
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
                          className={`rate-markup-val ${item.markupAmount > 0 ? "has-markup" : item.markupAmount < 0 ? "rate-cell-loss" : ""}`}
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
                  <span
                    className={totalMarkup < 0 ? "rate-cell-loss" : undefined}
                  >
                    {formatMarkup(totalMarkup, isPercentMarkup)}
                  </span>
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
