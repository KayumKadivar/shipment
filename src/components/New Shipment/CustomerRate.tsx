import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Spin, message, Alert, Checkbox, AutoComplete } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import type { AppDispatch, RootState } from '../../app/store';
import { fetchCarrierRates, clearRateError, type CarrierSearchResult } from '../../store/customerRateSlice';
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
  isCustom?: boolean;
}

const STANDARD_CHARGE_TYPES = [
  { value: "Liftgate Delivery", label: "Liftgate Delivery", code: "LIFT" },
  { value: "Liftgate Pickup", label: "Liftgate Pickup", code: "LIFT" },
  { value: "Residential Delivery", label: "Residential Delivery", code: "RES" },
  { value: "Residential Pickup", label: "Residential Pickup", code: "RES" },
  { value: "Inside Delivery", label: "Inside Delivery", code: "INSD" },
  { value: "Inside Pickup", label: "Inside Pickup", code: "INSD" },
  { value: "Limited Access Delivery", label: "Limited Access Delivery", code: "LIMT" },
  { value: "Appointment Delivery", label: "Appointment Delivery", code: "APPT" },
  { value: "Notify Before Delivery", label: "Notify Before Delivery", code: "NOTF" },
  { value: "Hazardous Materials", label: "Hazardous Materials", code: "HAZ" },
  { value: "Sorting & Segregating", label: "Sorting & Segregating", code: "SORT" },
  { value: "Overlength", label: "Overlength", code: "OVRL" },
  { value: "Detention Fee", label: "Detention Fee", code: "DET" },
  { value: "Storage Fee", label: "Storage Fee", code: "STOR" },
];

