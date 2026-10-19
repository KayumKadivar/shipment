import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Spin, message, Alert, Checkbox, AutoComplete, Flex } from 'antd';
import { DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import type { AppDispatch, RootState } from '../../app/store';
import { fetchCarrierRates, clearRateError, type CarrierSearchResult } from '../../store/customerRateSlice';
import { fetchAccessorials } from '../../store/accessorialsSlice';
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from '../../config/apiConfig';
import './newshipment.css';

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
    accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[];
  };
  clientCode?: string;
  isCorporate?: boolean;
  onRate?: (scac?: string) => void | Promise<void>;
  loadingRate?: boolean;
  rateError?: string | null;
  onClearError?: () => void;
  onSelectCarrier?: (carrier: { carrierId: string; carrierName: string } | null) => void;
  onRateDetailsChange?: (rates: {
    buyRate: { freight: number; fuel: number; discount: number; accesorialCostDetails: any[] };
    sellRate: { freight: number; fuel: number; discount: number; accesorialCostDetails: any[] };
  }) => void;
  clientMarkupConfig?: any;
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

const normalizeMarkupType = (raw?: string): 'flat' | 'percentage' | 'netSellRate' => {
  if (!raw) return 'flat';
  const clean = String(raw).trim().toLowerCase().replace(/[\s_-]/g, '');
  if (clean.includes('percent')) return 'percentage';
  if (clean.includes('netsell') || clean.includes('sellrate') || clean.includes('net') || clean.includes('sell')) return 'netSellRate';
  if (clean.includes('flat')) return 'flat';
  return 'flat';
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
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const customerRate = useSelector((state: RootState) => state.customerRate);
  const accessorialsList = useSelector((state: RootState) => state.accessorials?.data) || [];
  const { loading = false, error: storeError } = customerRate || {};
  const isRating = loadingRate ?? loading;
  const activeError = rateError !== undefined ? rateError : storeError;

  // isCorporate: true shows BUY AMOUNT and MARKUP; false hides them (read from Redux store / prop / localStorage)
  const storeIsCorporate = useSelector((state: RootState) => state.app.isCorporate);
  const isCorporate = propIsCorporate !== undefined
    ? propIsCorporate
    : (storeIsCorporate ?? (typeof localStorage !== "undefined" && localStorage.getItem("isCorporate") === "true"));

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  // Markup state
  const [markupType, setMarkupType] = useState<'flat' | 'percentage' | 'netSellRate'>('flat');
  const [markup, setMarkup] = useState<string>("0");

  useEffect(() => {
    if (clientMarkupConfig) {
      if (clientMarkupConfig.markupType) {
        const selectedType = normalizeMarkupType(clientMarkupConfig.markupType);
        setMarkupType(selectedType);
      }
      if (clientMarkupConfig.rate != null) {
        setMarkup(String(clientMarkupConfig.rate));
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
        console.log(`[CustomerRate] Calling GetClientMarkup API for clientCode: ${clientCodeToUse}`);
        const response = await axios.get(
          `${API_BASE_URL}/ClientMarkupConfig/GetClientMarkup/${encodeURIComponent(clientCodeToUse)}`,
          { headers }
        );
        console.log("[CustomerRate] GetClientMarkup API response:", response.data);

        if (response.data?.isSuccess && response.data?.data) {
          const rawData = response.data.data;
          const config = Array.isArray(rawData) ? rawData[0] : rawData;
          if (config) {
            if (config.markupType) {
              const selectedType = normalizeMarkupType(config.markupType);
              setMarkupType(selectedType);
            }
            if (config.rate != null) {
              setMarkup(String(config.rate));
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
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierSearchResult | null>(null);
  const [carrierOptions, setCarrierOptions] = useState<{
    value: string;
    key: string;
    carrier: CarrierSearchResult;
    label: React.ReactNode;
  }[]>([]);
  const [loadingCarriers, setLoadingCarriers] = useState<boolean>(false);
  const searchCarrierTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [topCount, setTopCount] = useState<string>("10");

  // Custom charge additions
  const [selectedChargeType, setSelectedChargeType] = useState<string | undefined>(undefined);
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [customCharges, setCustomCharges] = useState<{ id: string; code: string; description: string; buyAmount: number }[]>([]);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Edit charge state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editBuyAmount, setEditBuyAmount] = useState<string>("");
  const [editCustomerAmount, setEditCustomerAmount] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [hasManuallyEditedCustomer, setHasManuallyEditedCustomer] = useState<boolean>(false);
  const [editedAmounts, setEditedAmounts] = useState<
    Record<string, { buyAmount?: number; customerAmount?: number; description?: string }>
  >({});

  // Active carrier priority:
  // 1. prop `carrierData`
  // 2. or first rate in store `rates[0]`
  // 3. or null (clean blank state)
  const activeCarrier = useMemo(() => {
    if (carrierData && (carrierData.carrierName || carrierData.price || carrierData.grossCharge)) {
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
        }
      );

      let list: CarrierSearchResult[] = [];
      if (response.data && response.data.isSuccess && Array.isArray(response.data.data)) {
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
            <span className="carrier-select-name">
              {c.carrierName}
            </span>
            {c.carrierId && (
              <span className="carrier-select-badge">
                {c.carrierId}
              </span>
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
    const carrier: CarrierSearchResult = option?.carrier || { carrierId: "", carrierName: val };
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
    const textVal = typeof val === 'string' ? val : ((val as any)?.target?.value ?? '');
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

  const numericMarkup = Math.max(0, Number(markup) || 0);

  const isFreightCharge = (code?: string, description?: string) => {
    const c = (code || '').trim().toUpperCase();
    const d = (description || '').trim().toLowerCase();
    return c === 'FRT' || d === 'freight';
  };

  const isFuelCharge = (code?: string, _description?: string) => {
    return (code || '').trim().toUpperCase() === 'FSC';
  };

  const isDiscountCharge = (code?: string, _description?: string) => {
    const c = (code || '').trim().toUpperCase();
    return c === 'DSC' || c === 'DISC';
  };

  const formatShortNum = (num: number): string => {
    if (num % 1 === 0) return String(Math.round(num));
    return num.toFixed(2);
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
      const gross = Number(activeCarrier.grossCharge) || (Number(activeCarrier.price) > 0 ? Number(activeCarrier.price) : 0);
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
      if ((discount > 0 || activeCarrier.discountCode) && !removedLineIds.includes("line-discount")) {
        const customBuy = editedAmounts["line-discount"]?.buyAmount;
        rawItems.push({
          id: "line-discount",
          code: "DSC",
          description: editedAmounts["line-discount"]?.description || "Discount",
          buyAmount: customBuy !== undefined ? customBuy : -Math.abs(discount),
        });
      }

      // 3. FUEL Surcharge
      if (!removedLineIds.includes("line-fuel")) {
        const customBuy = editedAmounts["line-fuel"]?.buyAmount;
        rawItems.push({
          id: "line-fuel",
          code: "FSC",
          description: editedAmounts["line-fuel"]?.description || "Fuel surcharge",
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
            description: editedAmounts[accId]?.description || acc.accessorialDescription || "",
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

    // Determine totals for Freight and Fuel across all items (carrier + custom)
    const freightItems = rawItems.filter(
      (i) => !isDiscountCharge(i.code) && isFreightCharge(i.code)
    );
    const fuelItems = rawItems.filter(
      (i) => isFuelCharge(i.code)
    );
    const totalFreight = freightItems.reduce((acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0), 0);
    const totalFuel = fuelItems.reduce((acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0), 0);
    const totalFreightFuel = totalFreight + totalFuel;

    return rawItems.map((item) => {
      const isDiscount = isDiscountCharge(item.code);
      const isFreight = !isDiscount && isFreightCharge(item.code);
      const isFuel = isFuelCharge(item.code);

      let markupAmt = 0;
      let markupCalcText = "";
      let markupSubtext = "";
      let customerCalcSubtext = "";

      if (isDiscount) {
        markupAmt = 0;
        markupCalcText = "Discount has no markup";
        markupSubtext = "";
        customerCalcSubtext = "";
      } else if (!isFreight && !isFuel) {
        // Accessorials / other charges NEVER receive markup (neither flat nor percentage)
        markupAmt = 0;
        markupCalcText = "Markup applies to Freight and Fuel only";
        markupSubtext = "";
        customerCalcSubtext = "";
      } else if (markupType === 'percentage') {
        // Percentage markup on Freight and Fuel only
        markupAmt = item.buyAmount * (numericMarkup / 100);
        markupCalcText = `Percentage Markup: ${numericMarkup}%\nCalculation: ${formatCurrency(item.buyAmount)} × ${numericMarkup}% = ${formatCurrency(markupAmt)}\nEffective Amount: ${formatCurrency(item.buyAmount)} + ${formatCurrency(markupAmt)} = ${formatCurrency(item.buyAmount + markupAmt)}`;
        markupSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} × ${numericMarkup}% = ${formatShortNum(markupAmt)}` : "";
        customerCalcSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} + ${formatShortNum(markupAmt)} = ${formatShortNum(item.buyAmount + markupAmt)}` : "";
      } else if (markupType === 'netSellRate') {
        // Net Sell Rate: no automatic markup applied from top input (Customer Amount = Buy Amount unless edited directly in table)
        markupAmt = 0;
        markupCalcText = "Net Sell Rate: No markup applied (Customer Amount equals Buy Amount)";
        markupSubtext = "";
        customerCalcSubtext = "";
      } else {
        // Flat markup: split proportionally between freight & fuel ONLY
        if (isFreight) {
          if (totalFreightFuel > 0) {
            const freightProportionPercent = totalFreight / totalFreightFuel;
            const itemShareOfFreight = totalFreight > 0 ? item.buyAmount / totalFreight : 1;
            const totalFreightMarkup = numericMarkup * freightProportionPercent;
            markupAmt = totalFreightMarkup * itemShareOfFreight;

            const ratioStr = (totalFreight / totalFreightFuel).toFixed(4);
            markupCalcText = `Step 1 (Total): Fuel (${formatCurrency(totalFuel)}) + Freight (${formatCurrency(totalFreight)}) = ${formatCurrency(totalFreightFuel)}\nStep 2 (Proportion): ${formatCurrency(item.buyAmount)} / ${formatCurrency(totalFreightFuel)} = ${ratioStr}\nStep 3 (Markup): ${ratioStr} × $${numericMarkup} = ${formatCurrency(markupAmt)}\nStep 4 (Customer): ${formatCurrency(item.buyAmount)} + ${formatCurrency(markupAmt)} = ${formatCurrency(item.buyAmount + markupAmt)}`;
            markupSubtext = numericMarkup > 0 ? `(${formatShortNum(item.buyAmount)}/${formatShortNum(totalFreightFuel)}) = ${ratioStr} × ${formatShortNum(numericMarkup)} = ${formatShortNum(markupAmt)}` : "";
            customerCalcSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} + ${formatShortNum(markupAmt)} = ${formatShortNum(item.buyAmount + markupAmt)}` : "";
          } else if (totalFreight > 0) {
            markupAmt = numericMarkup * (item.buyAmount / totalFreight);
            markupCalcText = `$${numericMarkup} flat markup applied to Freight`;
            markupSubtext = numericMarkup > 0 ? `$${numericMarkup}` : "";
            customerCalcSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} + ${formatShortNum(markupAmt)} = ${formatShortNum(item.buyAmount + markupAmt)}` : "";
          }
        } else if (isFuel) {
          if (totalFreightFuel > 0) {
            const fuelProportionPercent = totalFuel / totalFreightFuel;
            const itemShareOfFuel = totalFuel > 0 ? item.buyAmount / totalFuel : 1;
            const totalFuelMarkup = numericMarkup * fuelProportionPercent;
            markupAmt = totalFuelMarkup * itemShareOfFuel;

            const ratioStr = (totalFuel / totalFreightFuel).toFixed(4);
            const pct = (fuelProportionPercent * 100).toFixed(1);
            markupCalcText = `Step 1 (Total): Fuel (${formatCurrency(totalFuel)}) + Freight (${formatCurrency(totalFreight)}) = ${formatCurrency(totalFreightFuel)}\nStep 2 (Proportion): ${formatCurrency(item.buyAmount)} / ${formatCurrency(totalFreightFuel)} = ${ratioStr} (${pct}%)\nStep 3 (Markup): ${ratioStr} × $${numericMarkup} = ${formatCurrency(markupAmt)}\nStep 4 (Customer): ${formatCurrency(item.buyAmount)} + ${formatCurrency(markupAmt)} = ${formatCurrency(item.buyAmount + markupAmt)}`;
            markupSubtext = numericMarkup > 0 ? `(${formatShortNum(item.buyAmount)}/${formatShortNum(totalFreightFuel)}) = ${ratioStr} × ${formatShortNum(numericMarkup)} = ${formatShortNum(markupAmt)}` : "";
            customerCalcSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} + ${formatShortNum(markupAmt)} = ${formatShortNum(item.buyAmount + markupAmt)}` : "";
          } else if (totalFuel > 0) {
            markupAmt = numericMarkup * (item.buyAmount / totalFuel);
            markupCalcText = `$${numericMarkup} flat markup applied to Fuel`;
            markupSubtext = numericMarkup > 0 ? `$${numericMarkup}` : "";
            customerCalcSubtext = numericMarkup > 0 ? `${formatShortNum(item.buyAmount)} + ${formatShortNum(markupAmt)} = ${formatShortNum(item.buyAmount + markupAmt)}` : "";
          }
        }
      }

      const overrideCust = editedAmounts[item.id]?.customerAmount;
      const custAmt = overrideCust !== undefined ? overrideCust : item.buyAmount + markupAmt;
      const finalMarkup = overrideCust !== undefined ? custAmt - item.buyAmount : markupAmt;

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        buyAmount: item.buyAmount,
        customerAmount: custAmt,
        markupAmount: finalMarkup,
        markupCalculation: markupCalcText,
        markupSubtext,
        customerCalcSubtext,
        isCustom: item.isCustom,
        isEligibleForMarkup: isFreight || isFuel,
      };
    });
  }, [activeCarrier, markupType, numericMarkup, customCharges, removedLineIds, editedAmounts]);

  // Totals
  const freightLines = lineItems.filter((i) => !isDiscountCharge(i.code) && isFreightCharge(i.code));
  const discountLines = lineItems.filter((i) => isDiscountCharge(i.code));
  // const fuelLines = lineItems.filter((i) => isFuelCharge(i.code, i.description));

  const netFreightBuy = freightLines.reduce((acc, item) => acc + item.buyAmount, 0) + discountLines.reduce((acc, item) => acc + item.buyAmount, 0);
  const netFreightCustomer = freightLines.reduce((acc, item) => acc + item.customerAmount, 0) + discountLines.reduce((acc, item) => acc + item.customerAmount, 0);
  const netFreightMarkup = freightLines.reduce((acc, item) => acc + item.markupAmount, 0) + discountLines.reduce((acc, item) => acc + item.markupAmount, 0);

  const totalBuy = lineItems.reduce((acc, item) => acc + item.buyAmount, 0);
  const totalCustomer = lineItems.reduce((acc, item) => acc + item.customerAmount, 0);
  const totalMarkup = lineItems.reduce((acc, item) => acc + item.markupAmount, 0);

  const prevRatesRef = useRef<string>("");

  useEffect(() => {
    if (!onRateDetailsChange) return;

    const buyFreight = freightLines.reduce((acc, item) => acc + item.buyAmount, 0);
    const buyDiscount = Math.abs(discountLines.reduce((acc, item) => acc + item.buyAmount, 0));
    const fuelLines = lineItems.filter((i) => isFuelCharge(i.code));
    const buyFuel = fuelLines.reduce((acc, item) => acc + item.buyAmount, 0);

    const sellFreight = freightLines.reduce((acc, item) => acc + item.customerAmount, 0);
    const sellDiscount = Math.abs(discountLines.reduce((acc, item) => acc + item.customerAmount, 0));
    const sellFuel = fuelLines.reduce((acc, item) => acc + item.customerAmount, 0);

    const otherLines = lineItems.filter(
      (i) => !isFreightCharge(i.code) && !isDiscountCharge(i.code) && !isFuelCharge(i.code)
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

  // Summary calculation for Flat Markup proportional breakdown
  // const flatSplitSummary = useMemo(() => {
  //   if (markupType !== 'flat' || numericMarkup <= 0) return null;
  //   const freightItems = lineItems.filter((i) => !isDiscountCharge(i.code, i.description) && isFreightCharge(i.code, i.description));
  //   const fuelItems = lineItems.filter((i) => isFuelCharge(i.code, i.description));
  //   const totalFreight = freightItems.reduce((acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0), 0);
  //   const totalFuel = fuelItems.reduce((acc, i) => acc + (i.buyAmount > 0 ? i.buyAmount : 0), 0);
  //   const totalBase = totalFreight + totalFuel;
  //   if (totalBase <= 0) return null;

  //   const fuelMarkup = fuelItems.reduce((acc, i) => acc + i.markupAmount, 0);
  //   const freightMarkup = freightItems.reduce((acc, i) => acc + i.markupAmount, 0);
  //   const fuelRatio = totalBase > 0 ? totalFuel / totalBase : 0;
  //   const freightRatio = totalBase > 0 ? totalFreight / totalBase : 0;
  //   const fuelRatioStr = fuelRatio.toFixed(4);
  //   const freightRatioStr = freightRatio.toFixed(4);
  //   const fuelPct = (fuelRatio * 100).toFixed(1);
  //   const freightPct = (freightRatio * 100).toFixed(1);

  //   return {
  //     totalBase,
  //     totalFreight,
  //     totalFuel,
  //     fuelMarkup,
  //     freightMarkup,
  //     fuelRatioStr,
  //     freightRatioStr,
  //     fuelPct,
  //     freightPct,
  //     fuelCustomer: totalFuel + fuelMarkup,
  //     freightCustomer: totalFreight + freightMarkup,
  //   };
  // }, [lineItems, markupType, numericMarkup]);

  // Options for Charge type Select dropdown from Accessorials API list
  const chargeTypeOptions = useMemo(() => {
    if (!Array.isArray(accessorialsList) || accessorialsList.length === 0) {
      return [];
    }
    return accessorialsList
      .filter((a: any) => Boolean(a.accessorialName || a.description || a.accesorialCode))
      .map((a: any) => {
        const name = (a.accessorialName || a.description || "").trim();
        const code = (a.accesorialCode || "").trim().toUpperCase();
        const isAlreadyAdded = lineItems.some((item) => {
          const matchCode = Boolean(code && item.code && item.code.trim().toUpperCase() === code);
          const matchDesc = Boolean(item.description && item.description.trim().toLowerCase() === name.toLowerCase());
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
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }));
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

    const matched = chargeTypeOptions.find((o) => o.value === selectedChargeType || o.label === selectedChargeType);
    const code = matched?.code || "";
    const description = matched?.label || selectedChargeType;

    // Check if charge is already in the table
    const isDuplicate = lineItems.some((item) => {
      const matchCode = Boolean(code && item.code && item.code.trim().toUpperCase() === code);
      const matchDesc = Boolean(item.description && item.description.trim().toLowerCase() === description.trim().toLowerCase());
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
  };

  // Remove charge handler
  const handleRemoveCharge = (idToRemove?: string) => {
    const targetId = idToRemove || selectedRowId;
    if (!targetId) {
      const removableItems = lineItems.filter((i) => !isFreightCharge(i.code, i.description));
      if (removableItems.length > 0) {
        const last = removableItems[removableItems.length - 1];
        handleRemoveCharge(last.id);
      } else {
        message.info("Select a charge row to remove.");
      }
      return;
    }

    const targetItem = lineItems.find((item) => item.id === targetId);
    if (targetItem && isFreightCharge(targetItem.code, targetItem.description)) {
      message.warning("Freight charge cannot be removed.");
      return;
    }

    const isCustom = customCharges.some((c) => c.id === targetId);
    if (isCustom) {
      setCustomCharges((prev) => prev.filter((c) => c.id !== targetId));
    } else {
      setRemovedLineIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
    }

    if (selectedRowId === targetId) setSelectedRowId(null);
    if (editingRowId === targetId) setEditingRowId(null);
    message.success("Charge removed.");
  };

  // Edit charge handlers
  const handleStartEdit = (item: RateLineItem) => {
    setEditingRowId(item.id);
    const buyVal = item.buyAmount < 0 ? String(Math.abs(item.buyAmount)) : String(item.buyAmount);
    const custVal = item.customerAmount < 0 ? String(Math.abs(item.customerAmount)) : String(item.customerAmount);
    setEditBuyAmount(buyVal);
    setEditCustomerAmount(custVal);
    setEditDescription(item.description);
    setHasManuallyEditedCustomer(false);
  };

  const handleBuyAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setEditBuyAmount(cleaned);
    if (!hasManuallyEditedCustomer) {
      setEditCustomerAmount(cleaned);
    }
  };

  const handleCustomerAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
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

    const isDiscount = isDiscountCharge(targetItem.code, targetItem.description);
    const rawBuy = parseFloat(editBuyAmount) || 0;
    const rawCustomer = parseFloat(editCustomerAmount) || 0;

    const newBuy = isDiscount ? -Math.abs(rawBuy) : Math.max(0, rawBuy);
    const newCustomer = isDiscount ? -Math.abs(rawCustomer) : Math.max(0, rawCustomer);

    setEditedAmounts((prev) => ({
      ...prev,
      [editingRowId]: {
        buyAmount: newBuy,
        customerAmount: newCustomer,
        description: editDescription.trim() || targetItem.description,
      },
    }));

    if (targetItem.isCustom) {
      setCustomCharges((prev) =>
        prev.map((c) =>
          c.id === editingRowId
            ? {
                ...c,
                buyAmount: newBuy,
                description: editDescription.trim() || c.description,
              }
            : c
        )
      );
    }

    setEditingRowId(null);
    message.success(`Updated ${targetItem.description}`);
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
  };

  const handleRateClick = () => {
    if (onRate) {
      onRate(selectedCarrier?.carrierId);
    } else {
      dispatch(fetchCarrierRates({ scac: selectedCarrier?.carrierId }));
    }
  };

  return (
    <Card
      title="Customer Rate"
      className="customer-rate-panel"
    >
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

        {/* Row 1: Carrier + Mark Up (Flat / Percentage / Net Sell Rate) + Rate Button */}
        <Row gutter={[10, 10]} align="middle" className="mb-16 customer-rate-header-row">
          <Col xs={24} md={isCorporate ? 6 : 18} lg={isCorporate ? 6 : 18}>
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
          </Col>
          {isCorporate && (
            <Col xs={24} md={15} lg={15}>
              <div className="text-muted-13 markup-row-wrap">
                <span className="markup-label">
                  Mark Up
                </span>
                <Checkbox
                  checked={markupType === 'flat'}
                  onChange={() => setMarkupType('flat')}
                  className="markup-checkbox"
                >
                  Flat
                </Checkbox>
                <Checkbox
                  checked={markupType === 'percentage'}
                  onChange={() => setMarkupType('percentage')}
                  className="markup-checkbox"
                >
                  Percentage
                </Checkbox>
                <Checkbox
                  checked={markupType === 'netSellRate'}
                  onChange={() => setMarkupType('netSellRate')}
                  className="markup-checkbox"
                >
                  Net Sell Rate
                </Checkbox>
                {markupType !== 'netSellRate' && (
                  <div className="markup-input-wrap">
                    {markupType === 'flat' && <span className="markup-unit-symbol">$</span>}
                    <Input
                      value={markup}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setMarkup(val);
                      }}
                      className="input-sm-center"
                    />
                    {markupType === 'percentage' && <span className="markup-unit-symbol">%</span>}
                  </div>
                )}
              </div>
            </Col>
          )}
          <Col xs={24} md={isCorporate ? 3 : 6} lg={isCorporate ? 3 : 6}>
            <Button
              type="primary"
              className="btn-success w-100"
              onClick={handleRateClick}
              loading={isRating}
            >
              Rate
            </Button>
          </Col>
        </Row>

        {/* Row 2: Get Top */}
        <Row gutter={[12, 12]} className="mb-16 flex-align-center">
          <Col>
            <span className="text-muted-13">Get Top</span>
          </Col>
          <Col>
            <Form.Item noStyle>
              <Input
                value={topCount}
                onChange={(e) => setTopCount(e.target.value.replace(/[^0-9]/g, ''))}
                className="input-sm-center"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 3: Charge type + Amount + Add + Edit + Remove */}
        <Row gutter={[12, 12]} className="mb-16">
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
                  String(option?.label || '').toLowerCase().includes(input.toLowerCase())
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
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setChargeAmount(val);
                }}
                onPressEnter={handleAddCharge}
              />
            </Form.Item>
          </Col>
          <Col xs={8} md={3}>
            <Button type="primary" className="btn-warning w-100" onClick={handleAddCharge}>
              Add
            </Button>
          </Col>
          <Col xs={8} md={3}>
            <Button
              className="w-100"
              onClick={() => {
                const target = lineItems.find((i) => i.id === selectedRowId) || lineItems[0];
                if (target) handleStartEdit(target);
                else message.info("Select a charge row to edit.");
              }}
            >
              Edit
            </Button>
          </Col>
          <Col xs={8} md={3}>
            <Button danger className="w-100" onClick={() => handleRemoveCharge()}>
              Remove
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
            {isCorporate && <div className="col-buy text-right">BUY AMOUNT</div>}
            <div className="col-customer text-right">CUSTOMER AMOUNT</div>
            {isCorporate && <div className="col-markup text-right">MARKUP</div>}
            {isCorporate && <div className="col-actions" />}
          </div>
          {isRating ? (
            <div className="rate-empty-state">
              <Spin />
            </div>
          ) : lineItems.length > 0 ? (
            lineItems.map((item) => {
              const isEditing = editingRowId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rate-item-row ${selectedRowId === item.id ? 'is-selected' : ''} ${isEditing ? 'is-editing' : ''}`}
                  onClick={() => setSelectedRowId(selectedRowId === item.id ? null : item.id)}
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
                          onChange={(e) => handleBuyAmountChange(e.target.value)}
                          onPressEnter={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') handleCancelEdit();
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
                        onChange={(e) => handleCustomerAmountChange(e.target.value)}
                        onPressEnter={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rate-inline-edit-input"
                      />
                    ) : (
                      <div className={item.buyAmount > item.customerAmount ? "rate-cell-loss" : "rate-markup-val"}>
                        {formatCurrency(item.customerAmount)}
                      </div>
                    )}
                  </div>
                  {isCorporate && (
                    <div className="col-markup text-right">
                      {item.isEligibleForMarkup ? (
                        <span className={`rate-markup-val ${item.markupAmount > 0 ? 'has-markup' : ''}`}>
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
                            <button
                              type="button"
                              className="rate-action-btn rate-edit-btn"
                              title="Edit charge"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(item);
                              }}
                            >
                              <EditOutlined />
                            </button>

                            {!isFreightCharge(item.code, item.description) ? (
                              <button
                                type="button"
                                className="rate-action-btn rate-remove-btn"
                                title="Remove charge"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCharge(item.id);
                                }}
                              >
                                <DeleteOutlined />
                              </button>
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
            <div className="rate-total-summary-row mb-12 text-muted-13">
              <div className="col-code"></div>
              <div className="col-desc">Net Freight</div>
              {isCorporate && (
                <div className="col-buy text-right">
                  <strong className="text-dark-13">{formatCurrency(netFreightBuy)}</strong>
                </div>
              )}
              <div className="col-customer text-right">
                <strong
                  className={`text-dark-13 ${netFreightBuy > netFreightCustomer ? 'rate-cell-loss' : ''}`}
                >
                  {formatCurrency(netFreightCustomer)}
                </strong>
              </div>
              {isCorporate && (
                <div className="col-markup text-right">
                  <strong className="text-dark-13">{formatCurrency(netFreightMarkup)}</strong>
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
                <span className={totalBuy > totalCustomer ? 'rate-cell-loss' : ''}>
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

      {/* {flatSplitSummary && (
        <div className="rate-calculation-explainer">
          <div className="explainer-header">
            <InfoCircleOutlined style={{ marginRight: 6, color: '#1677ff' }} />
            <span>Markup Proportion Breakdown (${numericMarkup} Flat Markup):</span>
          </div>
          <div className="explainer-body">
            <div>
              &bull; <strong>Total Base:</strong><b> Fuel (${formatShortNum(flatSplitSummary.totalFuel)}) + Freight (${formatShortNum(flatSplitSummary.totalFreight)}) = </b>  <strong>${formatShortNum(flatSplitSummary.totalBase)}</strong>
            </div>
            <div>
              &bull; <strong>Fuel Markup:</strong> <b>(${formatShortNum(flatSplitSummary.totalFuel)} / ${formatShortNum(flatSplitSummary.totalBase)}) = {flatSplitSummary.fuelRatioStr} &times; ${numericMarkup} =</b> <strong>${formatShortNum(flatSplitSummary.fuelMarkup)}</strong> &nbsp;&rarr;&nbsp; <b>Customer Amount = ${formatShortNum(flatSplitSummary.totalFuel)} + ${formatShortNum(flatSplitSummary.fuelMarkup)}</b> = <strong>${formatShortNum(flatSplitSummary.fuelCustomer)}</strong>
            </div>
            <div>
              &bull; <strong>Freight Markup:</strong> <b>(${formatShortNum(flatSplitSummary.totalFreight)} / ${formatShortNum(flatSplitSummary.totalBase)}) = {flatSplitSummary.freightRatioStr} &times; ${numericMarkup} = </b> <strong>${formatShortNum(flatSplitSummary.freightMarkup)}</strong> &nbsp;&rarr;&nbsp; <b>Customer Amount = ${formatShortNum(flatSplitSummary.totalFreight)} + ${formatShortNum(flatSplitSummary.freightMarkup)}</b> = <strong>${formatShortNum(flatSplitSummary.freightCustomer)}</strong>
            </div>
          </div>
        </div>
      )} */}
    </Card>
  );
};

export default CustomerRate;
