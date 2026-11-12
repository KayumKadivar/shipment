import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  Dropdown,
  Input,
  InputNumber,
  message,
  Popconfirm,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  fetchChargeAccessorials,
  type ChargeAccessorial,
} from "../../store/chargeAccessorialsSlice";
import type { ShipmentRerateRate } from "../../store/shipmentRerateSlice";
import type { ShipmentDetails } from "../../types/shipment.types";
import axios from "axios";
import { API_BASE_URL } from "../../config/apiConfig";
import ChargePricingControls from "./ChargePricingControls";
import {
  applyChargePricing,
  chargePricingFromConfig,
  defaultChargePricing,
  type ChargePricingDraft,
} from "./chargePricing";
import { aggregateAccessorialCharges } from "./shipmentAccessorials";
import { editedChargeRates } from "./editedChargeRates";

type ChargeLine = {
  id: string;
  code: string;
  description: string;
  buyCost: number | null;
  sellCost: number | null;
};

type CarrierLiability = {
  newFreight: number | null;
  usedFreight: number | null;
  machinery: number | null;
};

type FreightInsurance = {
  supplemental: number | null;
};

type ChargesState = {
  liability: CarrierLiability;
  insurance: FreightInsurance;
  lines: ChargeLine[];
};

type LineEditor = {
  line: ChargeLine;
  isNew: boolean;
};

type ChargeAccessorialOption = {
  value: string;
  label: string;
  description: string;
  accesorialCode: string;
};

type ChargesProps = {
  shipment: ShipmentDetails;
  onChangeCommitted: () => void;
  onEditorStateChange: (isEditing: boolean) => void;
  reratedRate?: ShipmentRerateRate | null;
  onValuesChange?: (values: Pick<ShipmentDetails, "buyRate" | "sellRate">) => void;
  readOnlyUnsupported?: boolean;
};

const deductibleTiers = [
  "Less than $10,000",
  "$10,000-$25,000",
  "$25,000-$100,000",
  "Over $100,000",
];

const DuplicateChargeDescriptionMessage = "Duplicate value not allowed";
const DuplicateChargeDescriptionMessageKey =
  "duplicate-charge-description";
const MissingBuyRateMessage = "Buy rate is required";
const MissingSellRateMessage = "Sell rate is required";
const MissingBuyAndSellRatesMessage = "Buy and sell rates are required";
const MissingChargeRatesMessageKey = "missing-charge-rates";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | null) {
  if (value == null) return "";
  const formatted = usdFormatter.format(Math.abs(value));
  return value < 0 ? `(${formatted})` : formatted;
}

function normalizeDiscount(value: number | null) {
  return value == null ? null : -Math.abs(value);
}

function isDiscountCharge(line: ChargeLine) {
  return (
    line.id === "discount" ||
    line.code.trim().toUpperCase() === "DSC" ||
    line.description.trim().toLowerCase() === "discount"
  );
}

function normalizeDiscountChargeLine(line: ChargeLine) {
  return isDiscountCharge(line)
    ? {
        ...line,
        buyCost: normalizeDiscount(line.buyCost),
        sellCost: normalizeDiscount(line.sellCost),
      }
    : line;
}

function normalizeNonDiscount(value: number | null) {
  return value == null ? null : Math.abs(value);
}

function parseNonDiscountCharge(value: string | undefined) {
  const normalizedValue = value?.replaceAll(",", "").trim() ?? "";
  return normalizedValue.startsWith("-") ? Number.NaN : normalizedValue;
}

function normalizeChargeLineCosts(line: ChargeLine) {
  if (isDiscountCharge(line)) {
    return normalizeDiscountChargeLine(line);
  }

  return {
    ...line,
    buyCost: normalizeNonDiscount(line.buyCost),
    sellCost: normalizeNonDiscount(line.sellCost),
  };
}

function getMissingChargeRatesMessage(line: ChargeLine) {
  if (line.buyCost === null && line.sellCost === null) {
    return MissingBuyAndSellRatesMessage;
  }

  if (line.buyCost === null) return MissingBuyRateMessage;
  if (line.sellCost === null) return MissingSellRateMessage;

  return null;
}

