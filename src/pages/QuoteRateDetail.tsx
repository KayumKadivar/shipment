
import { Button, Result, Spin } from "antd";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { fetchCarrierLogo } from "../store/customerRateSlice";
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
  onSelect,
}: {
  offer: CarrierOffer;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`quote-detail-offer-card${selected ? " is-selected" : ""}`}>
      <div className='quote-detail-offer-card__offer'>
        <div className='quote-detail-offer-card__logo'>
          <CarrierLogo offer={offer} />
        </div>
        <strong className='quote-detail-offer-card__price'>
          {offer.price.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </strong>
        <Button type={selected ? "primary" : "default"} onClick={onSelect}>
          {selected ? "Selected" : "Select Quote"}
        </Button>
      </div>

      <div className='quote-detail-offer-card__information'>
        <header className='quote-detail-offer-card__heading'>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <strong>{offer.name}</strong>
            <span className="rate-chip">{offer.code}</span>
            <span className="rate-chip">{offer.service}</span>
          </div>
        </header>

        <dl className='quote-detail-offer-card__details'>
          <div>
            <dt>Quote ID</dt>
            <dd>{offer.quoteId || "N/A"}</dd>
          </div>
          <div>
            <dt>Transit Days</dt>
            <dd>{offer.transitDays ? `${offer.transitDays} business days` : "N/A"}</dd>
          </div>
        </dl>

        {offer.accessorials.length ? (
          <div className='quote-detail-offer-card__accessorials'>
            <strong>Accessorials</strong>
            <div>
              {offer.accessorials.map((accessorial) => (
                <span key={accessorial}>{accessorial}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function QuoteRateDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  
  const { quotes: apiQuotes } = useAppSelector((state) => state.quote);

  const apiQuote = useMemo(() => {
    return apiQuotes.find((q) => String(q.quoteRequestId) === decodeURIComponent(reference ?? ""));
  }, [apiQuotes, reference]);

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
  }, [apiQuote, reference]);

  const dynamicCarrierOffers = useMemo(() => {
    if (apiQuote && apiQuote.quoteResults && apiQuote.quoteResults.length > 0) {
      return apiQuote.quoteResults.map((result: any) => {
        let logoKind: "fedex" | "abf" | "rl" = "abf";
        const scacLower = (result.scac || "").toLowerCase();
        if (scacLower.includes("fxf") || scacLower.includes("fedex")) {
          logoKind = "fedex";
        } else if (scacLower.includes("rl")) {
          logoKind = "rl";
        }

        return {
          id: String(result.quoteResultId || Math.random()),
          name: result.carrierName || "Unknown Carrier",
          code: result.scac || "",
          service: result.serviceLevel || "",
          logoKind,
          price: 0, 
          quoteId: result.saasQuoteId || result.carrierQuoteNo || "",
          transitDays: parseInt(result.transitDays) || 0,
          accessorials: [],
        } as CarrierOffer;
      });
    }
    
    /*
    return carrierOffers;
    */
    return [];
  }, [apiQuote]);

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

  return (
    <section className='quote-detail-page'>
      <QuoteInformation quote={quote} />
      <div className='quote-detail-offer-list' aria-label='Available carrier quotes'>
        {dynamicCarrierOffers.map((offer) => (
          <CarrierOfferCard
            key={offer.id}
            offer={offer}
            selected={selectedOfferId === offer.id}
            onSelect={() =>
              setSelectedOfferId((current) =>
                current === offer.id ? null : offer.id,
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

export default QuoteRateDetail;
