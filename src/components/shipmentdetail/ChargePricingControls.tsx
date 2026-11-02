import { Button, Checkbox, Input, Select } from "antd";
import type { ChargeMarkupOption, ChargePricingDraft } from "./chargePricing";
import "./chargePricing.css";

/** Controlled toolbar shared by markup and mutually exclusive Net Sell drafts. */
type ChargePricingControlsProps = {
  value: ChargePricingDraft;
  disabled: boolean;
  dirty: boolean;
  onChange: (value: ChargePricingDraft) => void;
  onApply: () => void;
};

/** Renders the CustomerRate pricing controls without committing draft changes. */
export default function ChargePricingControls({
  value,
  disabled,
  dirty,
  onChange,
  onApply,
}: ChargePricingControlsProps) {
  const updateAmount = (key: "markupRate" | "minimum" | "netSellRate", text: string) => {
    onChange({ ...value, [key]: text.replace(/[^0-9.]/g, "") });
  };
  return (
    <div className="shipment-charge-pricing" role="group" aria-label="Charge pricing">
      <Checkbox
        disabled={disabled}
        checked={value.isMarkupEnabled}
        onChange={(event) => onChange({
          ...value,
          isMarkupEnabled: event.target.checked,
          isNetSellRateEnabled: event.target.checked ? false : value.isNetSellRateEnabled,
        })}>
        Mark Up
      </Checkbox>
      {value.isMarkupEnabled && <>
        <Select<ChargeMarkupOption>
          aria-label="Markup type"
          disabled={disabled}
          value={value.markupDropdownOption}
          onChange={(markupDropdownOption) => onChange({ ...value, markupDropdownOption })}
          options={["Flat", "% Freight", "% Freight + Fuel", "% Freight + Fuel + Accessorial"].map((option) => ({ value: option, label: option }))} />
        <Input
          aria-label="Markup amount"
          disabled={disabled}
          value={value.markupRate}
          prefix={value.markupDropdownOption === "Flat" ? undefined : "%"}
          status={dirty ? "error" : undefined}
          onChange={(event) => updateAmount("markupRate", event.target.value)}
          onPressEnter={onApply}
        />
        <label className="shipment-charge-pricing-min">Min. $
          <Input
            aria-label="Minimum markup"
            disabled={disabled || value.markupDropdownOption === "Flat"}
            value={value.minimum}
            onChange={(event) => updateAmount("minimum", event.target.value)}
            onPressEnter={onApply}
          />
        </label>
      </>}
      <Checkbox
        disabled={disabled}
        checked={value.isNetSellRateEnabled}
        onChange={(event) => onChange({
          ...value,
          isNetSellRateEnabled: event.target.checked,
          isMarkupEnabled: event.target.checked ? false : value.isMarkupEnabled,
        })}>
        Net Sell Rate
      </Checkbox>
      {value.isNetSellRateEnabled && <Input
        aria-label="Net sell amount"
        disabled={disabled}
        prefix="$"
        value={value.netSellRate}
        status={dirty ? "error" : undefined}
        onChange={(event) => updateAmount("netSellRate", event.target.value)}
        onPressEnter={onApply}
      />}
      <Button danger type="primary" disabled={disabled} onClick={onApply}>Apply</Button>
    </div>
  );
}
