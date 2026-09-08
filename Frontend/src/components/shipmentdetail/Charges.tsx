import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Input, InputNumber, message } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ShipmentRecord } from "../../pages/shipmentData";

type ChargeLine = {
  id: string;
  code: string;
  description: string;
  cost: number;
};

type CarrierLiability = {
  newFreight: number;
  usedFreight: number;
  machinery: number;
};

type FreightInsurance = {
  supplemental: number;
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

const initialChargesState: ChargesState = {
  liability: {
    newFreight: 600,
    usedFreight: 0,
    machinery: 0,
  },
  insurance: {
    supplemental: 0,
  },
  lines: [
    { id: "line-item", code: "-", description: "Line Item #1", cost: 591.9 },
    {
      id: "discount",
      code: "-",
      description: "DISCOUNT: -68.9%",
      cost: -407.83,
    },
    {
      id: "fuel-surcharge",
      code: "FSC",
      description: "FUEL SURCHARGE: 25.00%",
      cost: 46.03,
    },
  ],
};

const deductibleTiers = [
  { label: "Less than $10,000", value: 100 },
  { label: "$10,000-$25,000", value: 500 },
  { label: "$25,000-$100,000", value: 2000 },
  { label: "Over $100,000", value: 4500 },
];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function cloneCharges(state: ChargesState): ChargesState {
  return {
    liability: { ...state.liability },
    insurance: { ...state.insurance },
    lines: state.lines.map((line) => ({ ...line })),
  };
}

function formatCurrency(value: number) {
  const formatted = usdFormatter.format(Math.abs(value));
  return value < 0 ? `(${formatted})` : formatted;
}

function createEmptyCharge(): ChargeLine {
  return {
    id: `charge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    code: "",
    description: "",
    cost: 0,
  };
}

function MoneyRow({ label, value }: { label: string; value: number }) {
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
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className='shipment-charge-money-input'>
      <span>{label}</span>
      <InputNumber
        value={value}
        prefix='$'
        precision={2}
        aria-label={label}
        onChange={(nextValue) => onChange(Number(nextValue ?? 0))}
      />
    </label>
  );
}

function Charges({ shipment }: { shipment: ShipmentRecord }) {
  const navigate = useNavigate();
  const [messageApi, messageContext] = message.useMessage();
  const [charges, setCharges] = useState<ChargesState>(() =>
    cloneCharges(initialChargesState),
  );
  const [savedCharges, setSavedCharges] = useState<ChargesState>(() =>
    cloneCharges(initialChargesState),
  );
  const [liabilityDraft, setLiabilityDraft] =
    useState<CarrierLiability | null>(null);
  const [insuranceDraft, setInsuranceDraft] =
    useState<FreightInsurance | null>(null);
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null);

  const total = useMemo(
    () => charges.lines.reduce((sum, line) => sum + line.cost, 0),
    [charges.lines],
  );
  const hasInlineEditor = Boolean(
    liabilityDraft || insuranceDraft || lineEditor,
  );

  const updateLiabilityDraft = (
    field: keyof CarrierLiability,
    value: number,
  ) => {
    setLiabilityDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const saveLiability = () => {
    if (!liabilityDraft) return;
    setCharges((current) => ({
      ...current,
      liability: { ...liabilityDraft },
    }));
    setLiabilityDraft(null);
  };

  const saveInsurance = () => {
    if (!insuranceDraft) return;
    setCharges((current) => ({
      ...current,
      insurance: { ...insuranceDraft },
    }));
    setInsuranceDraft(null);
  };

  const updateLineDraft = (field: keyof ChargeLine, value: string | number) => {
    setLineEditor((current) =>
      current
        ? { ...current, line: { ...current.line, [field]: value } }
        : current,
    );
  };

  const saveLine = () => {
    if (!lineEditor) return;
    setCharges((current) => ({
      ...current,
      lines: lineEditor.isNew
        ? [...current.lines, lineEditor.line]
        : current.lines.map((line) =>
            line.id === lineEditor.line.id ? lineEditor.line : line,
          ),
    }));
    setLineEditor(null);
  };

  const saveAllChanges = () => {
    setSavedCharges(cloneCharges(charges));
    messageApi.success("Shipment charges saved for this session");
  };

  const cancelAllChanges = () => {
    setCharges(cloneCharges(savedCharges));
    setLiabilityDraft(null);
    setInsuranceDraft(null);
    setLineEditor(null);
    messageApi.info("Unsaved charge changes were discarded");
  };

  return (
    <section
      className='shipment-charges-tab'
      aria-label={`Charges for shipment ${shipment.bol}`}>
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
              <MoneyRow key={tier.label} label={tier.label} value={tier.value} />
            ))}
          </div>
        </article>
      </div>

      <section className='shipment-charge-lines' aria-labelledby='charges-title'>
        <h2 id='charges-title'>Charges</h2>
        <div className='shipment-charge-table-wrap'>
          <table className='shipment-charge-table'>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Cost</th>
                <th aria-label='Actions' />
              </tr>
            </thead>
            <tbody>
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
                            onChange={(event) =>
                              updateLineDraft("code", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <Input
                            value={lineEditor.line.description}
                            aria-label='Charge description'
                            onChange={(event) =>
                              updateLineDraft("description", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <InputNumber
                            value={lineEditor.line.cost}
                            prefix='$'
                            precision={2}
                            aria-label='Charge cost'
                            onChange={(value) =>
                              updateLineDraft("cost", Number(value ?? 0))
                            }
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{line.code || "-"}</td>
                        <td>{line.description || "—"}</td>
                        <td>{formatCurrency(line.cost)}</td>
                      </>
                    )}
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
                      onChange={(event) =>
                        updateLineDraft("code", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={lineEditor.line.description}
                      aria-label='New charge description'
                      onChange={(event) =>
                        updateLineDraft("description", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <InputNumber
                      value={lineEditor.line.cost}
                      prefix='$'
                      precision={2}
                      aria-label='New charge cost'
                      onChange={(value) =>
                        updateLineDraft("cost", Number(value ?? 0))
                      }
                    />
                  </td>
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
          </table>
        </div>

        <div className='shipment-charge-total-row'>
          <strong>Total</strong>
          <span>{formatCurrency(total)}</span>
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
        <Button danger onClick={cancelAllChanges}>
          Cancel
        </Button>
        <Button
          type='primary'
          disabled={hasInlineEditor}
          onClick={saveAllChanges}>
          Save
        </Button>
      </footer>
    </section>
  );
}

export default Charges;
