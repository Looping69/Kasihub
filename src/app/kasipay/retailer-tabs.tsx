"use client";

import Image from "next/image";
import { useState } from "react";

const categories = ["TakeAway/Restuarant", "Groceries", "Retail", "Pharmacy"] as const;

type Category = (typeof categories)[number];

type Retailer = {
  name: string;
  src: string;
  cashback?: string;
  mapsUrl?: string;
};

const retailerMapsUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} near me`)}`;

const formatCashback = (cashback: string) => {
  const percentage = Number.parseFloat(cashback);
  const hundredthsDigit = Math.round(percentage * 100) % 10;

  return `${percentage.toFixed(hundredthsDigit === 5 ? 2 : 1)}%`;
};

const formatZar = (value: number) => {
  const [whole, cents] = value.toFixed(2).split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `R ${groupedWhole},${cents}`;
};

const takeawayRetailer = (name: string, src: string, cashback: string): Retailer => ({
  name,
  src,
  cashback,
  mapsUrl: retailerMapsUrl(name),
});

const retailerLogos: Record<Category, Retailer[]> = {
  "TakeAway/Restuarant": [
    takeawayRetailer("Burger King", "/retailers/takeout/burger-king.png", "1.25%"),
    takeawayRetailer("Col'Cacchio", "/retailers/takeout/colcacchio.png", "1.00%"),
    takeawayRetailer("Debonairs Pizza", "/retailers/takeout/debonairs.png", "0.70%"),
    takeawayRetailer("Fishaways", "/retailers/takeout/fishaways.png", "0.70%"),
    takeawayRetailer("Krispy Kreme", "/retailers/takeout/krispy-kreme.png", "1.00%"),
    takeawayRetailer("Milky Lane", "/retailers/takeout/milky-lane.png", "0.70%"),
    takeawayRetailer("Mr D", "/retailers/takeout/MrD.png", "1.25%"),
    takeawayRetailer("Mugg & Bean", "/retailers/takeout/mugg-bean.png", "0.70%"),
    takeawayRetailer("Nando's", "/retailers/takeout/nandos.png", "0.75%"),
    takeawayRetailer("Spur", "/retailers/takeout/spur.png", "1.00%"),
    takeawayRetailer("Starbucks", "/retailers/takeout/starbucks.png", "1.00%"),
    takeawayRetailer("Steers", "/retailers/takeout/steers.png", "0.70%"),
    takeawayRetailer("Wimpy", "/retailers/takeout/wimpy.png", "0.70%"),
  ],
  Groceries: [
    { name: "Checkers", src: "/retailers/groceries/checkers.png", cashback: "0.2%" },
    { name: "Checkers Hyper", src: "/retailers/groceries/checker-hyper.png", cashback: "0.2%" },
    { name: "LiquorShop", src: "/retailers/groceries/liquor-shop.png", cashback: "0.2%" },
    { name: "Hungry Lion", src: "/retailers/groceries/hungry-lion.png", cashback: "0.80%" },
    { name: "Pick n Pay", src: "/retailers/groceries/pick-n-pay.png", cashback: "0.75%" },
    { name: "Shoprite", src: "/retailers/groceries/shoprite.png", cashback: "0.2%" },
    { name: "Shoprite Usave", src: "/retailers/groceries/usave.png", cashback: "0.2%" },
  ],
  Retail: [
    { name: "Cape Union Mart", src: "/retailers/retail/cape-union-mart.png", cashback: "0.75%" },
    { name: "Cellucity", src: "/retailers/retail/cellucity.png", cashback: "0.90%" },
    { name: "HiFi Corp", src: "/retailers/retail/hifi-corp.png", cashback: "0.75%" },
    { name: "Hirsch's", src: "/retailers/retail/hirchs.png", cashback: "0.80%" },
    { name: "Incredible Connection", src: "/retailers/retail/incredible-connection.png", cashback: "0.75%" },
    { name: "Keedo", src: "/retailers/retail/keedo.png", cashback: "0.75%" },
    { name: "Loot", src: "/retailers/retail/loot.png", cashback: "1.25%" },
    { name: "NetFlorist", src: "/retailers/retail/netflorist.png", cashback: "1.25%" },
    { name: "Old Khaki", src: "/retailers/retail/old-khaki.png", cashback: "0.75%" },
    { name: "Poetry", src: "/retailers/retail/poetry.jpg", cashback: "0.75%" },
    { name: "Tread+Miller", src: "/retailers/retail/treadmiller.png", cashback: "0.75%" },
  ],
  Pharmacy: [
    { name: "Medirite", src: "/retailers/pharmacy/medirite.png", cashback: "0.20%" },
  ],
};

const calculatorRetailers = categories.flatMap((category) =>
  retailerLogos[category].map((retailer) => ({
    ...retailer,
    category,
    rate: Number.parseFloat(retailer.cashback ?? "0"),
    value: `${category}::${retailer.name}`,
  })),
);

