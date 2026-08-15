// ( |╲ ) — Author: Klaasvaakie
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { FaqItem } from "../kasipay-shell";
import { faqGroups, giniJourney, kasipayPages, merchantJourney } from "../data";
import { RetailerTabs } from "../retailer-tabs";

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
        <PageHero eyebrow="Support" title="Questions, answered clearly." intro="Everything customers and merchants need to know about KaSiPay services, onboarding and support." image="/kasipay-assets/images/faq.png" />
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
        <PageHero eyebrow="About KaSiPay" title="Powering progress through financial inclusion." intro="KaSiPay brings consumer and merchant payment tools together so people and businesses can pay, save and grow with confidence." image="/kasipay-assets/images/customer-app-pop.png" />
        <section className="kp-prose kp-section">
          <h2>Built for everyday commerce</h2>
          <p>KaSiPay is the result of combined payment expertise and technology, created to make digital commerce more accessible for consumers and merchants.</p>
          <div className="kp-value-grid">
            <article><h3>Consumer tools</h3><p>Everyday payments, savings, cashbacks and essential services through Gini.</p></article>
            <article><h3>Merchant tools</h3><p>In-store, online, QR and payment-link tools that help businesses run and grow.</p></article>
            <article><h3>Trusted infrastructure</h3><p>Customer-fund custody, settlement and compliance are handled through the appointed regulated institutions.</p></article>
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
          <article><span>Consumer interest</span><h2>Explore KaSiPaY-OnE</h2><p>Understand everyday payments, savings administration, cashback and supported lifestyle services.</p><Link className="kp-btn kp-btn-primary" href="/kasipay">View KaSiPaY-OnE</Link></article>
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
      <PageHero
        eyebrow={slug === "gini" ? undefined : page.eyebrow}
        title={slug === "gini" ? "Introducing KaSiPaY-OnE" : page.title}
        intro={slug === "gini" ? "The FREE savings wallet that gives you up to 6% interest!" : page.intro}
        image={slug === "gini" ? "/gini-hero-ani.svg" : page.image}
        logo={slug === "gini" ? "/kasipayone-logo-20260808.png" : undefined}
        showCta={slug !== "gini"}
        introAsHeading={slug === "gini"}
        unframedImage={slug === "gini"}
        details={slug === "gini" ? (
          <div className="kp-hero-details">
            <p><strong>Work hard. Keep more of what you earn.</strong></p>
            <p>Every rand you earn should go further. KaSiPaY-OnE helps you save more, earn cashback every time you shop at participating stores, grow your savings with up to 6% interest*, and pay for everyday essentials like electricity, airtime and data—all without paying monthly account fees.</p>
            <p>It&apos;s the smarter way to manage your money, save for tomorrow, and put more back into your pocket today.</p>
            <p><strong>KaSiPaY-OnE – Because every rand should work as hard as you do.</strong></p>
          </div>
        ) : undefined}
      />
      {false && slug === "gini" && (
        <section className="kp-prose kp-section">
          <p><strong>KaSiPaY-OnE is more than just a wallet – it&apos;s here to help your money go further every day.</strong></p>
          <p>Whether you&apos;re getting paid, saving for something important, or simply trying to make your money last until month-end, KaSiPaY-OnE helps you make the most of every rand.</p>
          <p>There are <strong>no monthly fees</strong>, and your savings can earn <strong>up to 6% interest*</strong> – helping your money grow faster than inflation. You&apos;ll also enjoy <strong>instant cashback</strong> when you shop at participating stores, unlock <strong>exclusive discounts</strong>, and conveniently buy <strong>electricity, airtime and data</strong> anytime, anywhere – all from your phone.</p>
          <p>With KaSiPaY-OnE, managing your money is simple, rewarding, and built for everyday life.</p>
        </section>
      )}
      {slug === "gini" && (
        <section className="kp-feature-showcase kp-section">
            <h1 className="kp-feature-heading">Shop at Participating Retailers &amp; Earn Instant Cashback</h1>
            <div className="kp-feature-video">
              <video controls playsInline preload="metadata">
                <source src="/steers-cashback.mp4" type="video/mp4" />
                Your browser does not support embedded video.
              </video>
            </div>
        </section>
      )}
      {slug === "gini" && <RetailerTabs />}
      <section className="kp-feature-cards-section kp-section">
        <div className="kp-feature-grid">
          {page.cards.map((item) => (
            <article key={item[0]}>
              <div className="kp-feature-icon"><Image src={item[2]} alt="" width={86} height={86} /></div>
              <h2>{item[0]}</h2><p>{item[1]}</p>
            </article>
          ))}
        </div>
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
    </>
  );
}

function PageHero({ eyebrow, title, intro, image, logo, showCta = true, introAsHeading = false, unframedImage = false, details }: { eyebrow?: string; title: string; intro: string; image: string; logo?: string; showCta?: boolean; introAsHeading?: boolean; unframedImage?: boolean; details?: ReactNode }) {
  return (
    <section className="kp-page-hero">
      <div>{eyebrow && <span className="kp-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{logo && <Image className="kp-page-hero-logo" src={logo} alt="KaSiPaY-OnE" width={563} height={150} priority />}{introAsHeading ? <h2>{intro}</h2> : <p>{intro}</p>}{details}{showCta && <Link className="kp-btn kp-btn-primary" href="/kasipay/contact">Get started</Link>}</div>
      <div className={unframedImage ? "kp-page-hero-image kp-page-hero-image-unframed" : "kp-page-hero-image"}><Image src={image} alt="" width={620} height={560} priority unoptimized={unframedImage} /></div>
    </section>
  );
}
