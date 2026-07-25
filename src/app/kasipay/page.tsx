// ( |╲ ) — Author: Klaasvaakie
import Image from "next/image";
import Link from "next/link";

const steps = [
  ["01", "Choose your path", "Use Gini for everyday money tools or Merchant for business payments."],
  ["02", "Create an account", "Complete the relevant digital onboarding and verification process."],
  ["03", "Configure services", "Set quick actions, payment methods and the services available to your profile."],
  ["04", "Start transacting", "Make or receive supported payments once your account is approved and active."],
];

export default function KasiPayHome() {
  return (
    <>
      <section className="kp-hero">
        <div className="kp-hero-copy">
          <span className="kp-eyebrow">Part of the KaSiHub ecosystem</span>
          <h1>Your money. Your business. <em>Simplified.</em></h1>
          <h2>With or without a bank.</h2>
          <p>From paying and saving to accepting and growing, KaSiPay brings consumer and merchant tools together to move money, build trust and unlock opportunity.</p>
          <div className="kp-actions">
            <Link className="kp-btn kp-btn-primary" href="/kasipay/gini">Explore Gini</Link>
            <Link className="kp-btn kp-btn-ghost" href="/kasipay/merchant">For merchants</Link>
          </div>
          <p className="kp-micro">Customer funds remain with the appointed licensed custodian or nominee institution.</p>
        </div>
        <div className="kp-hero-visual">
          <Image className="kp-phone kp-phone-left" src="/kasipay-assets/images/customer-app-landing-new.png" alt="Gini consumer app" width={316} height={736} priority />
          <Image className="kp-phone kp-phone-right" src="/kasipay-assets/images/merchant_app_landing-new.png" alt="KaSiPay merchant app" width={342} height={750} priority />
        </div>
      </section>

      <section className="kp-split kp-section">
        <div className="kp-media-card kp-lilac">
          <Image src="/kasipay-assets/images/customer-analytics-insights.png" alt="Consumer payment analytics" width={710} height={460} />
        </div>
        <div className="kp-section-copy">
          <span className="kp-eyebrow">For everyday money</span>
          <h2>Pay. Send. Save. Earn.</h2>
          <p>Use Gini to pay at supported stores, send money, earn eligible cashback, top up essentials and manage contributions and disbursements from one clear interface.</p>
          <Link className="kp-text-link" href="/kasipay/gini">Discover Gini <span>→</span></Link>
        </div>
      </section>

      <section className="kp-split kp-split-reverse kp-section">
        <div className="kp-section-copy">
          <span className="kp-eyebrow kp-eyebrow-orange">For businesses</span>
          <h2>Power up your business.</h2>
          <p>Manage sales, payment requests, transaction exports, analytics, value-added services and customer engagement—online, in store or on the move.</p>
          <Link className="kp-text-link" href="/kasipay/merchant">Explore merchant tools <span>→</span></Link>
        </div>
        <div className="kp-media-card kp-peach">
          <Image src="/kasipay-assets/images/merchant-portal-insights.png" alt="Merchant portal analytics" width={760} height={470} />
        </div>
      </section>

      <section className="kp-platform">
        <div className="kp-section-copy">
          <span className="kp-eyebrow">One connected platform</span>
          <h2>The platform that gives you more.</h2>
          <p>Affordable, secure and designed for South Africa, the public KaSiPay model supports a pay-as-you-use consumer experience and flexible merchant payment solutions without pretending the interface itself is the bank or custodian.</p>
          <div className="kp-stat-row">
            <div><strong>500k+</strong><span>transactions flow through the apps each year</span></div>
            <div><strong>R1bn+</strong><span>publicly reported annual payment processing</span></div>
          </div>
        </div>
        <Image src="/kasipay-assets/images/plotform-images.png" alt="Connected payment platform screens" width={760} height={520} />
      </section>

      <section className="kp-security kp-section">
        <Image src="/kasipay-assets/svg-annimation/Compliance.svg" alt="Financial security and compliance" width={590} height={520} />
        <div className="kp-section-copy">
          <span className="kp-eyebrow kp-eyebrow-orange">Security and clarity</span>
          <h2>Your money deserves clean boundaries.</h2>
          <p>Transactions and personal information require strong safeguards, clear authorisation and a traceable reconciliation trail. KaSiPay will expose only services that have been approved and connected to the authorised custodian account.</p>
          <ul className="kp-checks">
            <li>Licensed custodian holds customer funds</li>
            <li>KYC and AML controls before activation</li>
            <li>Signed callbacks and idempotent processing</li>
            <li>Clear transaction and settlement records</li>
          </ul>
        </div>
      </section>

      <section className="kp-steps kp-section">
        <div className="kp-section-heading">
          <span className="kp-eyebrow">How to get started</span>
          <h2>Four clean steps. No maze.</h2>
        </div>
        <div className="kp-step-grid">
          {steps.map(([number, title, body]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>

      <section className="kp-cta">
        <Image src="/kasipay-assets/images/join-us-today-customer.png" alt="Join the payment ecosystem" width={360} height={590} />
        <div>
          <span className="kp-eyebrow kp-eyebrow-light">Put money in your hands</span>
          <h2>Join the ecosystem.</h2>
          <p>Explore the public service model now. Account activation and live transaction access will follow the approved KaSiPay rollout.</p>
          <Link className="kp-btn kp-btn-light" href="/kasipay/contact">Talk to the team</Link>
        </div>
      </section>
    </>
  );
}