function normalizeChargeDescription(description: string) {
  return description.trim().toLocaleLowerCase();
}

function isFreightCharge(line: ChargeLine) {
  return normalizeChargeDescription(line.description) === "freight";
}

function isPriorityFuelCharge(line: ChargeLine) {
  const code = line.code.trim().toUpperCase();
  const description = normalizeChargeDescription(line.description);

  return (
    code === "FUEL" || description === "fuel" || description === ".fuel."
  );
}

function getChargeLinePriority(line: ChargeLine) {
  const code = line.code.trim().toUpperCase();
  const description = normalizeChargeDescription(line.description);

  if (
    line.id === "freight" ||
    code === "FRT" ||
    description === "freight"
  ) {
    return 0;
  }

  if (isDiscountCharge(line)) {
    return 1;
  }

  if (isPriorityFuelCharge(line)) {
    return 2;
  }

  return 3;
}

function orderChargeLines(lines: ChargeLine[]) {
  return [...lines].sort(
    (first, second) =>
      getChargeLinePriority(first) - getChargeLinePriority(second),
  );
}

function hasDuplicateChargeDescription(
  lines: ChargeLine[],
  candidateLine: ChargeLine,
) {
  const candidateDescription = normalizeChargeDescription(
    candidateLine.description,
  );

  return (
    candidateDescription.length > 0 &&
    lines.some(
      (line) =>
        line.id !== candidateLine.id &&
        normalizeChargeDescription(line.description) === candidateDescription,
    )
  );
}

function createInitialCharges(shipment: ShipmentDetails): ChargesState {
  const rateLines = [
    {
      id: "freight",
      code: "FRT",
      description: "Freight",
      buyCost: shipment.buyRate?.freight ?? null,
      sellCost: shipment.sellRate?.freight ?? null,
    },
    {
      id: "fuel",
      code: "FSC",
      description: "Fuel surcharge",
      buyCost: shipment.buyRate?.fuel ?? null,
      sellCost: shipment.sellRate?.fuel ?? null,
    },
    {
      id: "discount",
      code: "DSC",
      description: "Discount",
      buyCost: normalizeDiscount(shipment.buyRate?.discount ?? null),
      sellCost: normalizeDiscount(shipment.sellRate?.discount ?? null),
    },
  ];
  const accessorialLines = aggregateAccessorialCharges(shipment).map(
    (accessorial, index): ChargeLine =>
      normalizeDiscountChargeLine({
        id: `accessorial-${index}-${accessorial.key}`,
        code: accessorial.code || "ACC",
        description: accessorial.description || "Accessorial",
        buyCost: accessorial.buyCost,
        sellCost: accessorial.sellCost,
      }),
  );

  return {
    liability: { newFreight: null, usedFreight: null, machinery: null },
    insurance: { supplemental: null },
    lines: orderChargeLines([
      ...(shipment.buyRate || shipment.sellRate ? rateLines : []),
      ...accessorialLines,
    ]),
  };
}

function normalizedChargeCode(value: string) {
  return value.trim().toUpperCase();
}

