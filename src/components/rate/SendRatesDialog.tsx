import {
  CloseOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Input, Modal } from "antd";
import { useMemo } from "react";
import { formatDateTimeDisplay, CarrierLogo } from "../../pages/Rate";

export type SendRateItem = {
  id: string;
  name: string;
  code: string;
  service: string;
  price: number;
  grossCharge?: number;
  grossSell?: number;
  grossSellAmount?: number;
  sellPrice?: number;
  transitDays: number;
  estimatedDelivery: string;
  logo?: string;
  logoKind: "image" | "fedex";
};

type SendRatesDialogProps = {
  open: boolean;
  rates: SendRateItem[];
  recipients: string[];
  selectedRateIds: string[];
  validationError: string;
  quoteNumber?: string;
  origin?: string;
  destination?: string;
  loading?: boolean;
  onClose: () => void;
  onRecipientsChange: (recipients: string[]) => void;
  onSelectedRateIdsChange: (rateIds: string[]) => void;
  onSubmit: () => void;
};

export default function SendRatesDialog({
  open,
  rates,
  recipients,
  selectedRateIds,
  validationError,
  quoteNumber,
  origin,
  destination,
  loading = false,
  onClose,
  onRecipientsChange,
  onSelectedRateIdsChange,
  onSubmit,
}: SendRatesDialogProps) {

  const displayableRates = useMemo(() => {
    return rates.filter((rate) => (Number(rate.price) || 0) > 0);
  }, [rates]);

  const allRatesSelected =
    displayableRates.length > 0 &&
    displayableRates.every((rate) => selectedRateIds.includes(rate.id));

  const routeText = [origin, destination].filter(Boolean).join(" \u2192 ");
  const subtitle = [
    quoteNumber ? `Quote #${quoteNumber}` : "",
    routeText,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const updateRecipient = (index: number, email: string) => {
    onRecipientsChange(
      recipients.map((recipient, recipientIndex) =>
        recipientIndex === index ? email : recipient,
      ),
    );
  };

  const removeRecipient = (index: number) => {
    onRecipientsChange(
      recipients.filter((_, recipientIndex) => recipientIndex !== index),
    );
  };

  const toggleRate = (rateId: string, checked: boolean) => {
    onSelectedRateIdsChange(
      checked
        ? Array.from(new Set([...selectedRateIds, rateId]))
        : selectedRateIds.filter((id) => id !== rateId),
    );
  };

  const toggleAllRates = () => {
    onSelectedRateIdsChange(
      allRatesSelected ? [] : displayableRates.map((rate) => rate.id),
    );
  };

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={580}
      className='send-rates-modal'
      onCancel={onClose}>
      <form
        className='send-rates-dialog'
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}>
        <header className='send-rates-dialog__header'>
          <div>
            <h2>Send freight rates</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type='button'
            className='send-rates-dialog__close'
            aria-label='Close send rates dialog'
            onClick={onClose}>
            <CloseOutlined />
          </button>
        </header>

        <section
          className='send-rates-dialog__recipients'
          aria-labelledby='send-to-title'>
          <h3 id='send-to-title'>Send to</h3>
          <div className='send-rates-dialog__recipient-list'>
            {recipients.map((recipient, index) => (
              <div
                className='send-rates-dialog__recipient'
                key={`recipient-${index}`}>
                <Input
                  type='email'
                  value={recipient}
                  placeholder='Email address'
                  aria-label={`Recipient email ${index + 1}`}
                  onChange={(event) => updateRecipient(index, event.target.value)}
                />
                <button
                  type='button'
                  className='send-rates-dialog__remove-recipient'
                  aria-label={`Remove recipient ${index + 1}`}
                  onClick={() => removeRecipient(index)}>
                  <CloseOutlined />
                </button>
              </div>
            ))}
          </div>
          <Button
            htmlType='button'
            className='send-rates-dialog__add-recipient'
            icon={<PlusOutlined />}
            onClick={() => onRecipientsChange([...recipients, ""])}>
            Add recipient
          </Button>
        </section>

        <section
          className='send-rates-dialog__rates'
          aria-labelledby='rates-to-include-title'>
          <div className='send-rates-dialog__rates-heading'>
            <h3 id='rates-to-include-title'>Rates to include</h3>
            <div>
              <span>{selectedRateIds.length} selected</span>
              <button type='button' onClick={toggleAllRates}>
                {allRatesSelected ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>

          <div className='send-rates-dialog__rate-list'>
            {displayableRates.map((rate) => {
              const checked = selectedRateIds.includes(rate.id);
              const serviceLabel =
                rate.service === "STANDARD RATE" ? "Standard" : rate.service || "Economy";

              const displayPrice =
                rate.sellPrice !== undefined && rate.sellPrice !== null
                  ? Number(rate.sellPrice)
                  : Number(rate.price) || 0;

              return (
                <label
                  className={`send-rates-dialog__rate ${checked ? "is-selected" : ""}`}
                  key={rate.id}>
                  <Checkbox
                    checked={checked}
                    onChange={(event) => toggleRate(rate.id, event.target.checked)}
                    aria-label={`Include ${rate.name}`}
                  />
                  <span className='send-rates-dialog__logo'>
                    <CarrierLogo rate={rate as any} />
                  </span>
                  <span className='send-rates-dialog__rate-details'>
                    <span className='send-rates-dialog__rate-name'>
                      {rate.name}
                      <small>{rate.code}</small>
                    </span>
                    <span className='send-rates-dialog__rate-meta'>
                      {rate.transitDays} days <b>{"\u00b7"}</b> Est. delivery{" "}
                      {formatDateTimeDisplay(rate.estimatedDelivery)}
                      <em
                        className={
                          (rate.service || "").toUpperCase().includes("ECONOMY") ? "is-economy" : ""
                        }>
                        {serviceLabel}
                      </em>
                    </span>
                  </span>
                  <span className='send-rates-dialog__price'>
                    {displayPrice.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                    <small>Total</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {validationError ? (
          <p className='send-rates-dialog__validation' role='alert'>
            {validationError}
          </p>
        ) : null}

        <footer className='send-rates-dialog__footer'>
          <p>
            <strong>{selectedRateIds.length}</strong> rates {"\u00b7"}{" "}
            <strong>{recipients.length}</strong>{" "}
            {recipients.length === 1 ? "recipient" : "recipients"}
          </p>
          <div>
            <Button htmlType='button' onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type='primary'
              htmlType='submit'
              loading={loading}
              icon={<SendOutlined />}>
              Send rates
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
