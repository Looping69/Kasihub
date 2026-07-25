// ( |╲ ) — Author: Klaasvaakie
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaqItem } from "../kasipay-shell";
import { faqGroups, giniJourney, kasipayPages, merchantJourney } from "../data";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "faq") return { title: "Frequently Asked Questions" };
  if (slug === "about") return { title: "About" };
  if (slug === "contact") return { title: "Contact" };
  const page = kasipayPages[slug as keyof typeof kasipayPages];
  return page ? { title: page.title, description: page.intro } : {};
}

export function generateStaticParams() {
  return [...Object.keys(kasipayPages), "faq", "about", "contact"].map((slug) => ({ slug }));
}

export default async function KasiPayInfoPage({ params }: { params: Params }) {
  const { slug } = await params;

  if (slug === "faq") {
    return (
      <>
        <PageHero eyebrow="Support" title="Questions, answered clearly." intro="Public KaSiPay guidance, stripped of ambiguity and presented around the real custodian boundary." image="/kasipay-assets/images/faq.png" />
        <section className="kp-faq-section kp-section">
          {faqGroups.map((group) => (
            <div className="kp-faq-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) => <FaqItem key={item[0]} question={item[0]} answer={item[1]} />)}
            </div>
          ))}
        </section>
      </>
    );
  }

  if (slug === "about") {
    return (
      <>
        <PageHero eyebrow="About KaSiPay" title="Local access. Proven payment infrastructure." intro="KaSiPay is the customer-facing payment and savings-administration experience being built through an authorised custodian account and API relationship." image="/kasipay-assets/images/customer-app-pop.png" />
        <section className="kp-prose kp-section">
          <h2>Built on a clear division of responsibility</h2>
          <p>KaSiPay uses approved platform capability and public educational material while keeping its customer experience, operational controls and integration records explicit.</p>
          <div className="kp-value-grid">
            <article><h3>Provider infrastructure</h3><p>The approved provider supplies payment and merchant-platform capability under the commercial and technical agreement.</p></article>
            <article><h3>Custodian authority</h3><p>The appointed licensed custodian or nominee institution holds customer funds and governs settlement.</p></article>
            <article><h3>KaSiPay experience</h3><p>KaSiPay presents the local user journey, service information, support entry points and auditable product integration.</p></article>
          </div>
        </section>
      </>
    );
  }

  if (slug === "contact") {
    return (
      <>
        <PageHero eyebrow="Contact" title="Start with the right conversation." intro="Choose the path that matches what you actually need. Live account onboarding will open when the authorised integration is ready." image="/kasipay-assets/images/pay-receipt-services.png" />
        <section className="kp-contact kp-section">
          <article><span>Consumer interest</span><h2>Explore Gini</h2><p>Understand everyday payments, savings administration, cashback and supported lifestyle services.</p><Link className="kp-btn kp-btn-primary" href="/kasipay/gini">View Gini</Link></article>
          <article><span>Merchant onboarding</span><h2>Grow your business</h2><p>Review in-store, online, QR, link, gateway and point-of-sale options.</p><a className="kp-btn kp-btn-primary" href="mailto:support@kasihub.co.za">Contact KaSiPay</a></article>
          <article><span>Need answers?</span><h2>Read the full FAQ</h2><p>Get direct answers about customer funds, settlement, merchant tools, payment methods and support.</p><Link className="kp-btn kp-btn-primary" href="/kasipay/faq">View FAQ</Link></article>
        </section>
      </>
    );
  }

  const page = kasipayPages[slug as keyof typeof kasipayPages];
  if (!page) notFound();

  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} intro={page.intro} image={page.image} />
      <section className="kp-feature-grid kp-section">
        {page.cards.map((item) => (
          <article key={item[0]}>
            <div className="kp-feature-icon"><Image src={item[2]} alt="" width={86} height={86} /></div>
            <h2>{item[0]}</h2><p>{item[1]}</p>
          </article>
        ))}
      </section>
      {page.sections.map((section, index) => (
        <section className={index % 2 ? "kp-detail kp-detail-alt kp-section" : "kp-detail kp-section"} key={section.title}>
          <div><span className="kp-eyebrow">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2><p>{section.body}</p></div>
          <ul className="kp-checks">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ))}
      {(slug === "gini" ? giniJourney : slug === "merchant" ? merchantJourney : []).map((section, index) => (
        <section className={index % 2 ? "kp-journey kp-journey-reverse kp-section" : "kp-journey kp-section"} key={section.title}>
          <div className="kp-journey-image"><Image src={section.image} alt="" width={650} height={520} /></div>
          <div className="kp-section-copy">
            <span className="kp-eyebrow kp-eyebrow-orange">{section.eyebrow}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <ul className="kp-checks">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </section>
      ))}
      <section className="kp-inline-cta"><h2>Ready to go deeper?</h2><p>Review the support information or speak to the platform team.</p><Link className="kp-btn kp-btn-light" href="/kasipay/contact">Get started</Link></section>
    </>
  );
}

function PageHero({ eyebrow, title, intro, image }: { eyebrow: string; title: string; intro: string; image: string }) {
  return (
    <section className="kp-page-hero">
      <div><span className="kp-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p><Link className="kp-btn kp-btn-primary" href="/kasipay/contact">Get started</Link></div>
      <div className="kp-page-hero-image"><Image src={image} alt="" width={620} height={560} priority /></div>
    </section>
  );
}
