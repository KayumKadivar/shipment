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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  fetchChargeAccessorials,
  type ChargeAccessorial,
} from "../../store/chargeAccessorialsSlice";
import type { ShipmentDetails } from "../../types/shipment.types";
import { aggregateAccessorialCharges } from "./shipmentAccessorials";

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

function normalizeChargeDescription(description: string) {
  return description.trim().toLocaleLowerCase();
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
}: ChargesProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();
  const chargeAccessorials = useAppSelector(
    (state) => state.chargeAccessorials.data,
  );
  const [charges, setCharges] = useState<ChargesState>(() =>
    createInitialCharges(shipment),
  );
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
    liabilityDraft || insuranceDraft || lineEditor,
  );

  useEffect(() => {
    const request = dispatch(fetchChargeAccessorials(shipment.clientCode));

    return () => request.abort();
  }, [dispatch, shipment.clientCode]);

  useEffect(() => {
    onEditorStateChange(hasInlineEditor);
  }, [hasInlineEditor, onEditorStateChange]);

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
    const lineToSave = normalizeChargeLineCosts(lineEditor.line);

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

    setCharges((current) => {
      const lines = lineEditor.isNew
        ? [...current.lines, lineToSave]
        : current.lines.map((line) =>
            line.id === lineToSave.id ? lineToSave : line,
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
    setCharges((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id),
    }));
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
        <div className='shipment-charge-table-wrap'>
          <table className='shipment-charge-table'>
            <colgroup>
              <col className='shipment-charge-col-code' />
              <col className='shipment-charge-col-description' />
              <col className='shipment-charge-col-buy' />
              <col className='shipment-charge-col-sell' />
              <col className='shipment-charge-col-margin' />
              <col className='shipment-charge-col-actions' />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Buy</th>
                <th>Sell</th>
                <th>Margin</th>
                <th aria-label='Actions' />
              </tr>
            </thead>
            <tbody>
              {!charges.lines.length && !lineEditor?.isNew ? (
                <tr>
                  <td colSpan={6}>No charges were returned.</td>
                </tr>
              ) : null}
              {charges.lines.map((line) => {
                const isEditing = lineEditor?.line.id === line.id;
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
                        <td>
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
                        </td>
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
                        <td>{formatCurrency(line.buyCost)}</td>
                        <td>{formatCurrency(line.sellCost)}</td>
                      </>
                    )}
                    <td aria-label='Margin' />
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
                              disabled={Boolean(lineEditor)}
                              aria-label={`Delete ${line.description}`}
                              title='Delete charge'
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
                  <td>
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
                  </td>
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
                  <td aria-label='Margin' />
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
                <td
                  className={
                    totals.buy < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totals.buy)}
                </td>
                <td
                  className={
                    totals.sell < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totals.sell)}
                </td>
                <td
                  className={
                    totalMargin < 0
                      ? "shipment-charge-total-negative"
                      : undefined
                  }>
                  {formatCurrency(totalMargin)}
                </td>
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
