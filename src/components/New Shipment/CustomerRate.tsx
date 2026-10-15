import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Spin, message, Alert, Checkbox, AutoComplete, Tooltip } from 'antd';
import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import type { AppDispatch, RootState } from '../../app/store';
import { fetchCarrierRates, clearRateError, type CarrierSearchResult } from '../../store/customerRateSlice';
import { fetchAccessorials } from '../../store/accessorialsSlice';
import { API_BASE_URL } from '../../config/apiConfig';
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
  onRate?: (scac?: string) => void | Promise<void>;
  loadingRate?: boolean;
  rateError?: string | null;
  onClearError?: () => void;
  onSelectCarrier?: (carrier: { carrierId: string; carrierName: string } | null) => void;
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
  onRate,
  loadingRate,
  rateError,
  onClearError,
  onSelectCarrier,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const customerRate = useSelector((state: RootState) => state.customerRate);
  const accessorialsList = useSelector((state: RootState) => state.accessorials?.data) || [];
  const { loading = false, error: storeError } = customerRate || {};
  const isRating = loadingRate ?? loading;
  const activeError = rateError !== undefined ? rateError : storeError;

  useEffect(() => {
    if (!accessorialsList || accessorialsList.length === 0) {
      dispatch(fetchAccessorials());
    }
  }, [accessorialsList, dispatch]);

  // Markup state
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat');
  const [markup, setMarkup] = useState<string>("0");

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
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

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
    if (onSelectCarrier) {
      onSelectCarrier(carrier);
    }
  };

  const handleChangeCarrier = (val: string) => {
    const textVal = typeof val === 'string' ? val : ((val as any)?.target?.value ?? '');
    setCarrierName(textVal);
    if (!textVal) {
      setSelectedCarrier(null);
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

  const isFreightCharge = (code?: string, _description?: string) => {
    return (code || '').trim().toUpperCase() === 'FRT';
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
      rawItems.push({
        id: "line-gross",
        code: "FRT",
        description: "Freight",
        buyAmount: gross,
      });

      // 2. DISCOUNT
      if (discount > 0 || activeCarrier.discountCode) {
        rawItems.push({
          id: "line-discount",
          code: "DSC",
          description: "Discount",
          buyAmount: -Math.abs(discount),
        });
      }

      // 3. FUEL Surcharge
      rawItems.push({
        id: "line-fuel",
        code: "FSC",
        description: "Fuel surcharge",
        buyAmount: fuel,
      });

      // 4. Accessorial charges
      accessorials.forEach((acc, idx) => {
        const amt = Number(acc.accessorialCharge) || 0;
        if (amt > 0) {
          rawItems.push({
            id: `line-acc-${idx}`,
            code: acc.code || (acc as any).accesorialCode || "",
            description: acc.accessorialDescription || "",
            buyAmount: amt,
          });
        }
      });
    }

    // 5. Custom charges added by user
    customCharges.forEach((c) => {
      rawItems.push({
        id: c.id,
        code: c.code,
        description: c.description,
        buyAmount: c.buyAmount,
        isCustom: true,
      });
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
      } else {
        // Flat markup: split proportionally between freight & fuel ONLY
        if (isFreight) {
          if (totalFreightFuel > 0) {
            const freightProportionPercent = totalFreight / totalFreightFuel;
            const itemShareOfFreight = totalFreight > 0 ? item.buyAmount / totalFreight : 1;
            const totalFreightMarkup = numericMarkup * freightProportionPercent;
            markupAmt = totalFreightMarkup * itemShareOfFreight;

            const ratioStr = (totalFreight / totalFreightFuel).toFixed(4);
            const pct = (freightProportionPercent * 100).toFixed(1);
            markupCalcText = `Step 1 (Total): Fuel (${formatCurrency(totalFuel)}) + Freight (${formatCurrency(totalFreight)}) = ${formatCurrency(totalFreightFuel)}\nStep 2 (Proportion): ${formatCurrency(item.buyAmount)} / ${formatCurrency(totalFreightFuel)} = ${ratioStr} (${pct}%)\nStep 3 (Markup): ${ratioStr} × $${numericMarkup} = ${formatCurrency(markupAmt)}\nStep 4 (Customer): ${formatCurrency(item.buyAmount)} + ${formatCurrency(markupAmt)} = ${formatCurrency(item.buyAmount + markupAmt)}`;
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

      const custAmt = item.buyAmount + markupAmt;

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        buyAmount: item.buyAmount,
        customerAmount: custAmt,
        markupAmount: markupAmt,
        markupCalculation: markupCalcText,
        markupSubtext,
        customerCalcSubtext,
        isCustom: item.isCustom,
        isEligibleForMarkup: isFreight || isFuel,
      };
    });
  }, [activeCarrier, markupType, numericMarkup, customCharges]);

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
      if (customCharges.length > 0) {
        const last = customCharges[customCharges.length - 1];
        setCustomCharges((prev) => prev.filter((c) => c.id !== last.id));
        message.info(`Removed ${last.description}`);
      } else {
        message.info("Select a custom charge row to remove.");
      }
      return;
    }

    const isCustom = customCharges.some((c) => c.id === targetId);
    if (isCustom) {
      setCustomCharges((prev) => prev.filter((c) => c.id !== targetId));
      if (selectedRowId === targetId) setSelectedRowId(null);
      message.success("Charge removed.");
    } else {
      message.info("Standard carrier rates cannot be removed.");
    }
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

        {/* Row 1: Carrier + Mark Up (Flat / Percentage) + Rate Button */}
        <Row gutter={[12, 12]} className="mb-16">
          <Col xs={24} md={6}>
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
          <Col xs={24} md={14}>
            <div className="text-muted-13 markup-row-wrap">
              <span className="markup-label">
                Mark Up
              </span>
              <Checkbox
                checked={markupType === 'flat'}
                onChange={(e) => setMarkupType(e.target.checked ? 'flat' : 'percentage')}
                className="markup-checkbox"
              >
                Flat
              </Checkbox>
              <Checkbox
                checked={markupType === 'percentage'}
                onChange={(e) => setMarkupType(e.target.checked ? 'percentage' : 'flat')}
                className="markup-checkbox"
              >
                Percentage
              </Checkbox>
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
            </div>
          </Col>
          <Col xs={24} md={4}>
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

        {/* Row 3: Charge type + Amount + Add + Remove */}
        <Row gutter={[12, 12]} className="mb-16">
          <Col xs={24} md={12}>
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
          <Col xs={24} md={6}>
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
          <Col xs={12} md={3}>
            <Button type="primary" className="btn-warning w-100" onClick={handleAddCharge}>
              Add
            </Button>
          </Col>
          <Col xs={12} md={3}>
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
            <div className="col-80">CODE</div>
            <div className="col-flex-1">DESCRIPTION</div>
            <div className="col-100 text-right">BUY AMOUNT</div>
            <div className="col-120 text-right">CUSTOMER AMOUNT</div>
            <div className="col-120 text-right">
              <Tooltip title={markupType === 'flat' ? "Flat markup is split proportionally between Freight & Fuel Surcharge" : `${numericMarkup}% markup applied`}>
                <span style={{ cursor: 'pointer' }}>
                  MARKUP <InfoCircleOutlined style={{ fontSize: 11, marginLeft: 2 }} />
                </span>
              </Tooltip>
            </div>
          </div>
          {isRating ? (
            <div className="rate-empty-state">
              <Spin />
            </div>
          ) : lineItems.length > 0 ? (
            lineItems.map((item) => (
              <div
                key={item.id}
                className={`rate-item-row ${selectedRowId === item.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedRowId(selectedRowId === item.id ? null : item.id)}
              >
                <div className="col-80">{item.code}</div>
                <div className="col-flex-1">
                  <span>{item.description}</span>
                </div>
                <div className="col-100 text-right">{formatCurrency(item.buyAmount)}</div>
                <div className="col-120 text-right">
                  <div
                    style={{
                      fontWeight: 600,
                      color: item.buyAmount > item.customerAmount ? '#ff4d4f' : 'inherit',
                    }}
                  >
                    {formatCurrency(item.customerAmount)}
                  </div>
                </div>
                <div className="col-120 text-right rate-item-cell-right">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    {item.isEligibleForMarkup ? (
                      <Tooltip
                        title={
                          <div style={{ whiteSpace: 'pre-line', fontSize: 11, padding: '2px 4px' }}>
                            {item.markupCalculation || `${formatCurrency(item.markupAmount)} markup`}
                          </div>
                        }
                        overlayStyle={{ maxWidth: 380 }}
                      >
                        <span
                          style={{
                            cursor: 'help',
                            fontWeight: 600,
                            borderBottom: item.markupCalculation && item.markupAmount > 0 ? '1px dotted #1677ff' : 'none',
                            color: item.markupAmount > 0 ? '#1677ff' : 'inherit',
                          }}
                        >
                          {formatCurrency(item.markupAmount)}
                        </span>
                      </Tooltip>
                    ) : (
                      <span style={{ color: '#8c8c8c', fontWeight: 500 }}>-</span>
                    )}

                    {item.isCustom && (
                      <button
                        type="button"
                        className="rate-remove-btn"
                        title="Remove charge"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCharge(item.id);
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rate-empty-state">
              No rates added yet. Click Rate to fetch carrier pricing.
            </div>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="mt-16">
        <div className="rate-total-summary-row mb-12 text-muted-13">
          <div className="col-80"></div>
          <div className="col-flex-1">Net Freight</div>
          <div className="col-100 text-right">
            <strong className="text-dark-13">{formatCurrency(netFreightBuy)}</strong>
          </div>
          <div className="col-120 text-right">
            <strong
              className="text-dark-13"
              style={{ color: netFreightBuy > netFreightCustomer ? '#ff4d4f' : undefined }}
            >
              {formatCurrency(netFreightCustomer)}
            </strong>
          </div>
          <div className="col-120 text-right">
            <strong className="text-dark-13">{formatCurrency(netFreightMarkup)}</strong>
          </div>
        </div>
        <div className="rate-total-summary-row mb-16 rate-total-row">
          <div className="col-80"></div>
          <div className="col-flex-1">Total</div>
          <div className="col-100 text-right">
            <span>{formatCurrency(totalBuy)}</span>
          </div>
          <div className="col-120 text-right">
            <span style={{ color: totalBuy > totalCustomer ? '#ff4d4f' : 'inherit' }}>
              {formatCurrency(totalCustomer)}
            </span>
          </div>
          <div className="col-120 text-right">
            <span>{formatCurrency(totalMarkup)}</span>
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