export function RetailerTabs() {
  const [activeCategory, setActiveCategory] = useState<Category>("TakeAway/Restuarant");
  const [selectedRetailerValue, setSelectedRetailerValue] = useState(calculatorRetailers[0].value);
  const [monthlySpend, setMonthlySpend] = useState("");
  const selectedRetailer = calculatorRetailers.find((retailer) => retailer.value === selectedRetailerValue) ?? calculatorRetailers[0];
  const validMonthlySpend = Math.max(0, Number.parseFloat(monthlySpend) || 0);
  const monthlySaving = validMonthlySpend * (selectedRetailer.rate / 100);
  const annualSaving = monthlySaving * 12;

  return (
    <section className="kp-retailer-tabs" aria-label="Participating retailer categories">
      <div className="kp-tab-list" role="tablist" aria-label="Retailer categories">
        {categories.map((category) => (
          <button
            aria-controls={`retailer-panel-${category.toLowerCase()}`}
            aria-selected={activeCategory === category}
            className={activeCategory === category ? "is-active" : ""}
            id={`retailer-tab-${category.toLowerCase()}`}
            key={category}
            onClick={() => setActiveCategory(category)}
            role="tab"
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      <p className="kp-maps-tip" role="note">
        <svg aria-hidden="true" className="kp-maps-tip-icon" viewBox="0 0 24 24">
          <path d="M12 1.75a7.25 7.25 0 0 0-7.25 7.25c0 5.44 6.42 12.54 6.7 12.84a.75.75 0 0 0 1.1 0c.28-.3 6.7-7.4 6.7-12.84A7.25 7.25 0 0 0 12 1.75Z" fill="#34a853" />
          <path d="M12 1.75A7.25 7.25 0 0 0 5.84 5.18l5.47 5.47 5.1-5.1A7.22 7.22 0 0 0 12 1.75Z" fill="#4285f4" />
          <path d="m5.84 5.18 5.47 5.47-3.5 3.5A10.98 10.98 0 0 1 4.75 9c0-1.4.4-2.7 1.09-3.82Z" fill="#fbbc04" />
          <path d="m16.41 5.55-5.1 5.1 4.39 4.39c1.82-2.54 3.55-5.52 3.55-6.04 0-1.3-.34-2.47-.84-3.45Z" fill="#ea4335" />
          <circle cx="12" cy="9" r="2.45" fill="#fff" />
        </svg>
        <span>Tap any store to open Google Maps and find the nearest location.</span>
      </p>

      {categories.map((category) => (
        <div
          aria-labelledby={`retailer-tab-${category.toLowerCase()}`}
          className="kp-tab-panel"
          hidden={activeCategory !== category}
          id={`retailer-panel-${category.toLowerCase()}`}
          key={category}
          role="tabpanel"
          tabIndex={0}
        >
          {retailerLogos[category].length > 0 ? (
            <div className="kp-retailer-logo-grid">
              {retailerLogos[category].map((retailer) => (
                <div className="kp-retailer-logo" key={retailer.name}>
                  <a
                    aria-label={`Find ${retailer.name} near me on Google Maps (opens in a new tab)`}
                    className="kp-retailer-map-link"
                    href={retailer.mapsUrl ?? retailerMapsUrl(retailer.name)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Image src={retailer.src} alt={retailer.name} width={144} height={144} />
                  </a>
                  {retailer.cashback && (
                    <span className="kp-cashback-badge" aria-label={`${formatCashback(retailer.cashback)} Cashback`}>
                      <strong>{formatCashback(retailer.cashback)}</strong>
                      <span>Cashback</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>{category} retailer logos will appear here.</p>
          )}
        </div>
      ))}

      <section className="kp-savings-calculator" aria-labelledby="kp-savings-calculator-title">
        <div className="kp-savings-calculator-copy">
          <span className="kp-calculator-kicker">Cashback calculator</span>
          <h2 id="kp-savings-calculator-title">See what your spending could put back in your pocket.</h2>
          <p>Choose a participating retailer and enter your estimated monthly spend. We&apos;ll calculate the potential monthly and annual cashback using the displayed retailer rate.</p>
        </div>

        <div className="kp-calculator-card">
          <div className="kp-calculator-fields">
            <label>
              <span>Retailer and cashback rate</span>
              <select value={selectedRetailerValue} onChange={(event) => setSelectedRetailerValue(event.target.value)}>
                {categories.map((category) => (
                  <optgroup key={category} label={category}>
                    {calculatorRetailers.filter((retailer) => retailer.category === category).map((retailer) => (
                      <option key={retailer.value} value={retailer.value}>
                        {retailer.name} — {formatCashback(retailer.cashback ?? "0%")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label>
              <span>Estimated monthly spend</span>
              <div className="kp-currency-input">
                <span aria-hidden="true">R</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setMonthlySpend(event.target.value)}
                  placeholder="2 500"
                  step="100"
                  type="number"
                  value={monthlySpend}
                />
              </div>
            </label>
          </div>

          <div className="kp-calculator-result" aria-live="polite">
            <div className="kp-calculator-retailer">
              <Image src={selectedRetailer.src} alt="" width={76} height={76} />
              <div>
                <span>{selectedRetailer.category}</span>
                <strong>{selectedRetailer.name}</strong>
                <small>{formatCashback(selectedRetailer.cashback ?? "0%")} cashback</small>
              </div>
            </div>
            <div className="kp-saving-figures">
              <div><span>Estimated monthly saving</span><strong>{formatZar(monthlySaving)}</strong></div>
              <div><span>Estimated annual saving</span><strong>{formatZar(annualSaving)}</strong></div>
            </div>
            <p className="kp-calculator-note">Estimate only. Actual cashback depends on qualifying purchases, retailer terms and the live offer available when you transact.</p>
          </div>
        </div>
      </section>
    </section>
  );
}
