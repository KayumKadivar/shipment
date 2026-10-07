import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Button, Empty, Result, Spin } from "antd";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import {
  fetchCarrierLogo,
  COST_CODE_GROSS,
  COST_CODE_DISC,
  COST_CODE_FUEL,
  COST_NAME_GROSS,
  COST_NAME_DISC,
  COST_NAME_FUEL,
} from "../store/customerRateSlice";
import { fetchQuoteById } from "../store/quoteSlice";
import { type QuoteSummaryRecord } from "./quoteSummaryData";

type CarrierLogoKind = "abf" | "rl" | "fedex";

type CarrierOffer = {
  id: string;
  name: string;
  code: string;
  service: string;
  logoKind: CarrierLogoKind;
  price: number;
  quoteId: string;
  transitDays: number;
  accessorials: string[];
  warning?: string;
  quoteExpiry?: string;
  estimatedDelivery?: string;
  grossCharge?: number;
  discount?: number;
  fuelSurcharge?: number;
  accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number }[];
};

/*
const carrierOffers: CarrierOffer[] = [
  {
    id: "fedex-economy",
    name: "FedEx Freight",
    code: "FXNL",
    service: "Economy",
    logoKind: "fedex",
    price: 2098.6,
    quoteId: "1552153518",
    quoteExpiry: "8/26/2026",
    transitDays: 3,
    estimatedDelivery: "8/28/2026",
    liabilityNew: "$42,100.00",
    liabilityUsed: "$842.00",
    accessorials: ["Excessive Length, 8ft: Accepted"],
  },
  {
    id: "abf-standard",
    name: "ABF Freight",
    code: "ABFS",
    service: "Standard Rate",
    logoKind: "abf",
    price: 2174.28,
    quoteId: "ABF820614",
    quoteExpiry: "8/27/2026",
    transitDays: 5,
    estimatedDelivery: "8/31/2026",
    liabilityNew: "$21,050.00",
    liabilityUsed: "$421.00",
    accessorials: ["Liftgate Delivery"],
  },
  {
    id: "rl-standard",
    name: "R+L Carriers",
    code: "RLCA",
    service: "Standard Rate",
    logoKind: "rl",
    price: 2248.95,
    quoteId: "RL4586201",
    quoteExpiry: "8/27/2026",
    transitDays: 4,
    estimatedDelivery: "8/29/2026",
    liabilityNew: "$25,000.00",
    liabilityUsed: "$500.00",
    accessorials: ["Call Before Delivery"],
  },
  {
    id: "fedex-priority",
    name: "FedEx Freight",
    code: "FXFE",
    service: "Priority",
    logoKind: "fedex",
    price: 2303.02,
    quoteId: "1552153774",
    quoteExpiry: "8/27/2026",
    transitDays: 2,
    estimatedDelivery: "8/27/2026",
    liabilityNew: "$42,100.00",
    liabilityUsed: "$842.00",
    accessorials: [],
  },
  {
    id: "abf-volume",
    name: "ABF Freight",
    code: "ABFS",
    service: "Volume LTL",
    logoKind: "abf",
    price: 2389.41,
    quoteId: "ABF820658",
    quoteExpiry: "8/28/2026",
    transitDays: 4,
    estimatedDelivery: "8/30/2026",
    liabilityNew: "$18,500.00",
    liabilityUsed: "$370.00",
    accessorials: ["Limited Access Delivery"],
  },
  {
    id: "rl-priority",
    name: "R+L Carriers",
    code: "RLCA",
    service: "Priority Service",
    logoKind: "rl",
    price: 2455.77,
    quoteId: "RL4586255",
    quoteExpiry: "8/28/2026",
    transitDays: 3,
    estimatedDelivery: "8/28/2026",
    liabilityNew: "$25,000.00",
    liabilityUsed: "$500.00",
    accessorials: ["Delivery Appointment", "Liftgate Delivery"],
  },
  {
    id: "fedex-direct",
    name: "FedEx Freight",
    code: "FXNL",
    service: "Direct",
    logoKind: "fedex",
    price: 2512.36,
    quoteId: "1552153920",
    quoteExpiry: "8/29/2026",
    transitDays: 3,
    estimatedDelivery: "8/28/2026",
    liabilityNew: "$40,000.00",
    liabilityUsed: "$800.00",
    accessorials: ["Residential Delivery"],
  },
  {
    id: "abf-guaranteed",
    name: "ABF Freight",
    code: "ABFS",
    service: "Guaranteed",
    logoKind: "abf",
    price: 2638.14,
    quoteId: "ABF820699",
    quoteExpiry: "8/29/2026",
    transitDays: 3,
    estimatedDelivery: "8/28/2026",
    liabilityNew: "$21,050.00",
    liabilityUsed: "$421.00",
    accessorials: ["Guaranteed By 5PM"],
  },
  {
    id: "rl-guaranteed",
    name: "R+L Carriers",
    code: "RLCA",
    service: "Guaranteed AM",
    logoKind: "rl",
    price: 2719.88,
    quoteId: "RL4586314",
    quoteExpiry: "8/30/2026",
    transitDays: 2,
    estimatedDelivery: "8/27/2026",
    liabilityNew: "$25,000.00",
    liabilityUsed: "$500.00",
    accessorials: ["Guaranteed Delivery"],
  },
  {
    id: "fedex-premium",
    name: "FedEx Freight",
    code: "FXFE",
    service: "Premium",
    logoKind: "fedex",
    price: 2846.5,
    quoteId: "1552154108",
    quoteExpiry: "8/30/2026",
    transitDays: 2,
    estimatedDelivery: "8/27/2026",
    liabilityNew: "$42,100.00",
    liabilityUsed: "$842.00",
    accessorials: ["Inside Delivery", "Call Before Delivery"],
  },
];
*/

