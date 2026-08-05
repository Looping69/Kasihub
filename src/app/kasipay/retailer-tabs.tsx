"use client";

import Image from "next/image";
import { useState } from "react";

const categories = ["TakeAway/Restuarant", "Groceries", "Retail", "Pharmacy"] as const;

type Category = (typeof categories)[number];

const retailerLogos: Record<Category, { name: string; src: string; cashback?: string }[]> = {
  "TakeAway/Restuarant": [
    { name: "Burger King", src: "/retailers/takeout/burger-king.png", cashback: "1.25%" },
    { name: "Col'Cacchio", src: "/retailers/takeout/colcacchio.png", cashback: "1.00%" },
    { name: "Debonairs Pizza", src: "/retailers/takeout/debonairs.png", cashback: "0.70%" },
    { name: "Fishaways", src: "/retailers/takeout/fishaways.png", cashback: "0.70%" },
    { name: "Krispy Kreme", src: "/retailers/takeout/krispy-kreme.png", cashback: "1.00%" },
    { name: "Milky Lane", src: "/retailers/takeout/milky-lane.png", cashback: "0.70%" },
    { name: "Mr D", src: "/retailers/takeout/MrD.png", cashback: "1.25%" },
    { name: "Mugg & Bean", src: "/retailers/takeout/mugg-bean.png", cashback: "0.70%" },
    { name: "Nando's", src: "/retailers/takeout/nandos.png", cashback: "0.75%" },
    { name: "Spur", src: "/retailers/takeout/spur.png", cashback: "1.00%" },
    { name: "Starbucks", src: "/retailers/takeout/starbucks.png", cashback: "1.00%" },
    { name: "Steers", src: "/retailers/takeout/steers.png", cashback: "0.70%" },
    { name: "Wimpy", src: "/retailers/takeout/wimpy.png", cashback: "0.70%" },
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

export function RetailerTabs() {
  const [activeCategory, setActiveCategory] = useState<Category>("TakeAway/Restuarant");

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
                  <Image src={retailer.src} alt={retailer.name} width={144} height={144} />
                  {retailer.cashback && (
                    <span className="kp-cashback-badge" aria-label={`${retailer.cashback} Cashback`}>
                      <strong>{retailer.cashback}</strong>
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
    </section>
  );
}
