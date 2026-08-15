"use client";

// ( |╲ ) — Author: Klaasvaakie
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const nav = [
  ["/", "KaSiHub"],
  ["/kasipay", "Home"],
  ["/kasipay", "KaSiPaY-OnE"],
  ["/kasipay/merchant", "KaSiPayBiz"],
  ["/kasipay/pricing", "Pricing"],
  ["/kasipay/faq", "FAQ"],
  ["/kasipay/about", "About"],
] as const;

export function KasiPayShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="kp-site">
      <style>{`
        .kp-site {
          --orange: #ff6202;
          --ink: #263470;
          --deep: #263470;
          --muted: #263470;
          font-family: var(--font-kasipay-inter), Inter, sans-serif;
          font-size: 20px;
          color: #263470;
        }
        .kp-site p,
        .kp-site li {
          font-size: 20px !important;
        }
        .kp-site h1,
        .kp-site h2 {
          font-family: var(--font-kasipay-inter), Inter, sans-serif;
          font-weight: 700 !important;
        }
        .kp-site h2 {
          color: #ff6202 !important;
          font-size: 30px !important;
        }
        .kp-site .kp-btn,
        .kp-site .kp-nav-cta {
          background: #ff6202;
        }
        .kp-site button:hover,
        .kp-site a.kp-btn:hover,
        .kp-site a.kp-nav-cta:hover {
          color: #000000 !important;
        }
        .kp-page-hero h2 {
          max-width: 650px;
          margin: 0;
          color: var(--orange);
          font-size: clamp(22px, 2.4vw, 34px);
          font-weight: 600;
          line-height: 1.35;
        }
        .kp-page-hero h1 {
          font-size: 50px !important;
          line-height: 1.5 !important;
        }
        .kp-page-hero-logo {
          display: block;
          width: auto;
          height: 65px;
          margin: -6px auto 18px;
          object-fit: contain;
          object-position: left center;
        }
        .kp-page-hero-image.kp-page-hero-image-unframed {
          width: 650px;
          max-width: 100%;
          background: transparent;
          border-radius: 0;
          overflow: visible;
          justify-self: center;
        }
        .kp-page-hero-image.kp-page-hero-image-unframed img {
          width: 650px;
          max-width: 100%;
          height: auto;
        }
        .kp-hero-details {
          max-width: 650px;
          margin-top: 24px;
        }
        .kp-hero-details p {
          margin: 0 0 14px;
          color: #263470;
          font-size: 15px;
          line-height: 1.65;
        }
        .kp-feature-showcase {
          display: block;
        }
        .kp-footer {
          background: linear-gradient(to right, #0f172a, #172554, #263470) !important;
        }
        .kp-feature-showcase .kp-feature-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .kp-feature-heading {
          max-width: 900px;
          margin: 0 auto 36px;
          color: var(--deep);
          font-size: clamp(36px, 4vw, 58px);
          line-height: 1.08;
          letter-spacing: -2px;
          text-align: center;
        }
        .kp-feature-video {
          width: 100%;
          aspect-ratio: 16 / 9;
          margin-bottom: 32px;
          overflow: hidden;
          border-radius: 24px;
          background: #000000;
          box-shadow: 0 16px 40px rgba(24, 31, 74, 0.12);
        }
        .kp-feature-video video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .kp-retailer-tabs {
          padding: 0 clamp(24px, 7vw, 110px) 72px;
          background: var(--paper);
        }
        .kp-tab-list {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
          max-width: 1120px;
          margin: 0 auto 24px;
        }
        .kp-tab-list button {
          min-height: 52px;
          border: 1px solid #d7d2e2;
          border-radius: 5px;
          background: #ffffff;
          color: var(--deep);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
        }
        .kp-tab-list button:hover,
        .kp-tab-list button.is-active {
          border-color: #ff6202;
          background: #ff6202;
          color: #ffffff;
        }
        .kp-tab-list button:focus-visible {
          outline: 3px solid rgba(242, 139, 53, 0.35);
          outline-offset: 2px;
        }
        .kp-maps-tip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: fit-content;
          max-width: 1120px;
          margin: -6px auto 18px;
          padding: 10px 16px;
          border: 1px solid #d7dff4;
          border-radius: 5px;
          background: #f7f9ff;
          color: #35405f;
          font-size: 0.9rem;
          font-weight: 600;
          line-height: 1.4;
          text-align: center;
        }
        .kp-maps-tip-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
        }
        .kp-tab-panel {
          min-height: 180px;
          max-width: 1120px;
          margin: 0 auto;
          padding: 32px;
          border: 1px dashed #c8c1d8;
          border-radius: 5px;
          background: #263470;
          display: grid;
          place-items: center;
          text-align: center;
        }
        .kp-tab-panel > p {
          color: #ffffff;
        }
        .kp-tab-panel[hidden] {
          display: none;
        }
        .kp-retailer-logo-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 30px;
          width: 100%;
        }
        .kp-retailer-logo {
          position: relative;
          display: grid;
          place-items: center;
          min-width: 0;
          padding: 10px;
        }
        .kp-retailer-map-link {
          display: grid;
          width: 100%;
          place-items: center;
          border-radius: 50%;
        }
        .kp-retailer-map-link:focus-visible {
          outline: 3px solid #ff5a00;
          outline-offset: 4px;
        }
        .kp-retailer-logo img {
          width: 100%;
          max-width: 132px;
          aspect-ratio: 1;
          height: auto;
          object-fit: contain;
          border-radius: 50%;
          background: #ffffff;
          padding: 5px;
          box-shadow:
            inset 0 4px 8px rgba(16, 26, 72, 0.22),
            inset 0 -3px 5px rgba(255, 255, 255, 0.9),
            0 8px 16px rgba(8, 14, 47, 0.28);
        }
        .kp-cashback-badge {
          position: absolute;
          top: -8px;
          right: -4px;
          z-index: 1;
          display: flex;
          width: 54px;
          height: 54px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid #70b900;
          background: linear-gradient(145deg, #a4ef2f 0%, #85D608 52%, #6fbc00 100%) !important;
          color: #000000;
          font-size: 8px;
          font-weight: 800;
          line-height: 1.05;
          text-align: center;
          box-shadow:
            inset 0 2px 2px rgba(255, 255, 255, 0.72),
            inset 0 -3px 4px rgba(62, 112, 0, 0.42),
            0 6px 12px rgba(48, 86, 0, 0.36);
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
        }
        .kp-cashback-badge strong,
        .kp-cashback-badge span {
          position: relative;
          z-index: 1;
          display: block;
        }
        .kp-cashback-badge strong {
          font-size: 11px;
        }
        .kp-savings-calculator {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(560px, 1.2fr);
          gap: 56px;
          max-width: 1120px;
          margin: 72px auto 0;
          padding: 48px;
          border-radius: 5px;
          background: #263470;
          color: #ffffff;
          box-shadow: 0 24px 60px rgba(25, 37, 89, 0.18);
        }
        .kp-calculator-kicker {
          display: block;
          margin-bottom: 14px;
          color: #85d608;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .kp-savings-calculator h2 {
          margin: 0 0 18px;
          color: #ff6202 !important;
          font-size: clamp(30px, 3vw, 42px) !important;
          line-height: 1.08;
        }
        .kp-savings-calculator-copy p {
          margin: 0;
          color: #dfe4f7;
          font-size: 16px !important;
          line-height: 1.7;
        }
        .kp-calculator-card {
          padding: 28px;
          border-radius: 5px;
          background: #ffffff;
          color: #263470;
        }
        .kp-calculator-fields {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 16px;
        }
        .kp-calculator-fields label > span {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 800;
        }
        .kp-calculator-fields select,
        .kp-currency-input {
          width: 100%;
          min-height: 54px;
          border: 1px solid #cdd3e5;
          border-radius: 5px;
          background: #f7f8fc;
          color: #263470;
          font: inherit;
        }
        .kp-calculator-fields select {
          padding: 0 42px 0 14px;
          cursor: pointer;
        }
        .kp-currency-input {
          display: flex;
          align-items: center;
          padding-left: 15px;
          font-weight: 900;
        }
        .kp-currency-input input {
          width: 100%;
          min-width: 0;
          height: 52px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #263470;
          font: inherit;
          padding: 0 14px 0 7px;
        }
        .kp-calculator-fields select:focus-visible,
        .kp-currency-input:focus-within {
          border-color: #ff6202;
          outline: 3px solid rgba(255, 98, 2, 0.18);
          outline-offset: 2px;
        }
        .kp-calculator-result {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e2e5ef;
        }
        .kp-calculator-retailer {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .kp-calculator-retailer img {
          width: 76px;
          height: 76px;
          padding: 4px;
          border-radius: 50%;
          object-fit: contain;
          box-shadow: inset 0 2px 7px rgba(38, 52, 112, 0.16), 0 8px 18px rgba(38, 52, 112, 0.12);
        }
        .kp-calculator-retailer span,
        .kp-calculator-retailer small {
          display: block;
          color: #66708f;
          font-size: 12px;
        }
        .kp-calculator-retailer strong {
          display: block;
          margin: 2px 0;
          font-size: 20px;
        }
        .kp-calculator-retailer small {
          color: #4f8200;
          font-weight: 900;
        }
        .kp-saving-figures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 22px;
        }
        .kp-saving-figures div {
          padding: 18px;
          border-radius: 5px;
          background: #f1f5e9;
        }
        .kp-saving-figures span {
          display: block;
          color: #59627f;
          font-size: 12px;
          font-weight: 700;
        }
        .kp-saving-figures strong {
          display: block;
          margin-top: 7px;
          color: #263470;
          font-size: 26px;
          line-height: 1;
        }
        .kp-calculator-note {
          margin: 18px 0 0;
          color: #707894 !important;
          font-size: 11px !important;
          line-height: 1.5;
        }
        @media (max-width: 900px) {
          .kp-feature-showcase .kp-feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kp-retailer-logo-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .kp-savings-calculator {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 620px) {
          .kp-feature-showcase .kp-feature-grid {
            grid-template-columns: 1fr;
          }
          .kp-tab-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kp-retailer-logo-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kp-savings-calculator {
            gap: 28px;
            margin-top: 52px;
            padding: 28px 20px;
          }
          .kp-calculator-card {
            padding: 20px;
          }
          .kp-calculator-fields,
          .kp-saving-figures {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <header className="kp-header">
        <Link className="kp-brand" href="/kasipay" aria-label="KaSiPay home">
          <Image src="/kasipay-logo-20260808.png" alt="KaSiPay" width={463} height={150} priority />
        </Link>
        <button className="kp-menu" type="button" aria-expanded={open} aria-controls="kp-nav" onClick={() => setOpen((value) => !value)}>
          <span />
          <span />
          <span />
          <span className="sr-only">Menu</span>
        </button>
        <nav id="kp-nav" className={open ? "kp-nav is-open" : "kp-nav"} aria-label="Primary navigation">
          {nav.map(([href, label]) => <Link key={label} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link className="kp-nav-cta" href="/kasipay/contact" onClick={() => setOpen(false)}>Get started</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="kp-footer">
        <div className="kp-footer-grid">
          <div>
            <Link className="kp-brand kp-brand-light" href="/kasipay">
              <Image src="/kasipay-logo-20260808.png" alt="KaSiPay" width={463} height={150} />
            </Link>
            <p>Accessible payment and savings administration through the authorised KaSiPay platform.</p>
            <p className="kp-disclosure">KaSiPay provides the interface. Customer funds are held by licensed custodians or nominee institutions.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <Link href="/kasipay">KaSiPaY-OnE</Link>
            <Link href="/kasipay/merchant">Merchant services</Link>
            <Link href="/kasipay/pricing">Pricing</Link>
            <Link href="/kasipay/developer">Developer guide</Link>
          </div>
          <div>
            <h3>Help</h3>
            <Link href="/kasipay/faq">FAQ</Link>
            <Link href="/kasipay/contact">Contact</Link>
            <a href="mailto:support@kasihub.co.za">KaSiPay support</a>
            <a href="https://wa.me/27763360938" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
          <div>
            <h3>Platform provenance</h3>
            <p>Public platform information and assets presented as the approved KaSiPay experience.</p>
            <div className="kp-partners">
              <Image src="/kasipay-assets/images/amber-pay.svg" alt="Amber Pay" width={115} height={34} />
              <Image src="/kasipay-assets/images/omnea-logo.svg" alt="Omnea" width={110} height={34} />
            </div>
          </div>
        </div>
        <div className="kp-copyright">© 2026 KaSiPay. Part of the KaSiHub ecosystem. ( |╲ ) — Klaasvaakie</div>
      </footer>
    </div>
  );
}

export function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={open ? "kp-faq is-open" : "kp-faq"}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{question}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <p>{answer}</p>}
    </article>
  );
}