function CarrierLogo({ offer }: { offer: CarrierOffer }) {
  const dispatch = useAppDispatch();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (offer.code) {
      setLoading(true);
      dispatch(fetchCarrierLogo(offer.code))
        .unwrap()
        .then((res: any) => {
          setLogoUrl(res.logo);
          setLoading(false);
        })
        .catch(() => {
          setLogoUrl(null);
          setLoading(false);
        });
    }
  }, [offer.code, dispatch]);

  if (loading) {
    return <Spin size="small" />;
  }

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${offer.name} logo`}
      />
    );
  }

  return <strong>{offer.name}</strong>;
}

function QuoteInformation({ quote }: { quote: QuoteSummaryRecord }) {
  const freightClasses = Array.from(
    new Set(quote.loads.map((load) => load.freightClass)),
  ).join(", ");

  const groups = [
    [
      ["Profile", quote.profile],
      ["Class", freightClasses],
    ],
    [
      ["Origin", `${quote.originPostal}, ${quote.origin}`],
      ["Weight", quote.totalWeight],
    ],
    [
      ["Destination", `${quote.destinationPostal}, ${quote.destination}`],
      ["Pallets", String(quote.pallets)],
    ],
    [
      ["Pickup Date", quote.pickupDate],
      ["Pieces", String(quote.pieces)],
    ],
  ];

  return (
    <section className='quote-detail-summary' aria-label='Quote information'>
      {groups.map((group, groupIndex) => (
        <dl className='quote-detail-summary__group' key={groupIndex}>
          {group.map(([label, value]) => (
            <div key={label}>
              <dt>{label}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </section>
  );
}


function CarrierOfferCard({
  offer,
  selected,
  onShipIt,
}: {
  offer: CarrierOffer;
  selected: boolean;
  onShipIt: () => void;
}) {
  return (
    <article className={`rate-card ${selected ? "rate-card--selected" : ""}`}>
      {offer.warning && (
        <div className='rate-card__warning'>
          <ExclamationCircleOutlined />
          <span>{offer.warning}</span>
        </div>
      )}

      <div className='rate-card__body'>
        <div className='rate-card__offer'>
          <div className='rate-card__logo'>
            <CarrierLogo offer={offer} />
          </div>
          <strong className='rate-card__price'>
            {offer.price.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </strong>
          <Button
            type={selected ? "primary" : "default"}
            className='rate-card__select'
            onClick={onShipIt}>
            {selected ? "Selected" : "Ship It"}
          </Button>
        </div>

        <div className='rate-card__information'>
          <div className='rate-card__heading'>
            <div className='rate-card__identity'>
              <strong>{offer.name}</strong>
              <span className='rate-chip'>{offer.code}</span>
              <span
                className={`rate-chip ${
                  offer.service === "ECONOMY" ? "rate-chip--blue" : ""
                }`}>
                {offer.service}
              </span>
            </div>
          </div>

          <dl className='rate-card__details'>
            <div className='rate-detail-expiry'>
              <dt>Quote Exp. Date</dt>
              <dd>{offer.quoteExpiry || "N/A"}</dd>
              <dt>Transit Days</dt>
              <dd>{offer.transitDays ? `${offer.transitDays} business days` : "N/A"}</dd>
              <dt>Est. Delivery Date</dt>
              <dd>{offer.estimatedDelivery || "N/A"}</dd>
            </div>
            <div className='rate-detail-charges'>
              <dt>Gross Charge : {offer.grossCharge || 0}</dt>
              <dt>Discount : {offer.discount || 0}</dt>
              <dt>Fuel Surcharge : {offer.fuelSurcharge || 0}</dt>
            </div>
            <div className='rate-detail-accessorials'>
              {offer.accessorialCharges?.map((charge, idx) => (
                <dt key={idx}>{charge.accessorialDescription} : {charge.accessorialCharge}</dt>
              ))}
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}


function QuoteRateDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  
  const dispatch = useAppDispatch();
  const { currentQuote, loading } = useAppSelector((state) => state.quote);
  const quoteFormData = useAppSelector((state) => state.customerRate.quoteFormData);

  useEffect(() => {
    if (reference) {
      dispatch(fetchQuoteById(reference));
    }
  }, [dispatch, reference]);

  const apiQuote = useMemo(() => {
    return currentQuote;
  }, [currentQuote]);

  const quote = useMemo(() => {
    /*
    const hardcoded = quoteSummaryData.find(
      (item) => item.reference === decodeURIComponent(reference ?? "")
    );
    if (hardcoded) return hardcoded;
    */

    if (!apiQuote) return undefined;

    const result = apiQuote.quoteResults?.[0] || {};
    const date = apiQuote.requestedDate ? new Date(apiQuote.requestedDate) : new Date();

    return {
      key: `quote-${apiQuote.quoteRequestId}`,
      customer: apiQuote.clientName || "",
      customerCode: apiQuote.clientCode || "",
      createdAgo: "Created recently on",
      createdDate: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
      reference: String(apiQuote.quoteRequestId),
      pickupDate: apiQuote.pickupDate ? new Date(apiQuote.pickupDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "",
      pickupTimestamp: apiQuote.pickupDate ? new Date(apiQuote.pickupDate).getTime() : 0,
      origin: `${apiQuote.originCity || ""}, ${apiQuote.originStateCode || ""}`,
      originPostal: apiQuote.originZip || "",
      destination: `${apiQuote.destinationCity || ""}, ${apiQuote.destinationStateCode || ""}`,
      destinationPostal: apiQuote.destinationZip || "",
      loads: (apiQuote.quoteProducts || []).map((p: any) => ({
        freightClass: p.productClass || "",
        weight: `${p.weight || 0} lbs`,
      })),
      carrierCode: result.scac || "",
      carrierName: result.carrierName || "",
      createdBy: apiQuote.profileCode || "",
      profile: apiQuote.profileCode || "",
      totalWeight: `${(apiQuote.quoteProducts || []).reduce((acc: number, p: any) => acc + (p.weight || 0), 0)} lbs`,
      pallets: (apiQuote.quoteProducts || []).reduce((acc: number, p: any) => acc + (p.pallets || 0), 0),
      pieces: 0,
    } as QuoteSummaryRecord;
  }, [apiQuote]);

  const dynamicCarrierOffers = useMemo(() => {
    if (apiQuote && apiQuote.quoteResults && apiQuote.quoteResults.length > 0) {
      return apiQuote.quoteResults.map((result: any, index: number) => {
        let logoKind: "fedex" | "abf" | "rl" = "abf";
        const scacLower = (result.scac || "").toLowerCase();
        if (scacLower.includes("fxf") || scacLower.includes("fedex")) {
          logoKind = "fedex";
        } else if (scacLower.includes("rl")) {
          logoKind = "rl";
        }

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
          id: String(result.quoteResultId || `quote-${index}`),
          name: result.carrierName || "Unknown Carrier",
          code: result.scac || "",
          service: result.serviceLevel || "",
          logoKind,
          price: calculatedPrice > 0 ? calculatedPrice : 0, 
          quoteId: result.saasQuoteId || result.carrierQuoteNo || "",
          transitDays: parseInt(result.transitDays) || 0,
          accessorials: [],
          warning: result.errorMessage?.trim() || result.warning?.trim() || (calculatedPrice <= 0 ? "Rate unavailable or carrier error." : ""),
          quoteExpiry: apiQuote.requestedDate || "N/A",
          estimatedDelivery: result.estimatedDeliveryDate || "0001-01-01T00:00:00",
          grossCharge,
          discount,
          fuelSurcharge,
          accessorialCharges: otherAccessorials,
        } as CarrierOffer;
      });
    }
    
    return [];
  }, [apiQuote]);

  const validOffers = useMemo(() => {
    return dynamicCarrierOffers.filter((offer) => (offer.price ?? 0) > 0);
  }, [dynamicCarrierOffers]);

  const errorOffers = useMemo(() => {
    return dynamicCarrierOffers.filter((offer) => (offer.price ?? 0) <= 0);
  }, [dynamicCarrierOffers]);

  if (loading) {
    return (
      <section className='quote-detail-not-found' style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large"/>
      </section>
    );
  }

  if (!quote) {
    return (
      <section className='quote-detail-not-found'>
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

  const handleShipIt = (offer: CarrierOffer) => {
    setSelectedOfferId(offer.id);
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
        selectedCarrier: offer,
        reference,
      },
    });
  };

  return (
    <section className='quote-detail-page'>
      <QuoteInformation quote={quote} />

      {validOffers.length > 0 ? (
        <div className='rate-carrier-list rate-carrier-list--list' aria-label='Available carrier quotes'>
          {validOffers.map((offer) => (
            <CarrierOfferCard
              key={offer.id}
              offer={offer}
              selected={selectedOfferId === offer.id}
              onShipIt={() => handleShipIt(offer)}
            />
          ))}
        </div>
      ) : null}

      {errorOffers.length > 0 ? (
        <section className='rate-error-section' aria-label='Carrier quotes with errors'>
          <h2 className='rate-error-heading'>
            <span>With Errors</span>
            <span className='rate-error-badge'>{errorOffers.length}</span>
          </h2>
          <div className='rate-carrier-list rate-carrier-list--list' aria-label='Carrier quotes with errors list'>
            {errorOffers.map((offer) => (
              <CarrierOfferCard
                key={offer.id}
                offer={offer}
                selected={selectedOfferId === offer.id}
                onShipIt={() => handleShipIt(offer)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {validOffers.length === 0 && errorOffers.length === 0 ? (
        <div className='rate-empty-state'>
          <Empty description='No carrier quotes available for this reference.' />
        </div>
      ) : null}
    </section>
  );
}

export default QuoteRateDetail;
