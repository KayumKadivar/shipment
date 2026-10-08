import {
  AppstoreOutlined,
  BarsOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, Select, Spin, Result, message } from "antd";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import {
  COST_CODE_GROSS,
  COST_CODE_DISC,
  COST_CODE_FUEL,
  COST_NAME_GROSS,
  COST_NAME_DISC,
  COST_NAME_FUEL,
  setQuoteFormData,
} from "../store/customerRateSlice";
import { fetchQuoteById } from "../store/quoteSlice";
import { fetchAccessorials } from "../store/accessorialsSlice";
import SendRatesDialog from "../components/rate/SendRatesDialog";
import {
  RateMap,
  CarrierCard,
  type CarrierRate,
  type SortOption,
  type QuoteMode,
  type ViewMode,
} from "./Rate";

function QuoteRateDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();

  const [quoteMode, setQuoteMode] = useState<QuoteMode>("ltl");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rate-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<string[]>([""]);
  const [sendRateIds, setSendRateIds] = useState<string[]>([]);
  const [sendValidationError, setSendValidationError] = useState("");

  const { currentQuote: apiQuote, loading } = useAppSelector((state) => state.quote);
  const quoteFormData = useAppSelector((state) => state.customerRate.quoteFormData);
  const accessorialsData = useAppSelector((state: any) => state.accessorials?.data) || [];

  useEffect(() => {
    if (reference) {
      dispatch(fetchQuoteById(reference));
    }
    dispatch(fetchAccessorials());
  }, [dispatch, reference]);

  const originCountry = (apiQuote as any)?.originCountry || "USA";
  const destCountry = (apiQuote as any)?.destinationCountry || "USA";

  const dynamicOrigin = apiQuote
    ? `${apiQuote.originCity || ''}, ${apiQuote.originStateCode || ''} ${apiQuote.originZip || ''}, ${originCountry}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const dynamicDestination = apiQuote
    ? `${apiQuote.destinationCity || ''}, ${apiQuote.destinationStateCode || ''} ${apiQuote.destinationZip || ''}, ${destCountry}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ', ')
    : "";

  const shipmentDate = apiQuote?.pickupDate 
    ? new Date(apiQuote.pickupDate).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' })
    : (apiQuote?.requestedDate ? new Date(apiQuote.requestedDate).toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' }) : "");

  const rates = useMemo<CarrierRate[]>(() => {
    if (apiQuote && apiQuote.quoteResults && apiQuote.quoteResults.length > 0) {
      return apiQuote.quoteResults.map((result: any, index: number) => {
        let grossCharge = Number(result.grossCharge) || 0;
        let discount = Number(result.discount) || 0;
        let fuelSurcharge = Number(result.fuelSurcharge) || 0;
        const otherAccessorials: { accessorialDescription?: string; accessorialCharge?: number }[] = [];

        if (result.quoteCostDetails && Array.isArray(result.quoteCostDetails)) {
          result.quoteCostDetails.forEach((cd: any) => {
            const code = (cd.accCode || "").trim().toUpperCase();
            const name = (cd.accName || "").trim().toLowerCase();
            const amount = Number(cd.amount) || 0;

            if (code === COST_CODE_GROSS || name === COST_NAME_GROSS.toLowerCase() || name === "grosscharge") {
              grossCharge = amount;
            } else if (code === COST_CODE_DISC || name === COST_NAME_DISC.toLowerCase()) {
              discount = amount;
            } else if (code === COST_CODE_FUEL || name === COST_NAME_FUEL.toLowerCase() || name === "fuelsurcharge") {
              fuelSurcharge = amount;
            } else {
              otherAccessorials.push({
                accessorialDescription: cd.accName || cd.accCode || "Accessorial",
                accessorialCharge: amount,
              });
            }
          });
        }

        const calculatedPrice =
          Number(result.totalShipmentCost) ||
          Number(result.netCharge) ||
          Number(result.price) ||
          (grossCharge - discount + fuelSurcharge + otherAccessorials.reduce((acc, c) => acc + (c.accessorialCharge || 0), 0));

        return {
          id: String(result.quoteResultId || `${result.scac}-${index}`),
          name: result.carrierName || "Unknown Carrier",
          code: result.scac || "",
          service: result.serviceLevel || result.serviceType || "Standard",
          logoKind: "image" as const,
          price: calculatedPrice > 0 ? calculatedPrice : 0,
          transitDays: parseInt(result.transitDays) || 0,
          estimatedDelivery: result.estimatedDeliveryDate || "0001-01-01T00:00:00",
          warning: result.errorMessage?.trim() || result.warning?.trim() || (calculatedPrice <= 0 ? "Rate unavailable or carrier error." : ""),
          quoteExpiry: apiQuote.requestedDate || "N/A",
          liabilityNew: "",
          liabilityUsed: "",
          grossCharge,
          discount,
          fuelSurcharge,
          accessorialCharges: otherAccessorials,
        };
      });
    }
    return [];
  }, [apiQuote]);

  const visibleRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = rates.filter((rate) =>
      [rate.name, rate.code, rate.service].some((value) =>
        (value || "").toLowerCase().includes(query),
      ),
    );

    return [...matches].sort((first, second) => {
      if (sortBy === "rate-desc") return second.price - first.price;
      if (sortBy === "transit") {
        if (first.transitDays === second.transitDays) {
          return first.price - second.price;
        }
        return first.transitDays - second.transitDays;
      }
      return first.price - second.price;
    });
  }, [search, sortBy, rates]);

  const validRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) > 0);
  }, [visibleRates]);

  const errorRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) <= 0);
  }, [visibleRates]);

  const handleEditQuote = () => {
    if (apiQuote) {
      dispatch(
        setQuoteFormData({
          origPostal: apiQuote.originZip || "",
          origCity: apiQuote.originCity || "",
          origState: apiQuote.originStateCode || "",
          origCountry: originCountry,
          pickupDate: apiQuote.pickupDate || null,
          destPostal: apiQuote.destinationZip || "",
          destCity: apiQuote.destinationCity || "",
          destState: apiQuote.destinationStateCode || "",
          destCountry: destCountry,
          packages: [{
            id: "package-1",
            items: (apiQuote.quoteProducts || []).map((p: any, idx: number) => ({
              id: `item-${idx + 1}`,
              units: String(p.pallets ?? p.units ?? ""),
              handlingUnit: p.packagingGroup || p.packageType || "Pallet",
              pieces: String(p.pieces ?? ""),
              weight: String(p.weight ?? ""),
              weightUnit: "lbs",
              freightClass: String(p.productClass ?? p.class ?? "50"),
              length: String(p.length ?? ""),
              width: String(p.width ?? ""),
              height: String(p.height ?? ""),
              dimensionUnit: "in.",
              nmfc: String(p.productNMFC ?? p.nmfc ?? ""),
              description: p.description ?? "",
              stackable: Boolean(p.isStackable ?? p.stackable),
              hazMat: Boolean(p.isHazmat ?? p.hazMat),
              hazMatClass: p.hazmatClass ?? "",
              hazMatUN: p.hazmatUN ?? "",
            })),
          }],
          selectedAccessorials: (apiQuote.quoteAccessorials || []).map((a: any) => a.accCode || a.description || a),
          selectedClientCode: apiQuote.clientCode || undefined,
        })
      );
    }
    navigate("/quotes");
  };

  const handleShipIt = (rate: CarrierRate) => {
    let quoteToSend = apiQuote ? { ...apiQuote } : undefined;
    if (quoteToSend?.quoteProducts) {
      const formItems = quoteFormData?.packages?.flatMap((p: any) => p.items || []) || [];
      quoteToSend.quoteProducts = quoteToSend.quoteProducts.map((p: any, idx: number) => {
        const matchingForm = formItems[idx];
        return {
          ...p,
          length: (p.length != null && p.length !== 0 && p.length !== "") ? p.length : (matchingForm?.length || p.length),
          width: (p.width != null && p.width !== 0 && p.width !== "") ? p.width : (matchingForm?.width || p.width),
          height: (p.height != null && p.height !== 0 && p.height !== "") ? p.height : (matchingForm?.height || p.height),
          packagingGroup: p.packagingGroup || matchingForm?.handlingUnit || p.packagingGroup,
          pieces: (p.pieces != null && p.pieces !== 0 && p.pieces !== "") ? p.pieces : (matchingForm?.pieces || p.pieces),
          pallets: (p.pallets != null && p.pallets !== 0 && p.pallets !== "") ? p.pallets : (matchingForm?.units || p.pallets),
          productNMFC: p.productNMFC || matchingForm?.nmfc || p.productNMFC,
          description: p.description || matchingForm?.description || p.description,
        };
      });
    }

    navigate("/shipments/new", {
      state: {
        quote: quoteToSend,
        selectedCarrier: rate,
        reference,
      },
    });
  };

  const setRateChecked = (rate: CarrierRate, checked: boolean) => {
    setSelectedRates((current) =>
      checked
        ? current.includes(rate.id)
          ? current
          : [...current, rate.id]
        : current.filter((id) => id !== rate.id),
    );
  };

  const closeSendDialog = () => {
    setIsSendDialogOpen(false);
    setSendRecipients([""]);
    setSendRateIds([]);
    setSendValidationError("");
  };

  const openSendDialog = (rateIds: string[] = []) => {
    setSendRecipients([""]);
    setSendRateIds(rateIds);
    setSendValidationError("");
    setIsSendDialogOpen(true);
  };

  const sendRates = () => {
    const enteredRecipients = sendRecipients
      .map((recipient) => recipient.trim())
      .filter(Boolean);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!enteredRecipients.length) {
      setSendValidationError("Add at least one recipient email address.");
      return;
    }

    if (enteredRecipients.some((recipient) => !emailPattern.test(recipient))) {
      setSendValidationError("Enter a valid email address for every recipient.");
      return;
    }

    if (!sendRateIds.length) {
      setSendValidationError("Select at least one rate to send.");
      return;
    }

    messageApi.success(
      `${sendRateIds.length} ${sendRateIds.length === 1 ? "rate" : "rates"} sent to ${enteredRecipients.length} ${enteredRecipients.length === 1 ? "recipient" : "recipients"}`,
    );
    closeSendDialog();
  };

  const isQuoteForThisRef = apiQuote && String(apiQuote.quoteRequestId) === String(reference);

  if (loading || !isQuoteForThisRef) {
    return (
      <section className='rate-page' style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </section>
    );
  }

  if (!loading && !apiQuote) {
    return (
      <section className='rate-page'>
        <button
          type='button'
          className='rate-back-button'
          onClick={() => navigate("/quote-summary")}>
          &larr; All Quotes
        </button>
        <Result
          status='404'
          title='Quote not found'
          subTitle='This quote reference does not exist in the current summary.'
          extra={
            <Button type='primary' onClick={() => navigate("/quote-summary")}>
              Back to Quote Summary
            </Button>
          }
        />
      </section>
    );
  }

  const totalWeight = (apiQuote?.quoteProducts || []).reduce((acc: number, item: any) => acc + (Number(item.weight) || 0), 0);

  return (
    <section className='rate-page'>
      {messageContext}

      <button
        type='button'
        className='rate-back-button'
        onClick={() => {
          navigate("/quote-summary");
        }}>
        &larr; All Quotes
      </button>

      <header className='rate-page__header'>
        <h1>Quote Results</h1>
        <div className='rate-page__header-actions'>
          <Button onClick={handleEditQuote}>
            Edit Quote
          </Button>
          <Button onClick={() => messageApi.success("Quote is already saved.")}>
            Save Quote
          </Button>
          <Button
            danger
            onClick={() => messageApi.info("Quote deletion is not connected yet.")}>
            Delete Quote
          </Button>
        </div>
      </header>

      <div className='rate-capacity-warning' role='alert'>
        <ExclamationCircleOutlined />
        <span>
          Your quote exceeds some carrier capacity rules, so we didn't include
          those carriers in this list.
        </span>
      </div>

      <div className='rate-content-grid'>
        <aside className='rate-context'>
          <article className='rate-route-card'>
            <div className='rate-route-card__map'>
              <RateMap originAddress={dynamicOrigin} destinationAddress={dynamicDestination} />
            </div>
            <div className='rate-route-card__summary'>
              <div>
                <span>FROM</span>
                <strong>{dynamicOrigin}</strong>
                {shipmentDate && <small>{shipmentDate}</small>}
              </div>
              <div>
                <span>TO</span>
                <strong>{dynamicDestination}</strong>
              </div>
            </div>
          </article>

          <article className='rate-items-card'>
            <h2>ITEMS</h2>
            {(apiQuote?.quoteProducts || []).map((item: any, index: number) => {
              const pieces = item.pieces != null && item.pieces !== 0 && item.pieces !== "" ? item.pieces : (item.pallets ?? item.units ?? "");
              const pkgType = (item.packagingGroup || item.packageType || "PALLET").toUpperCase();
              const fClass = item.productClass || item.class;
              return (
                <div key={index} className='rate-items-card__body'>
                  <strong className='rate-item-pill'>{[pieces, pkgType].filter(Boolean).join(" ")} {fClass ? `· CLASS ${fClass}` : ''}</strong>
                  <dl>
                    <div>
                      <dt>Piece(s)</dt>
                      <dd>{pieces}</dd>
                    </div>
                    <div>
                      <dt>Weight</dt>
                      <dd>{item.weight != null ? `${item.weight} lbs` : ''}</dd>
                    </div>
                    <div>
                      <dt>Dimensions</dt>
                      <dd>{item.length != null && item.width != null && item.height != null && item.length !== "" ? `${item.length}" × ${item.width}" × ${item.height}"` : ''}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
            <dl className='rate-items-card__totals'>
              <div>
                <dt>Total weight</dt>
                <dd>{totalWeight ? `${totalWeight} lbs` : ''}</dd>
              </div>
              <div>
                <dt>Total linear feet</dt>
                <dd>0 ft</dd>
              </div>
            </dl>
          </article>

          {(apiQuote?.quoteAccessorials && apiQuote.quoteAccessorials.length > 0) && (
            <article className='rate-items-card'>
              <h2>ACCESSORIALS</h2>
              <div className='rate-items-card__body rate-accessorials-list'>
                {apiQuote.quoteAccessorials.map((acc: any, idx: number) => {
                  const accCode = (acc.accCode || acc.accesorialCode || acc.accessorialName || acc.description || acc || "").toString();
                  const match = accessorialsData.find((a: any) => a.accesorialCode === accCode || a.accessorialName === accCode);
                  const displayName = match ? match.accessorialName : (acc.accName || acc.description || accCode);
                  return (
                    <strong key={idx} className='rate-item-pill'>{displayName}</strong>
                  );
                })}
              </div>
            </article>
          )}
        </aside>

        <main className='rate-results'>
          <div className='rate-mode-tabs' role='tablist' aria-label='Quote type'>
            <button
              type='button'
              role='tab'
              aria-selected={quoteMode === "ltl"}
              className={quoteMode === "ltl" ? "active" : ""}
              onClick={() => setQuoteMode("ltl")}>
              LTL <span>{rates.length}</span>
            </button>
          </div>

          <div className='rate-toolbar'>
            <Input
              value={search}
              prefix={<SearchOutlined />}
              placeholder='Carriers search'
              allowClear
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select<SortOption>
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "rate-asc", label: "Sort by rate, low to high" },
                { value: "rate-desc", label: "Sort by rate, high to low" },
                { value: "transit", label: "Sort by transit time" },
              ]}
            />
            <Button
              className='rate-send-all'
              icon={<SendOutlined />}
              onClick={() => openSendDialog()}
            >
              Send All
            </Button>
            <div className='rate-view-switch' aria-label='Results view'>
              <button
                type='button'
                className={viewMode === "list" ? "active" : ""}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}>
                <BarsOutlined /> List View
              </button>
              <button
                type='button'
                className={viewMode === "grid" ? "active" : ""}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}>
                <AppstoreOutlined /> Grid View
              </button>
            </div>
          </div>

          {!loading && (
            <p className='rate-results-count'>
              {`Showing ${quoteMode === "ltl" ? visibleRates.length : 0} of ${rates.length} carriers`}
            </p>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spin size="large" />
            </div>
          )}

          {!loading && quoteMode === "volume" ? (
            <div className='rate-empty-state'>
              <Empty description='No volume rates are available for this quote.' />
            </div>
          ) : !loading && (validRates.length > 0 || errorRates.length > 0) ? (
            <>
              {validRates.length > 0 ? (
                <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                  {validRates.map((rate) => (
                    <CarrierCard
                      key={rate.id}
                      rate={rate}
                      checked={selectedRates.includes(rate.id)}
                      onCheckedChange={(checked) =>
                        setRateChecked(rate, checked)
                      }
                      onShipIt={() => handleShipIt(rate)}
                      onSend={() => openSendDialog([rate.id])}
                    />
                  ))}
                </div>
              ) : null}

              {errorRates.length > 0 ? (
                <section className='rate-error-section' aria-label='Carriers with errors'>
                  <h2 className='rate-error-heading'>
                    <span>With Errors</span>
                    <span className='rate-error-badge'>{errorRates.length}</span>
                  </h2>
                  <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                    {errorRates.map((rate) => (
                      <CarrierCard
                        key={rate.id}
                        rate={rate}
                        checked={selectedRates.includes(rate.id)}
                        onCheckedChange={(checked) =>
                          setRateChecked(rate, checked)
                        }
                        onShipIt={() => handleShipIt(rate)}
                        onSend={() => openSendDialog([rate.id])}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : !loading ? (
            <div className='rate-empty-state'>
              <Empty description='No carrier quotes available for this reference.' />
            </div>
          ) : null}
        </main>
      </div>

      <SendRatesDialog
        open={isSendDialogOpen}
        rates={rates}
        recipients={sendRecipients}
        selectedRateIds={sendRateIds}
        validationError={sendValidationError}
        onClose={closeSendDialog}
        onRecipientsChange={(recipients) => {
          setSendRecipients(recipients);
          setSendValidationError("");
        }}
        onSelectedRateIdsChange={(rateIds) => {
          setSendRateIds(rateIds);
          setSendValidationError("");
        }}
        onSubmit={sendRates}
      />
    </section>
  );
}

export default QuoteRateDetail;
