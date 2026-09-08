import {
  HomeOutlined,
  InfoCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Result } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import abfLogo from "../assets/image 55.png";
import rlLogo from "../assets/image 57.png";
import { quoteSummaryData, type QuoteSummaryRecord } from "./quoteSummaryData";

type CarrierLogoKind = "abf" | "rl" | "fedex";

type CarrierOffer = {
  id: string;
  name: string;
  code: string;
  service: string;
  logoKind: CarrierLogoKind;
  price: number;
  quoteId: string;
  quoteExpiry: string;
  transitDays: number;
  estimatedDelivery: string;
  liabilityNew: string;
  liabilityUsed: string;
  accessorials: string[];
};

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

function CarrierLogo({ offer }: { offer: CarrierOffer }) {
  if (offer.logoKind === "fedex") {
    return (
      <div className='quote-detail-fedex-logo' aria-label='FedEx Freight'>
        <span>Fed</span>
        <strong>Ex</strong>
      </div>
    );
  }

  return (
    <img
      src={offer.logoKind === "abf" ? abfLogo : rlLogo}
      alt={`${offer.name} logo`}
    />
  );
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
          <div>
            <strong>{offer.name}</strong>
            <span>{offer.code}</span>
            <span>{offer.service}</span>
          </div>
          <nav aria-label={`${offer.name} actions`}>
            <button type='button'>
              <SendOutlined /> Send
            </button>
            <button type='button'>
              <HomeOutlined /> Terminals
            </button>
            <button type='button'>
              <InfoCircleOutlined /> Info
            </button>
          </nav>
        </header>

        <dl className='quote-detail-offer-card__details'>
          <div>
            <dt>Quote ID</dt>
            <dd>{offer.quoteId}</dd>
          </div>
          <div>
            <dt>Quote Exp. Date</dt>
            <dd>{offer.quoteExpiry}</dd>
          </div>
          <div>
            <dt>Transit Days</dt>
            <dd>{offer.transitDays} business days</dd>
          </div>
          <div>
            <dt>Est. Delivery Date</dt>
            <dd>{offer.estimatedDelivery}</dd>
          </div>
          <div>
            <dt>Carrier Liability New</dt>
            <dd>{offer.liabilityNew}</dd>
          </div>
          <div>
            <dt>Carrier Liability Used</dt>
            <dd>{offer.liabilityUsed}</dd>
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
  const quote = quoteSummaryData.find(
    (item) => item.reference === decodeURIComponent(reference ?? ""),
  );

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
        {carrierOffers.map((offer) => (
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
