import {
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Col, Empty, Input, Select, Spin, Result, message } from "antd";
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from "../config/apiConfig";
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
import { fetchClientsAndSubclients } from "../store/customerLocationSlice";
import "../components/New Shipment/newshipment.css";
import SendRatesDialog from "../components/rate/SendRatesDialog";
import {
  RateMap,
  CarrierCard,
  applyMarkupToRate,
  type AppliedMarkupConfig,
  type CarrierRate,
  type SortOption,
  type ViewMode,
} from "./Rate";

const normalizeMarkupType = (
  raw?: string,
): "flat" | "percentage" | "netSellRate" => {
  if (!raw) return "netSellRate";
  const clean = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (clean.includes("percent")) return "netSellRate";
  if (
    clean.includes("netsell") ||
    clean.includes("sellrate") ||
    clean.includes("net") ||
    clean.includes("sell")
  )
    return "netSellRate";
  if (clean.includes("flat")) return "netSellRate";
  return "netSellRate";
};

function QuoteRateDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const dispatch = useAppDispatch();
  const [messageApi, messageContext] = message.useMessage();

  const { currentQuote: apiQuote, loading } = useAppSelector((state) => state.quote);
  const quoteFormData = useAppSelector((state) => state.customerRate.quoteFormData);
  const accessorialsData = useAppSelector((state) => state.accessorials.data);
  const storeIsCorporate = useAppSelector((state) => state.app.isCorporate);
  const clients = useAppSelector((state) => state.customerLocation?.clients) || [];

  // isCorporate check (matching CustomerRate.tsx)
  const clientCodeToUse =
    apiQuote?.clientCode ||
    sessionStorage.getItem("quotes_selectedClientCode") ||
    sessionStorage.getItem("customerLocation_selectedClientCode") ||
    DEFAULT_CLIENT_CODE;
  const selectedClient = clientCodeToUse
    ? clients.find((c) => c.clientCode === clientCodeToUse)
    : undefined;
  const clientCorporateFlag = (
    selectedClient as { isCorporate?: boolean } | undefined
  )?.isCorporate;

  const isCorporate =
    typeof clientCorporateFlag === "boolean"
      ? clientCorporateFlag
      : (storeIsCorporate ??
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("isCorporate") === "true"));

  // Markup UI State
  const [isMarkupEnabled, setIsMarkupEnabled] = useState(false);
  const [markupDropdownOption, setMarkupDropdownOption] = useState("% Freight + Fuel");
  const [markupRate, setMarkupRate] = useState("0");
  const [isMarkupRateDirty, setIsMarkupRateDirty] = useState(false);
  const [markup, setMarkup] = useState("0");
  const [isNetSellRateEnabled, setIsNetSellRateEnabled] = useState(false);
  const [netSellRate, setNetSellRate] = useState("");
  const [isNetSellDirty, setIsNetSellDirty] = useState(false);

  const [appliedMarkupConfig, setAppliedMarkupConfig] = useState<AppliedMarkupConfig>({
    isMarkupEnabled: false,
    markupDropdownOption: "% Freight + Fuel",
    numericMarkup: 0,
    numericMarkupRate: 0,
    isNetSellRateEnabled: false,
    numericNetSellRate: 0,
  });

  const handleApplyMarkup = () => {
    const numRate = Math.max(0, Number(markupRate) || 0);
    const numMin = Math.max(0, Number(markup) || 0);
    const numNetSell = Math.max(0, Number(netSellRate) || 0);

    setAppliedMarkupConfig({
      isMarkupEnabled,
      markupDropdownOption,
      numericMarkup: numMin,
      numericMarkupRate: numRate,
      isNetSellRateEnabled,
      numericNetSellRate: numNetSell,
    });

    setIsMarkupRateDirty(false);
    setIsNetSellDirty(false);

    if (isMarkupEnabled && (numRate > 0 || numMin > 0)) {
      messageApi.success("Applied " + markupDropdownOption + " markup");
    } else if (isNetSellRateEnabled) {
      messageApi.success("Applied Net Sell Rate");
    } else if (!isMarkupEnabled && !isNetSellRateEnabled) {
      messageApi.info("Markup removed");
    } else {
      messageApi.info("Applied");
    }
  };

  // Legacy markup state
  const [, setMarkupType] = useState<"flat" | "percentage" | "netSellRate">("netSellRate");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rate-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<string[]>([""]);
  const [sendRateIds, setSendRateIds] = useState<string[]>([]);
  const [sendValidationError, setSendValidationError] = useState("");

  useEffect(() => {
    if (reference) {
      dispatch(fetchQuoteById(reference));
    }
    const clientCodeForAccessorials =
      (typeof localStorage !== "undefined" ? localStorage.getItem("clientCode") : null) ||
      DEFAULT_CLIENT_CODE;
    dispatch(fetchAccessorials(clientCodeForAccessorials));
    dispatch(fetchClientsAndSubclients());
  }, [dispatch, reference]);

  useEffect(() => {
    const fetchClientMarkup = async () => {
      const clientCodeToUse =
        apiQuote?.clientCode ||
        sessionStorage.getItem("quotes_selectedClientCode") ||
        sessionStorage.getItem("customerLocation_selectedClientCode") ||
        DEFAULT_CLIENT_CODE ||
        "DEVTS";

      if (!clientCodeToUse) return;

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = "Bearer " + token;

      try {
        const response = await axios.get(
          API_BASE_URL + "/ClientMarkupConfig/GetClientMarkup/" + encodeURIComponent(clientCodeToUse),
          { headers },
        );
        if (response.data?.isSuccess && response.data?.data) {
          const rawData = response.data.data;
          const config = Array.isArray(rawData) ? rawData[0] : rawData;
          if (config && config.markupType) {
            setMarkupType(normalizeMarkupType(config.markupType));
            const raw = String(config.markupType).toLowerCase();
            const isNetSell = raw.includes("netsell");
            if (isNetSell) {
              setIsNetSellRateEnabled(true);
              setIsMarkupEnabled(false);
              const rateVal = config.rate != null ? String(config.rate) : "0";
              setNetSellRate(rateVal);
              setAppliedMarkupConfig({
                isMarkupEnabled: false,
                markupDropdownOption: "Flat",
                numericMarkup: 0,
                numericMarkupRate: 0,
                isNetSellRateEnabled: true,
                numericNetSellRate: Number(rateVal) || 0,
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
              setAppliedMarkupConfig({
                isMarkupEnabled: true,
                markupDropdownOption: opt,
                numericMarkup: Number(minVal) || 0,
                numericMarkupRate: Number(rateVal) || 0,
                isNetSellRateEnabled: false,
                numericNetSellRate: 0,
              });
            }
          }
        }
      } catch (error) {
        console.error("[QuoteRateDetail] Error fetching GetClientMarkup:", error);
      }
    };

    fetchClientMarkup();
  }, [apiQuote?.clientCode]);

  const originCountry = apiQuote?.originCountry || "USA";
  const destCountry = apiQuote?.destinationCountry || "USA";

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
      return apiQuote.quoteResults.map((result, index) => {
        let grossCharge = Number(result.grossCharge) || 0;
        let grossSellAmount = (result as any).grossSellAmount != null
          ? Number((result as any).grossSellAmount)
          : (result as any).sellAmount != null
          ? Number((result as any).sellAmount)
          : undefined;
        let discount = Number(result.discount) || 0;
        let fuelSurcharge = Number(result.fuelSurcharge) || 0;
        const otherAccessorials: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[] = [];

        if (result.quoteCostDetails && Array.isArray(result.quoteCostDetails)) {
          result.quoteCostDetails.forEach((cd) => {
            const code = (cd.accCode || "").trim().toUpperCase();
            const name = (cd.accName || "").trim().toLowerCase();
            const amount = Number(cd.amount) || 0;

            if (
              code === COST_CODE_GROSS ||
              code === "FRT" ||
              code === "FREIGHT" ||
              code === "BASE" ||
              name === COST_NAME_GROSS.toLowerCase() ||
              name === "grosscharge" ||
              name.includes("freight") ||
              name.includes("gross")
            ) {
              grossCharge = amount;
              if (cd.sellAmount != null) {
                grossSellAmount = Number(cd.sellAmount);
              }
            } else if (
              code === COST_CODE_DISC ||
              code === "DSC" ||
              code === "DISCOUNT" ||
              name === COST_NAME_DISC.toLowerCase() ||
              name.includes("discount")
            ) {
              discount = Math.abs(amount);
            } else if (
              code === COST_CODE_FUEL ||
              code === "FSC" ||
              code === "FUEL SURCHARGE" ||
              name === COST_NAME_FUEL.toLowerCase() ||
              name === "fuelsurcharge" ||
              name.includes("fuel")
            ) {
              fuelSurcharge = amount;
            } else {
              otherAccessorials.push({
                code: cd.accCode || "ACC",
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
          transitDays: parseInt(result.transitDays || "0") || 0,
          estimatedDelivery: result.estimatedDeliveryDate || "",
          warning: result.errorMessage?.trim() || result.warning?.trim() || (calculatedPrice <= 0 ? "Rate unavailable or carrier error." : ""),
          quoteExpiry: apiQuote.requestedDate || "N/A",
          liabilityNew: "",
          liabilityUsed: "",
          grossCharge,
          grossSellAmount,
          discount,
          fuelSurcharge,
          accessorialCharges: otherAccessorials,
          quoteCostDetails: result.quoteCostDetails,
          rawQuoteResult: result,
        };
      });
    }
    return [];
  }, [apiQuote]);

  const visibleRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ratesWithMarkup = rates.map((rate) =>
      applyMarkupToRate(rate, appliedMarkupConfig)
    );
    const matches = ratesWithMarkup.filter((rate) =>
      [rate.name, rate.code, rate.service].some((value) =>
        (value || "").toLowerCase().includes(query),
      ),
    );

    return [...matches].sort((first, second) => {
      const p1 = first.sellPrice !== undefined ? first.sellPrice : first.price;
      const p2 = second.sellPrice !== undefined ? second.sellPrice : second.price;
      if (sortBy === "rate-desc") return p2 - p1;
      if (sortBy === "transit") {
        if (first.transitDays === second.transitDays) {
          return p1 - p2;
        }
        return first.transitDays - second.transitDays;
      }
      return p1 - p2;
    });
  }, [search, sortBy, rates, appliedMarkupConfig]);

  const validRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) > 0);
  }, [visibleRates]);

  const errorRates = useMemo(() => {
    return visibleRates.filter((rate) => (rate.price ?? 0) <= 0);
  }, [visibleRates]);

  const [activeTab, setActiveTab] = useState<"ltl" | "error">("ltl");
  const errorSectionRef = useRef<HTMLElement | null>(null);
  const validSectionRef = useRef<HTMLDivElement | null>(null);

  const totalValidCount = useMemo(() => {
    return rates.filter((rate) => (rate.price ?? 0) > 0).length;
  }, [rates]);

  const totalErrorCount = useMemo(() => {
    return rates.filter((rate) => (rate.price ?? 0) <= 0).length;
  }, [rates]);

  const displayValidCount = search.trim() ? validRates.length : totalValidCount;
  const displayErrorCount = search.trim() ? errorRates.length : totalErrorCount;

  const handleScrollToErrors = () => {
    setActiveTab("error");
    if (errorSectionRef.current) {
      errorSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      messageApi.info("No carriers with errors found for this quote.");
    }
  };

  const handleScrollToValid = () => {
    setActiveTab("ltl");
    if (validSectionRef.current) {
      validSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
            items: (apiQuote.quoteProducts || []).map((p, idx) => ({
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
          selectedAccessorials: (apiQuote.quoteAccessorials || []).map(
            (a) =>
              a.accCode ||
              a.description ||
              a.accessorialName ||
              a.accesorialCode ||
              "",
          ),
          selectedClientCode: apiQuote.clientCode || undefined,
        })
      );
    }
    navigate("/quotes");
  };

  const handleShipIt = (rate: CarrierRate) => {
    const quoteToSend = apiQuote ? { ...apiQuote } : undefined;
    if (quoteToSend?.quoteProducts) {
      const formItems = quoteFormData?.packages?.flatMap((p) => p.items || []) || [];
      quoteToSend.quoteProducts = quoteToSend.quoteProducts.map((p, idx) => {
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
        quote: quoteToSend
          ? {
              ...quoteToSend,
              clientCode: quoteToSend.clientCode || "Devts",
            }
          : undefined,
        selectedCarrier: {
          ...rate,
          price: rate.sellPrice !== undefined ? rate.sellPrice : rate.price,
          markupType: appliedMarkupConfig.isNetSellRateEnabled
            ? "netSellRate"
            : appliedMarkupConfig.markupDropdownOption,
          rate: appliedMarkupConfig.isNetSellRateEnabled
            ? String(appliedMarkupConfig.numericNetSellRate)
            : String(appliedMarkupConfig.numericMarkupRate),
          minimum: String(appliedMarkupConfig.numericMarkup),
          markup: rate.markupAmount ?? 0,
          grossSellAmount: rate.grossSell,
          ppsFreight: rate.ppsFreight,
          ppsFuel: rate.ppsFuel,
        },
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

  const totalWeight = (apiQuote?.quoteProducts || []).reduce(
    (acc, item) => acc + (Number(item.weight) || 0),
    0,
  );

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
        
          <Button
            danger
            onClick={() => messageApi.info("Quote deletion is not connected yet.")}>
            Delete Quote
          </Button>
        </div>
      </header>

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
            {(apiQuote?.quoteProducts || []).map((item, index) => {
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
                {apiQuote.quoteAccessorials.map((acc, idx) => {
                  const accCode = (
                    acc.accCode ||
                    acc.accesorialCode ||
                    acc.accessorialName ||
                    acc.description ||
                    ""
                  ).toString();
                  const match = accessorialsData.find(
                    (a) =>
                      a.accesorialCode === accCode ||
                      a.accessorialName === accCode,
                  );
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
              aria-selected={activeTab === "ltl"}
              className={activeTab === "ltl" ? "active" : ""}
              onClick={handleScrollToValid}>
              LTL <span>{displayValidCount}</span>
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={activeTab === "error"}
              className={`rate-tab-with-error ${activeTab === "error" ? "active" : ""}`}
              onClick={handleScrollToErrors}>
              With Error <span>{displayErrorCount}</span>
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
            <div className='rate-results-subbar'>
              <p className='rate-results-count'>
                {`Showing ${visibleRates.length} of ${rates.length} carriers`}
              </p>

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
                      }}
                      className="markup-checkbox"
                    >
                      Mark Up
                    </Checkbox>

                    {isMarkupEnabled && (
                      <>
                        <Select
                          value={markupDropdownOption}
                          onChange={(val) => {
                            setMarkupDropdownOption(val);
                          }}
                          style={{ minWidth: 230 }}
                          size="middle"
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
                          <span className="markup-unit-symbol">$</span>
                          <Input
                            value={markup}
                            className="input-sm-center"
                            disabled={markupDropdownOption === "Flat"}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              setMarkup(val);
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
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spin size="large" />
            </div>
          )}

          {!loading && (validRates.length > 0 || errorRates.length > 0) ? (
            <>
              {validRates.length > 0 ? (
                <div ref={validSectionRef} className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                  {validRates.map((rate) => (
                    <CarrierCard
                      key={rate.id}
                      rate={rate}
                      isCorporate={isCorporate}
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
                <section ref={errorSectionRef} className='rate-error-section' aria-label='Carriers with errors'>
                  <h2 className='rate-error-heading'>
                    <span>With Errors</span>
                    <span className='rate-error-badge'>{errorRates.length}</span>
                  </h2>
                  <div className={`rate-carrier-list rate-carrier-list--${viewMode}`}>
                    {errorRates.map((rate) => (
                      <CarrierCard
                        key={rate.id}
                        rate={rate}
                        isCorporate={isCorporate}
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
