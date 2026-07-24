"use client";

// ( |╲ ) — Author: Klaasvaakie
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const nav = [
  ["/kasipay", "Home"],
  ["/kasipay/gini", "Gini"],
  ["/kasipay/merchant", "Merchant"],
  ["/kasipay/pricing", "Pricing"],
  ["/kasipay/faq", "FAQ"],
  ["/kasipay/about", "About"],
] as const;

export function KasiPayShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="kp-site">
      <header className="kp-header">
        <Link className="kp-brand" href="/kasipay" aria-label="KasiPay home">
          <Image src="/kasihub-logo.webp" alt="KasiPay" width={64} height={36} priority />
          <span><b>Kasi</b>Pay</span>
        </Link>
        <button className="kp-menu" type="button" aria-expanded={open} aria-controls="kp-nav" onClick={() => setOpen((value) => !value)}>
          <span />
          <span />
          <span />
          <span className="sr-only">Menu</span>
        </button>
        <nav id="kp-nav" className={open ? "kp-nav is-open" : "kp-nav"} aria-label="Primary navigation">
          {nav.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link className="kp-nav-cta" href="/kasipay/contact" onClick={() => setOpen(false)}>Get started</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="kp-footer">
        <div className="kp-footer-grid">
          <div>
            <Link className="kp-brand kp-brand-light" href="/kasipay">
              <Image src="/kasihub-logo.webp" alt="" width={64} height={36} />
              <span><b>Kasi</b>Pay</span>
            </Link>
            <p>Accessible payment and savings administration, powered through an authorised InstaPay custodian relationship.</p>
            <p className="kp-disclosure">KasiPay and InstaPay provide interfaces. Customer funds are held by licensed custodians or nominee institutions.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <Link href="/kasipay/gini">Gini app</Link>
            <Link href="/kasipay/merchant">Merchant services</Link>
            <Link href="/kasipay/pricing">Pricing</Link>
          </div>
          <div>
            <h3>Help</h3>
            <Link href="/kasipay/faq">FAQ</Link>
            <Link href="/kasipay/contact">Contact</Link>
            <a href="mailto:support@instapay.co.za">Platform support</a>
            <a href="https://wa.me/27763360938" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
          <div>
            <h3>Platform provenance</h3>
            <p>Public platform information and assets reproduced with permission from InstaPay.</p>
            <div className="kp-partners">
              <Image src="/kasipay-assets/images/amber-pay.svg" alt="Amber Pay" width={115} height={34} />
              <Image src="/kasipay-assets/images/omnea-logo.svg" alt="Omnea" width={110} height={34} />
            </div>
          </div>
        </div>
        <div className="kp-copyright">© 2026 KasiPay. Powered through the InstaPay ecosystem. ( |╲ ) — Klaasvaakie</div>
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