function mergeReratedChargeLines(
  currentLines: ChargeLine[],
  rate: ShipmentRerateRate,
) {
  const lines = [...currentLines];
  const updateCoreLine = (
    id: string,
    code: string,
    description: string,
    buyCost: number,
    sellCost: number,
  ) => {
    const index = lines.findIndex(
      (line) =>
        line.id === id || normalizedChargeCode(line.code) === code,
    );

    if (index >= 0) {
      lines[index] = { ...lines[index], buyCost, sellCost };
      return;
    }

    lines.push({ id, code, description, buyCost, sellCost });
  };

  updateCoreLine(
    "freight", "FRT", "Freight",
    rate.grossCharge,
    rate.sellGrossCharge ?? rate.grossCharge,
  );
  updateCoreLine(
    "discount",
    "DSC",
    "Discount",
    normalizeDiscount(rate.discount) ?? 0,
    normalizeDiscount(rate.sellDiscount ?? rate.discount) ?? 0,
  );
  updateCoreLine(
    "fuel", "FSC", "Fuel surcharge",
    rate.fuelSurcharge,
    rate.sellFuelSurcharge ?? rate.fuelSurcharge,
  );

  const matchedLineIds = new Set<string>();
  rate.accessorialCharges.forEach((charge, index) => {
    const code = charge.accessorialCode.trim() || "ACC";
    const description =
      charge.accessorialDescription.trim() || "Accessorial";
    const normalizedCode = normalizedChargeCode(code);
    const normalizedDescription = normalizeChargeDescription(description);
    const isAvailableAccessorial = (line: ChargeLine) =>
      !matchedLineIds.has(line.id) &&
      !["freight", "discount", "fuel"].includes(line.id);
    let existingIndex = lines.findIndex(
      (line) =>
        isAvailableAccessorial(line) &&
        normalizedChargeCode(line.code) === normalizedCode,
    );

    if (existingIndex < 0) {
      existingIndex = lines.findIndex(
        (line) =>
          isAvailableAccessorial(line) &&
          normalizeChargeDescription(line.description) ===
            normalizedDescription,
      );
    }

    if (existingIndex >= 0) {
      const existingLine = lines[existingIndex];
      lines[existingIndex] = {
        ...existingLine,
        buyCost: charge.accessorialCharge,
        sellCost: charge.accessorialCharge,
      };
      matchedLineIds.add(existingLine.id);
      return;
    }

    const id = `rerate-accessorial-${index}-${normalizedCode}-${normalizedDescription}`;
    lines.push({
      id,
      code,
      description,
      buyCost: charge.accessorialCharge,
      sellCost: charge.accessorialCharge,
    });
    matchedLineIds.add(id);
  });

  return orderChargeLines(lines.map(normalizeDiscountChargeLine));
}