const formatCurrency = (val: number): string => {
  if (val == null || isNaN(val)) return "$0.00";
  const isNeg = val < 0;
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNeg ? `-$${abs}` : `$${abs}`;
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
  const markupMultiplier = 1 + numericMarkup / 100;

  // Line items
  const lineItems = useMemo<RateLineItem[]>(() => {
    const items: RateLineItem[] = [];

    if (activeCarrier) {
      const gross = Number(activeCarrier.grossCharge) || (Number(activeCarrier.price) > 0 ? Number(activeCarrier.price) : 0);
      const discount = Number(activeCarrier.discount) || 0;
      const fuel = Number(activeCarrier.fuelSurcharge) || 0;
      const accessorials = activeCarrier.accessorialCharges || [];

      // Proportional markup calculation between Freight (Gross) and Fuel
      const totalFreightFuel = gross + fuel;
      let freightMarkup = 0;
      let fuelMarkup = 0;

      if (markupType === 'flat') {
        if (totalFreightFuel > 0) {
          const freightProportionPercent = gross / totalFreightFuel;
          const fuelProportionPercent = fuel / totalFreightFuel;
          freightMarkup = numericMarkup * freightProportionPercent;
          fuelMarkup = numericMarkup * fuelProportionPercent;
        } else if (gross > 0) {
          freightMarkup = numericMarkup;
        } else if (fuel > 0) {
          fuelMarkup = numericMarkup;
        }
      } else {
        // Percentage markup
        freightMarkup = gross * (numericMarkup / 100);
        fuelMarkup = fuel * (numericMarkup / 100);
      }

      // 1. GROSS Charge
      if (gross > 0) {
        items.push({
          id: "line-gross",
          code: activeCarrier.carrierCode || "GROSS",
          description: "Gross Charge",
          buyAmount: gross,
          customerAmount: gross + freightMarkup,
        });
      }

      // 2. DISCOUNT
      if (discount > 0) {
        items.push({
          id: "line-discount",
          code: "DISC",
          description: "Discount",
          buyAmount: -discount,
          customerAmount: -discount,
        });
      }

      // 3. FUEL Surcharge
      if (fuel > 0) {
        items.push({
          id: "line-fuel",
          code: "FUEL",
          description: "Fuel Surcharge",
          buyAmount: fuel,
          customerAmount: fuel + fuelMarkup,
        });
      }

      // 4. Accessorial charges
      accessorials.forEach((acc, idx) => {
        const amt = Number(acc.accessorialCharge) || 0;
        if (amt > 0) {
          items.push({
            id: `line-acc-${idx}`,
            code: acc.code || "ACC",
            description: acc.accessorialDescription || "Accessorial",
            buyAmount: amt,
            customerAmount: markupType === 'flat' ? amt : amt * markupMultiplier,
          });
        }
      });

      // Fallback single line if breakdown is empty
      if (items.length === 0 && Number(activeCarrier.price) > 0) {
        const price = Number(activeCarrier.price);
        items.push({
          id: "line-freight",
          code: activeCarrier.carrierCode || "LTL",
          description: `Freight Charge - ${activeCarrier.carrierName || "Carrier"}`,
          buyAmount: price,
          customerAmount: markupType === 'flat' ? price + numericMarkup : price * markupMultiplier,
        });
      }
    }

    // 5. Custom charges added by user
    const hasCarrierGrossOrFreight = items.some((i) => i.id === "line-gross" || i.id === "line-freight");
    customCharges.forEach((c, idx) => {
      const custAmt = markupType === 'flat'
        ? (!hasCarrierGrossOrFreight && idx === 0 ? c.buyAmount + numericMarkup : c.buyAmount)
        : c.buyAmount * markupMultiplier;
      items.push({
        id: c.id,
        code: c.code,
        description: c.description,
        buyAmount: c.buyAmount,
        customerAmount: custAmt,
        isCustom: true,
      });
    });

    return items;
  }, [activeCarrier, markupType, numericMarkup, markupMultiplier, customCharges]);

  // Totals
  const grossItem = lineItems.find((i) => i.id === "line-gross" || i.id === "line-freight");
  const discountItem = lineItems.find((i) => i.id === "line-discount");
  const fuelItem = lineItems.find((i) => i.id === "line-fuel");

  const netFreightCustomer = (grossItem ? grossItem.customerAmount : 0) + (discountItem ? discountItem.customerAmount : 0);
  const totalCustomer = lineItems.reduce((acc, item) => acc + item.customerAmount, 0);
  const netFreightBuy = (grossItem ? grossItem.buyAmount : 0) + (discountItem ? discountItem.buyAmount : 0);
  const totalBuy = lineItems.reduce((acc, item) => acc + item.buyAmount, 0);

  const fuelPercentageBuy = useMemo(() => {
    if (fuelItem && netFreightBuy > 0) {
      return ((fuelItem.buyAmount / netFreightBuy) * 100).toFixed(1);
    }
    if (activeCarrier?.fuelSurcharge && activeCarrier?.grossCharge) {
      return ((activeCarrier.fuelSurcharge / activeCarrier.grossCharge) * 100).toFixed(1);
    }
    return "0";
  }, [fuelItem, netFreightBuy, activeCarrier]);

  const fuelPercentageCustomer = useMemo(() => {
    if (fuelItem && netFreightCustomer > 0) {
      return ((fuelItem.customerAmount / netFreightCustomer) * 100).toFixed(1);
    }
    return fuelPercentageBuy;
  }, [fuelItem, netFreightCustomer, fuelPercentageBuy]);

  // Options for Charge type Select dropdown
  const chargeTypeOptions = useMemo(() => {
    const fromApi = accessorialsList.map((a: any) => ({
      value: a.accessorialName || a.description || a.accesorialCode || String(a.accessorialID),
      label: a.accessorialName || a.description || "Accessorial",
      code: (a.accesorialCode || "ACC").trim().slice(0, 4).toUpperCase(),
    }));

    const combined = [...STANDARD_CHARGE_TYPES];
    fromApi.forEach((apiOpt: any) => {
      if (!combined.some((c) => c.label.toLowerCase() === apiOpt.label.toLowerCase())) {
        combined.push({
          value: apiOpt.value,
          label: apiOpt.label,
          code: apiOpt.code,
        });
      }
    });
    return combined;
  }, [accessorialsList]);

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
    const code = matched?.code || selectedChargeType.slice(0, 4).toUpperCase();
    const description = matched?.label || selectedChargeType;

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
            <div className="col-100 text-right">CUSTOMER AMOUNT</div>
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
                <div className="col-100 text-right rate-item-cell-right">
                  <span>{formatCurrency(item.customerAmount)}</span>
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
        <div className="rate-total-summary-row mb-8 text-muted-13">
          <div className="col-80"></div>
          <div className="col-flex-1">Net Freight</div>
          <div className="col-100 text-right">
            <strong className="text-dark-13">{formatCurrency(netFreightBuy)}</strong>
          </div>
          <div className="col-100 text-right">
            <strong className="text-dark-13">{formatCurrency(netFreightCustomer)}</strong>
          </div>
        </div>
        <div className="rate-total-summary-row mb-12 text-muted-13">
          <div className="col-80"></div>
          <div className="col-flex-1">Fuel (%)</div>
          <div className="col-100 text-right">
            <strong className="text-dark-13">{fuelPercentageBuy}%</strong>
          </div>
          <div className="col-100 text-right">
            <strong className="text-dark-13">{fuelPercentageCustomer}%</strong>
          </div>
        </div>
        <div className="rate-total-summary-row mb-16 rate-total-row">
          <div className="col-80"></div>
          <div className="col-flex-1">Total</div>
          <div className="col-100 text-right">
            <span>{formatCurrency(totalBuy)}</span>
          </div>
          <div className="col-100 text-right">
            <span>{formatCurrency(totalCustomer)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CustomerRate;