function createEmptyCharge(): ChargeLine {
  return {
    id: `charge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    code: "",
    description: "",
    buyCost: null,
    sellCost: null,
  };
}

function chargeLineValuesAreEqual(first: ChargeLine, second: ChargeLine) {
  return (Object.keys(first) as Array<keyof ChargeLine>).every(
    (field) => first[field] === second[field],
  );
}

function carrierLiabilityValuesAreEqual(
  first: CarrierLiability,
  second: CarrierLiability,
) {
  return (Object.keys(first) as Array<keyof CarrierLiability>).every(
    (field) => first[field] === second[field],
  );
}

function MoneyRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className='shipment-charge-money-row'>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

function MoneyInputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className='shipment-charge-money-input'>
      <span>{label}</span>
      <InputNumber
        value={value}
        prefix='$'
        precision={2}
        aria-label={label}
        onChange={(nextValue) => onChange(nextValue)}
      />
    </label>
  );
}

function Charges({
  shipment,
  onChangeCommitted,
  onEditorStateChange,
  reratedRate,
  onValuesChange,
  readOnlyUnsupported = true,
}: ChargesProps) {
  const reduxApp = useAppSelector((state) => state.app);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();
  const chargeAccessorials = useAppSelector(
    (state) => state.chargeAccessorials.data,
  );
  const storeIsCorporate = useAppSelector((state) => state.app.isCorporate);
  const isCorporate = storeIsCorporate === true;

  const [charges, setCharges] = useState<ChargesState>(() =>
    createInitialCharges(shipment),
  );
  const publishedLines = useRef(charges.lines);
  const publishedRates = useRef({ buyRate: shipment.buyRate, sellRate: shipment.sellRate });
  useEffect(() => {
    if (publishedLines.current === charges.lines) return;
    publishedLines.current = charges.lines;
    const values = editedChargeRates(charges.lines, publishedRates.current);
    publishedRates.current = values;
    onValuesChange?.(values);
  }, [charges.lines, onValuesChange]);
  const [pricingDraft, setPricingDraft] =
    useState<ChargePricingDraft>(defaultChargePricing);
  const [isPricingDirty, setIsPricingDirty] = useState(false);
  const pricingTouched = useRef(false);
  const [previousIsCorporate, setPreviousIsCorporate] = useState(isCorporate);

  if (previousIsCorporate !== isCorporate) {
    setPreviousIsCorporate(isCorporate);
    if (!isCorporate) {
      setPricingDraft(defaultChargePricing);
      setIsPricingDirty(false);
    }
  }

  useEffect(() => {
    if (!isCorporate) {
      pricingTouched.current = false;
    }
  }, [isCorporate]);
  const [sourceLines, setSourceLines] = useState(
    () => createInitialCharges(shipment).lines,
  );

  useEffect(() => {
    if (!isCorporate || !shipment.clientCode) return;
    const controller = new AbortController();
    const token = reduxApp?.token;
    axios.get(
      `${API_BASE_URL}/ClientMarkupConfig/GetClientMarkup/${encodeURIComponent(shipment.clientCode)}`,
      {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    ).then((response) => {
        if (controller.signal.aborted || pricingTouched.current || !response.data?.isSuccess) return;
        const data = response.data.data;
        const config = Array.isArray(data) ? data[0] : data;
        const draft = config ? chargePricingFromConfig(config) : null;
        if (draft) setPricingDraft(draft);
      }).catch(() => {
        // Client defaults are optional; saved rates remain authoritative until Apply.
      });
    return () => controller.abort();
  }, [shipment.clientCode, isCorporate, reduxApp?.token]);

  const [appliedReratedRate, setAppliedReratedRate] =
    useState<ShipmentRerateRate | null>(null);
  const [liabilityDraft, setLiabilityDraft] =
    useState<CarrierLiability | null>(null);
  const [insuranceDraft, setInsuranceDraft] =
    useState<FreightInsurance | null>(null);
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null);

  const totals = useMemo(
    () =>
      charges.lines.reduce(
        (total, line) => ({
          buy: total.buy + (line.buyCost ?? 0),
          sell: total.sell + (line.sellCost ?? 0),
        }),
        { buy: 0, sell: 0 },
      ),
    [charges.lines],
  );
  const totalMargin = totals.sell - totals.buy;
  const chargeDescriptionOptions = useMemo<ChargeAccessorialOption[]>(() => {
    const query =
      lineEditor?.line.description.trim().toLocaleLowerCase() ?? "";

    if (query.length < 3) return [];

    return chargeAccessorials
      .filter(
        (item: ChargeAccessorial) =>
          item.status !== false &&
          item.description.length > 0 &&
          item.description.toLocaleLowerCase().includes(query),
      )
      .map((item: ChargeAccessorial) => ({
        value: String(item.accessorialID),
        label: item.description,
        description: item.description,
        accesorialCode: item.accesorialCode,
      }));
  }, [chargeAccessorials, lineEditor?.line.description]);
  const hasInlineEditor = Boolean(
    liabilityDraft || insuranceDraft || lineEditor || (isCorporate && isPricingDirty),
  );

  useEffect(() => {
    const request = dispatch(fetchChargeAccessorials(shipment.clientCode));

    return () => request.abort();
  }, [dispatch, shipment.clientCode]);

  useEffect(() => {
    onEditorStateChange(hasInlineEditor);
  }, [hasInlineEditor, onEditorStateChange]);

  if (reratedRate && reratedRate !== appliedReratedRate) {
    setAppliedReratedRate(reratedRate);
    const lines = mergeReratedChargeLines(charges.lines, reratedRate);
    setSourceLines(lines);
    setCharges((current) => ({ ...current, lines }));
  }

  const updateLiabilityDraft = (
    field: keyof CarrierLiability,
    value: number | null,
  ) => {
    setLiabilityDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const saveLiability = () => {
    if (!liabilityDraft) return;
    const hasChanges = !carrierLiabilityValuesAreEqual(
      liabilityDraft,
      charges.liability,
    );

    setCharges((current) => ({
      ...current,
      liability: { ...liabilityDraft },
    }));
    setLiabilityDraft(null);
    if (hasChanges) onChangeCommitted();
  };

  const saveInsurance = () => {
    if (!insuranceDraft) return;
    const hasChanges =
      insuranceDraft.supplemental !== charges.insurance.supplemental;

    setCharges((current) => ({
      ...current,
      insurance: { ...insuranceDraft },
    }));
    setInsuranceDraft(null);
    if (hasChanges) onChangeCommitted();
  };

  const updateLineDraft = (
    field: keyof ChargeLine,
    value: string | number | null,
  ) => {
    setLineEditor((current) => {
      if (!current) return current;

      const isCostField = field === "buyCost" || field === "sellCost";
      const isDiscount = isDiscountCharge(current.line);

      if (
        isCostField &&
        !isDiscount &&
        typeof value === "number" &&
        value < 0
      ) {
        return current;
      }

      const nextValue =
        isCostField && isDiscount && typeof value === "number"
          ? normalizeDiscount(value)
          : value;

      return {
        ...current,
        line: { ...current.line, [field]: nextValue },
      };
    });
  };

  const changeLineDescription = (description: string) => {
    setLineEditor((current) => {
      if (!current) return current;

      return {
        ...current,
        line: normalizeChargeLineCosts({
          ...current.line,
          description,
          code: "",
        }),
      };
    });
  };

  const showDuplicateDescriptionError = () => {
    messageApi.error({
      key: DuplicateChargeDescriptionMessageKey,
      content: DuplicateChargeDescriptionMessage,
    });
  };

  const showMissingChargeRatesError = (content: string) => {
    messageApi.error({
      key: MissingChargeRatesMessageKey,
      content,
    });
  };

  const selectLineAccessorial = (
    selectedValue: string,
    option: ChargeAccessorialOption,
  ) => {
    if (selectedValue !== option.value || !lineEditor) return;

    const selectedLine = normalizeChargeLineCosts({
      ...lineEditor.line,
      description: option.description,
      code: option.accesorialCode,
    });

    setLineEditor({
      ...lineEditor,
      line: selectedLine,
    });

    if (hasDuplicateChargeDescription(charges.lines, selectedLine)) {
      showDuplicateDescriptionError();
    }
  };

  const saveLine = () => {
    if (!lineEditor) return;
    const lineToSave = normalizeChargeLineCosts(
      !isCorporate && lineEditor.isNew
        ? { ...lineEditor.line, buyCost: lineEditor.line.sellCost }
        : lineEditor.line,
    );
    const missingRatesMessage = isCorporate
      ? getMissingChargeRatesMessage(lineToSave)
      : lineToSave.sellCost === null ? MissingSellRateMessage : null;

    if (missingRatesMessage) {
      showMissingChargeRatesError(missingRatesMessage);
      return;
    }

    if (hasDuplicateChargeDescription(charges.lines, lineToSave)) {
      showDuplicateDescriptionError();
      return;
    }

    const existingLine = charges.lines.find(
      (line) => line.id === lineToSave.id,
    );
    const hasChanges =
      lineEditor.isNew ||
      !existingLine ||
      !chargeLineValuesAreEqual(existingLine, lineToSave);

    const sourceLine = { ...lineToSave };
    setSourceLines((current) => orderChargeLines(
      lineEditor.isNew ? [...current, sourceLine] : current.map(
        (line) => line.id === sourceLine.id ? sourceLine : line,
      ),
    ));
    const savedLine = lineToSave;
    setCharges((current) => {
      const lines = lineEditor.isNew
        ? [...current.lines, savedLine]
        : current.lines.map((line) =>
            line.id === lineToSave.id ? savedLine : line,
          );

      return {
        ...current,
        lines: orderChargeLines(lines),
      };
    });
    setLineEditor(null);
    if (hasChanges) onChangeCommitted();
  };

  const deleteLine = (id: string) => {
    const lineToDelete = charges.lines.find((line) => line.id === id);

    if (!lineToDelete || isFreightCharge(lineToDelete)) return;
    setSourceLines((current) => current.filter((line) => line.id !== id));

    setCharges((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id),
    }));
    onChangeCommitted();
  };

  const updatePricingDraft = (value: ChargePricingDraft) => {
    pricingTouched.current = true;
    setPricingDraft(value);
    setIsPricingDirty(true);
  };

  const handleApplyMarkup = () => {
    if (liabilityDraft || insuranceDraft || lineEditor) return;
    pricingTouched.current = true;
    setCharges((current) => ({ ...current, lines: applyChargePricing(sourceLines, pricingDraft) }));
    setIsPricingDirty(false);
    onChangeCommitted();
  };

  return (
    <section
      className='shipment-charges-tab'
      aria-label={`Charges for shipment ${shipment.loadNumber}`}>
      {messageContext}
      <div className='shipment-charge-summary-grid'>
        <article className='shipment-charge-summary-card'>
          <header>
            <div>
              <h2>Carrier Liability</h2>
              <p>
                Carrier liability will vary based on shipment specifics.
                <br />
                In case of questions, please consult the Carriers.
              </p>
            </div>
            <div className='shipment-charge-card-actions'>
              {liabilityDraft ? (
                <>
                  <Button
                    type='text'
                    size='small'
                    icon={<CheckOutlined />}
                    aria-label='Save carrier liability'
                    title='Save'
                    onClick={saveLiability}
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<CloseOutlined />}
                    aria-label='Cancel carrier liability editing'
                    title='Cancel'
                    onClick={() => setLiabilityDraft(null)}
                  />
                </>
              ) : (
                <Button
                  type='text'
                  size='small'
                  icon={<EditOutlined />}
                  aria-label='Edit carrier liability'
                  disabled={readOnlyUnsupported}
                  title='Edit carrier liability'
                  onClick={() => setLiabilityDraft({ ...charges.liability })}
                />
              )}
            </div>
          </header>

          <div className='shipment-charge-summary-body'>
            {liabilityDraft ? (
              <>
                <MoneyInputRow
                  label='Carrier liability new'
                  value={liabilityDraft.newFreight}
                  onChange={(value) =>
                    updateLiabilityDraft("newFreight", value)
                  }
                />
                <MoneyInputRow
                  label='Carrier liability used'
                  value={liabilityDraft.usedFreight}
                  onChange={(value) =>
                    updateLiabilityDraft("usedFreight", value)
                  }
                />
                <MoneyInputRow
                  label='Carrier liability machinery'
                  value={liabilityDraft.machinery}
                  onChange={(value) =>
                    updateLiabilityDraft("machinery", value)
                  }
                />
              </>
            ) : (
              <>
                <MoneyRow
                  label='Carrier liability new'
                  value={charges.liability.newFreight}
                />
                <MoneyRow
                  label='Carrier liability used'
                  value={charges.liability.usedFreight}
                />
                <MoneyRow
                  label='Carrier liability machinery'
                  value={charges.liability.machinery}
                />
              </>
            )}
          </div>
        </article>

        <article className='shipment-charge-summary-card'>
          <header>
            <div>
              <h2>Freight Insurance</h2>
              <p>
                Recommended amount is actual value of freight plus shipping
                charges. This is optional insurance through a third-party
                insurer.
                <br />
                Actual recovery may vary based upon policy terms and conditions.
              </p>
            </div>
            <div className='shipment-charge-card-actions'>
              {insuranceDraft ? (
                <>
                  <Button
                    type='text'
                    size='small'
                    icon={<CheckOutlined />}
                    aria-label='Save freight insurance'
                    title='Save'
                    onClick={saveInsurance}
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<CloseOutlined />}
                    aria-label='Cancel freight insurance editing'
                    title='Cancel'
                    onClick={() => setInsuranceDraft(null)}
                  />
                </>
              ) : (
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      {
                        key: "edit-insurance",
                        label: "Edit supplemental insurance",
                        icon: <EditOutlined />,
                      },
                    ],
                    onClick: () =>
                      setInsuranceDraft({ ...charges.insurance }),
                  }}>
                  <Button
                    type='text'
                    size='small'
                    icon={<MoreOutlined />}
                    aria-label='Freight insurance actions'
                    disabled={readOnlyUnsupported}
                    title='Freight insurance actions'
                  />
                </Dropdown>
              )}
            </div>
          </header>

          <div className='shipment-charge-summary-body'>
            {insuranceDraft ? (
              <MoneyInputRow
                label='Supplemental insurance'
                value={insuranceDraft.supplemental}
                onChange={(supplemental) =>
                  setInsuranceDraft({ supplemental })
                }
              />
            ) : (
              <MoneyRow
                label='Supplemental insurance'
                value={charges.insurance.supplemental}
              />
            )}

            <h3>Deductible (Based on Total Sum Insured)</h3>
            {deductibleTiers.map((tier) => (
              <MoneyRow key={tier} label={tier} value={null} />
            ))}
          </div>
        </article>
      </div>

      <section className='shipment-charge-lines' aria-labelledby='charges-title'>
        <h2 id='charges-title'>Charges</h2>
        {isCorporate && <ChargePricingControls
          value={pricingDraft}
          dirty={isPricingDirty}
          disabled={Boolean(liabilityDraft || insuranceDraft || lineEditor)}
          onChange={updatePricingDraft}
          onApply={handleApplyMarkup}
        />}
        <div className='shipment-charge-table-wrap'>
          <table className='shipment-charge-table'>
            <colgroup>
              <col className='shipment-charge-col-code' />
              <col className='shipment-charge-col-description' />
              {isCorporate && <col className='shipment-charge-col-buy' />}
              <col className='shipment-charge-col-sell' />
              {isCorporate && <col className='shipment-charge-col-margin' />}
              <col className='shipment-charge-col-actions' />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                {isCorporate && <th>Buy</th>}
                <th>Sell</th>
                {isCorporate && <th>Margin</th>}
                <th aria-label='Actions' />
              </tr>
            </thead>
            <tbody>
              {!charges.lines.length && !lineEditor?.isNew ? (
                <tr>
                  <td colSpan={isCorporate ? 6 : 4}>No charges were returned.</td>
                </tr>
              ) : null}
              {charges.lines.map((line) => {
                const isEditing = lineEditor?.line.id === line.id;
                const isFreight = isFreightCharge(line);
                const isDeleteDisabled = Boolean(lineEditor) || isFreight;
                return (
                  <tr key={line.id} className={isEditing ? "is-editing" : ""}>
                    {isEditing && lineEditor ? (
                      <>
                        <td>
                          <Input
                            value={lineEditor.line.code}
                            aria-label='Charge code'
                            readOnly
                          />
                        </td>
                        <td>
                          <AutoComplete<string, ChargeAccessorialOption>
                            value={lineEditor.line.description}
                            aria-label='Charge description'
                            options={chargeDescriptionOptions}
                            filterOption={false}
                            defaultActiveFirstOption
                            onChange={changeLineDescription}
                            onSelect={selectLineAccessorial}
                          />
                        </td>
                        {isCorporate && <td>
                          <InputNumber
                            value={lineEditor.line.buyCost}
                            prefix='$'
                            precision={2}
                            min={
                              isDiscountCharge(lineEditor.line) ? undefined : 0
                            }
                            parser={
                              isDiscountCharge(lineEditor.line)
                                ? undefined
                                : parseNonDiscountCharge
                            }
                            aria-label='Buy charge'
                            onChange={(value) =>
                              updateLineDraft("buyCost", value)
                            }
                          />
                        </td>}
                        <td>
                          <InputNumber
                            value={lineEditor.line.sellCost}
                            prefix='$'
                            precision={2}
                            min={
                              isDiscountCharge(lineEditor.line) ? undefined : 0
                            }
                            parser={
                              isDiscountCharge(lineEditor.line)
                                ? undefined
                                : parseNonDiscountCharge
                            }
                            aria-label='Sell charge'
                            onChange={(value) =>
                              updateLineDraft("sellCost", value)
                            }
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{line.code}</td>
                        <td>{line.description}</td>
                        {isCorporate && <td>{formatCurrency(line.buyCost)}</td>}
                        <td>{formatCurrency(line.sellCost)}</td>
                      </>
                    )}
                    {isCorporate && <td aria-label='Margin'>{formatCurrency((line.sellCost ?? 0) - (line.buyCost ?? 0))}</td>}
                    <td className='shipment-charge-row-actions'>
                      {isEditing ? (
                        <>
                          <Button
                            type='text'
                            size='small'
                            icon={<CheckOutlined />}
                            aria-label='Save charge line'
                            title='Save'
                            onClick={saveLine}
                          />
                          <Button
                            type='text'
                            size='small'
                            icon={<CloseOutlined />}
                            aria-label='Cancel charge line editing'
                            title='Cancel'
                            onClick={() => setLineEditor(null)}
                          />
                        </>
                      ) : (
                        <>
                          <Button
                            type='text'
                            size='small'
                            icon={<EditOutlined />}
                            disabled={Boolean(lineEditor)}
                            aria-label={`Edit ${line.description}`}
                            title='Edit charge'
                            onClick={() =>
                              setLineEditor({ line: { ...line }, isNew: false })
                            }
                          />
                          <Popconfirm
                            disabled={isDeleteDisabled}
                            title='Delete charge line?'
                            description='This removes the charge from this shipment.'
                            okText='Delete'
                            cancelText='Cancel'
                            okButtonProps={{ danger: true }}
                            onConfirm={() => deleteLine(line.id)}>
                            <Button
                              type='text'
                              size='small'
                              danger
                              icon={<DeleteOutlined />}
                              disabled={isDeleteDisabled}
                              aria-label={`Delete ${line.description}`}
                              title={
                                isFreight
                                  ? "Freight charge cannot be deleted"
                                  : "Delete charge"
                              }
                            />
                          </Popconfirm>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {lineEditor?.isNew ? (
                <tr className='is-editing'>
                  <td>
                    <Input
                      value={lineEditor.line.code}
                      aria-label='New charge code'
                      readOnly
                    />
                  </td>
                  <td>
                    <AutoComplete<string, ChargeAccessorialOption>
                      value={lineEditor.line.description}
                      aria-label='New charge description'
                      options={chargeDescriptionOptions}
                      filterOption={false}
                      defaultActiveFirstOption
                      onChange={changeLineDescription}
                      onSelect={selectLineAccessorial}
                    />
                  </td>
                  {isCorporate && <td>
                    <InputNumber
                      value={lineEditor.line.buyCost}
                      prefix='$'
                      precision={2}
                      min={
                        isDiscountCharge(lineEditor.line) ? undefined : 0
                      }
                      parser={
                        isDiscountCharge(lineEditor.line)
                          ? undefined
                          : parseNonDiscountCharge
                      }
                      aria-label='New buy charge'
                      onChange={(value) =>
                        updateLineDraft("buyCost", value)
                      }
                    />
                  </td>}
                  <td>
                    <InputNumber
                      value={lineEditor.line.sellCost}
                      prefix='$'
                      precision={2}
                      min={
                        isDiscountCharge(lineEditor.line) ? undefined : 0
                      }
                      parser={
                        isDiscountCharge(lineEditor.line)
                          ? undefined
                          : parseNonDiscountCharge
                      }
                      aria-label='New sell charge'
                      onChange={(value) =>
                        updateLineDraft("sellCost", value)
                      }
                    />
                  </td>
                  {isCorporate && <td aria-label='Margin' />}
                  <td className='shipment-charge-row-actions'>
                    <Button
                      type='text'
                      size='small'
                      icon={<CheckOutlined />}
                      aria-label='Save new charge line'
                      title='Save'
                      onClick={saveLine}
                    />
                    <Button
                      type='text'
                      size='small'
                      icon={<CloseOutlined />}
                      aria-label='Cancel new charge line'
                      title='Cancel'
                      onClick={() => setLineEditor(null)}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                {isCorporate && <td
                  className={
                    totals.buy < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totals.buy)}
                </td>}
                <td
                  className={
                    totals.sell < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totals.sell)}
                </td>
                {isCorporate && <td
                  className={
                    totalMargin < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totalMargin)}
                </td>}
                <td aria-label='Actions' />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className='shipment-charge-add-line'>
          <Button
            type='text'
            icon={<PlusOutlined />}
            disabled={Boolean(lineEditor)}
            onClick={() =>
              setLineEditor({ line: createEmptyCharge(), isNew: true })
            }>
            Add Line
          </Button>
        </div>
      </section>

      <footer className='shipment-charge-footer'>
        <Button
          icon={<FileTextOutlined />}
          onClick={() => navigate("/quotes/rate")}>
          View Quote Details
        </Button>
      </footer>
    </section>
  );
}

export default Charges;
