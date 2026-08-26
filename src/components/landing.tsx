"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, Network, ShoppingBag, Building2, Landmark,
  Sparkles, Wallet, TrendingUp, Coins,
  CheckCircle2, Phone, Mail, MapPin, Menu, X, ChevronRight,
  ShieldCheck, LoaderCircle, Play, PiggyBank, Gift,
  HeartHandshake, Store, Zap, BriefcaseBusiness, MousePointer2, Pointer, Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/brand-logo";
import { BrandGradientIcon, brandIconTone } from "@/components/brand-gradient-icon";
import { useKasiStore } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublicAssistant } from "@/components/public-assistant";

// Author: Klaasvaakie ( |╲ )
const PILLARS = [
  {
    icon: Network,
    title: "KaSiHuB Membership",
    desc: "Join a lifestyle membership built to help your money go further through everyday savings, CashBACK, member offers and access to the wider KaSiHuB ecosystem.",
    points: ["Shop the KaSiMarketPlace", "Access member discounts and offers", "Earn CashBACK on qualifying purchases", "Explore benefits and earning opportunities"],
  },
  {
    icon: Landmark,
    title: "KaSiPaY",
    desc: "A free wallet for everyday payments and savings. Earn cashback at participating retailers, grow your savings and manage essential purchases from your phone.",
    points: ["No monthly account fees", "Up to 6% interest* on savings", "Cashback & member discounts", "Electricity, airtime & data"],
  },
  {
    icon: Coins,
    title: "KaSiShares",
    desc: "Class B private shares sold in phases, starting at $25 in Phase 1 (Buy One Get One Free). Earn daily dividends from KasiMall profits.",
    points: ["Phase 1: $25/share (BOGO)", "Daily profit share", "Digital certificates", "Dividends declared by KasiMall"],
  },
  {
    icon: ShoppingBag,
    title: "KaSiMarketPlace",
    desc: "Virtual marketplace of third-party products & services. Every purchase generates commission that flows back into the KasiPool.",
    points: ["Airtime, groceries, utilities", "Insurance & health", "Cashback to KasiPool", "Pay from Roots Bank account"],
  },
  {
    icon: Building2,
    title: "KaSiHuB Business-in-a-Box",
    desc: "Physical cashless malls built once 5,000 members register in an area. NFC-tag payments split instantly across cost, VAT, SharePool & KasiPool.",
    points: ["100% cashless NFC payments", "Smart-contract silo splits", "Owned & operated by KasiMall Co", "Builds at 5,000 members/area"],
  },
];

const FLOW = [
  { step: "01", title: "Join with a link", desc: "Receive a unique invite link." },
  { step: "02", title: "Choose membership", desc: "Select a membership that fits your lifestyle." },
  { step: "03", title: "Activate your KaSiPay Wallet", desc: "Create your KaSiPay Wallet for everyday payments, savings and member benefits." },
  { step: "04", title: "Access the ecosystem", desc: "Earn from the 5×6 matrix, KasiPool, dividends, marketplace & mall." },
];

const MEMBER_VALUE = [
  {
    icon: ShoppingBag,
    title: "Shop smarter",
    copy: "Access products, services and special member offers.",
  },
  {
    icon: PiggyBank,
    title: "Save more",
    copy: "Enjoy discounts, CashBACK and everyday savings.",
  },
  {
    icon: Coins,
    title: "Earn more",
    copy: "Earn rewards and access opportunities to generate extra income.",
  },
  {
    icon: HeartHandshake,
    title: "Live better",
    copy: "Access valuable products, services and lifestyle benefits.",
  },
];

const MEMBER_VALUE_CARD_GRADIENTS = [
  "from-[#ff9d13] to-[#ff5a00]",
  "from-[#85d608] to-[#22a900]",
  "from-[#29b6ff] to-[#0798f2]",
];

const PILLAR_CARD_STYLES = [
  "border-white/10 bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#263470] text-white",
  "border-slate-200 bg-white text-[#101a48]",
  "border-white/10 bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#263470] text-white",
  "border-slate-200 bg-white text-[#101a48]",
  "border-white/10 bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#263470] text-white",
  "border-slate-200 bg-white text-[#101a48]",
];

const COMMUNITY_VALUE = [
  "Consumers save.",
  "Members earn rewards.",
  "Merchants gain customers.",
  "Entrepreneurs find opportunities.",
  "Communities become stronger.",
];

function SolidWhiteCardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" className="h-11 w-11 text-white drop-shadow-sm" strokeWidth={2.75} />;
}

export function Landing() {
  const { openRegistration, login } = useKasiStore();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [loginIntent, setLoginIntent] = useState<"member" | "admin">("member");

  // Author: Klaasvaakie ( |╲ )
  // Both portals use real credentials; the admin intent is enforced server-side.
  function openLogin(intent: "member" | "admin") {
    setLoginIntent(intent);
    setLoginError("");
    setShowPassword(false);
    setLoginOpen(true);
  }

  async function handleEnter() {
    setDemoLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoRole: "member" }),
      });
      const data = await res.json();
      if (!res.ok || !data.member) {
        setLoginError(data.error || "The demo is temporarily unavailable.");
        return;
      }
      login(data.member.id, data.member);
    } catch {
      setLoginError("The demo could not connect to KaSiHUB. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleAccountLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, adminPortal: loginIntent === "admin" }),
      });
      const data = await res.json();
      if (!res.ok || !data.member) {
        setLoginError(data.error || "Unable to sign in");
        return;
      }
      login(data.member.id, data.member);
      setLoginOpen(false);
      setPassword("");
    } catch {
      setLoginError("The Encore service is unavailable.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="kasi-app-shell min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/15 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#263470] text-white shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-[76px] min-w-0 items-center justify-between gap-2 sm:h-[91px] sm:gap-4">
            <BrandLogo className="h-[62px] w-auto max-w-[128px] shrink-0 sm:h-[75px] sm:max-w-[160px]" priority />

            <nav className="hidden items-center gap-1 uppercase md:flex">
              <a href="#pillars" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">Ecosystem</a>
              <a href="#flow" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">How it works</a>
              <Link href="/kasipay" className="px-3 py-2 text-sm font-semibold text-orange-200 transition-colors hover:text-white">KaSiPay</Link>
              <a href="#contact" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">Contact</a>
            </nav>

            <div className="flex min-w-0 items-center gap-1 uppercase sm:gap-2">
              <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
              <Button variant="ghost" size="sm" onClick={() => openLogin("admin")} className="hidden !text-sm uppercase text-orange-200 hover:bg-white/15 hover:text-white sm:inline-flex">
                <ShieldCheck className="h-4 w-4 mr-1" /> Admin
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openLogin("member")} className="hidden !text-sm uppercase text-white hover:bg-white/15 hover:text-white sm:inline-flex">
                Sign in
              </Button>
              <Button size="sm" brandTone="orange" onClick={openRegistration} className="hidden !text-sm bg-gradient-to-r from-[#ff9d13] to-[#ff641e] text-white shadow-lg hover:from-[#ffad32] hover:to-[#ff7435] sm:inline-flex">
                Join KaSiHUB <MousePointer2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/15 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#263470] md:hidden">
            <nav className="container mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 uppercase">
              <a href="#pillars" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">Ecosystem</a>
              <a href="#flow" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">How it works</a>
              <Link href="/kasipay" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-muted rounded-md">KaSiPay</Link>
              <a href="#contact" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">Contact</a>
              <button onClick={() => { setMobileMenu(false); void handleEnter(); }} className="rounded-md px-3 py-2 text-left text-sm font-bold text-orange-200 hover:bg-white/10">Explore demo</button>
              <button onClick={() => { setMobileMenu(false); openRegistration(); }} className="rounded-md bg-gradient-to-r from-[#ff9d13] to-[#ff641e] px-3 py-3 text-left text-sm font-black text-white shadow-lg sm:hidden">Join KaSiHUB</button>
              <button onClick={() => { setMobileMenu(false); openLogin("member"); }} className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-white/10">Sign in</button>
              <button onClick={() => { setMobileMenu(false); openLogin("admin"); }} className="rounded-md px-3 py-2 text-left text-sm font-bold text-orange-200 hover:bg-white/10">Admin login</button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative flex-1 overflow-hidden text-white">
        <div className="absolute inset-0 kasi-grid-pattern opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#005fc7]/35 via-[#073b75]/45 to-[#031427]/80 dark:from-black/15 dark:via-black/35 dark:to-black/85" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#263470] [mask-image:linear-gradient(to_bottom,black_0%,black_12%,transparent_100%)]" />

        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <BrandLogo className="mx-auto mb-5 h-32 w-auto max-w-[340px] drop-shadow-2xl sm:h-40" priority />
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight drop-shadow-xl sm:text-5xl lg:text-7xl">
              Make your money go further.
            </h1>
            <h2 className="mt-3 bg-gradient-to-r from-[#ff9d13] via-[#ff7a18] to-[#ff5a00] bg-clip-text text-2xl font-black text-transparent drop-shadow-lg sm:text-3xl lg:text-4xl">
              Save More. Earn More. Live Better.
            </h2>
            <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-blue-50 sm:text-lg">
              Life is getting more expensive. Whether you&apos;re working hard to stretch your salary or looking for ways to earn, <strong className="text-white">KaSiHuB is built to help everyday South Africans do better with what they have.</strong>
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-relaxed text-blue-100 sm:text-lg">
              Save on everyday spending. Earn CashBACK. Access valuable benefits. Discover opportunities to earn more.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" brandTone="orange" onClick={openRegistration} className="bg-gradient-to-r from-[#ff9d13] to-[#ff641e] text-white shadow-xl shadow-orange-950/30 hover:from-[#ffad32] hover:to-[#ff7435]">
              Become a member <Wallet className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" brandTone="blue" onClick={handleEnter} disabled={demoLoading} className="font-bold shadow-xl">
                {demoLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {demoLoading ? "Opening demo…" : "Explore the demo"}
              </Button>
            </div>
            {loginError && <p role="alert" className="mx-auto mt-4 max-w-xl rounded-xl border border-orange-300/50 bg-[#2a1208]/80 px-4 py-3 text-sm font-semibold text-orange-100 backdrop-blur">{loginError}</p>}
          </motion.div>

        </div>
      </section>

      {/* New public value proposition — kept separate from the existing page for review. */}
      <section id="member-value" className="relative overflow-hidden bg-[#f6f8fc] text-[#0f172a] dark:bg-[#070d1a] dark:text-white">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#263470]" />

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-20 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="kasi-eyebrow mb-4 border-0 bg-transparent p-0 font-black uppercase tracking-[0.18em] text-[#ff641e] shadow-none hover:bg-transparent">What is KaSiHuB?</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:!text-4xl">
                A lifestyle membership built around everyday value.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                KaSiHuB is a <strong className="text-[#172554] dark:text-blue-200">lifestyle membership and community platform</strong> that helps South Africans get more value from everyday spending.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {MEMBER_VALUE.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/45 bg-gradient-to-br ${MEMBER_VALUE_CARD_GRADIENTS[index % MEMBER_VALUE_CARD_GRADIENTS.length]} p-6 text-center text-[#101a48] shadow-lg shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-xl`}
                >
                  <div className="mb-5 flex justify-center">
                    <SolidWhiteCardIcon icon={item.icon} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-[#101a48]/85">{item.copy}</p>
                </motion.article>
              ))}
            </div>
          </div>

          <div className="grid items-center gap-8 rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#10182a] sm:gap-10 sm:p-10 lg:grid-cols-[1.05fr_.95fr] lg:p-14">
            <div>
              <p className="kasi-eyebrow font-black uppercase tracking-[0.18em] text-[#ff641e]">You&apos;re already spending money.</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:!text-4xl">Why not get something back?</h2>
              <p className="mt-5 text-lg font-bold text-[#263470] dark:text-blue-100">Groceries. Data. Electricity. Transport. Household products and services.</p>
              <p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-300">
                KaSiHuB connects everyday spending to <strong>savings, CashBACK, rewards and opportunities</strong> that can help your money stretch further.
              </p>
              <p className="mt-6 text-xl font-black text-[#172554] dark:text-white">Spend smarter. Keep more. Build more.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShoppingBag, label: "Groceries" },
                { icon: Zap, label: "Electricity" },
                { icon: Phone, label: "Data" },
                { icon: Store, label: "Services" },
              ].map(({ icon: Icon, label }, index) => (
                <div key={label} className="flex min-h-32 flex-col items-center justify-center rounded-2xl bg-blue-50 p-5 text-center text-[#172554] dark:bg-white/5 dark:text-blue-100">
                  <BrandGradientIcon icon={Icon} tone={brandIconTone(index)} className="h-8 w-8" />
                  <span className="mt-3 text-sm font-black">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="py-20 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="kasi-eyebrow font-black uppercase tracking-[0.18em] text-[#ff641e]">Start free. Grow when you&apos;re ready.</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:!text-4xl">Choose the value that fits your life.</h2>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-[#10182a] sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="kasi-eyebrow font-black uppercase tracking-wider text-emerald-600">Free member</p>
                    <h3 className="mt-2 text-4xl font-black">R0</h3>
                  </div>
                  <BrandGradientIcon icon={Gift} tone="orange" className="h-10 w-10" />
                </div>
                <ul className="mt-7 flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                  {["Join for free", "Shop the Marketplace", "Access selected discounts", "Earn CashBACK on qualifying purchases", "Explore the KaSiHuB ecosystem"].map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><span>{item}</span></li>
                  ))}
                </ul>
                <Button size="lg" brandTone="green" onClick={openRegistration} className="mt-8 bg-emerald-600 font-black text-white hover:bg-emerald-700">
                  Join free <MousePointer2 className="h-5 w-5" />
                </Button>
              </article>

              <article className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#263470] p-5 text-white shadow-2xl shadow-slate-950/20 sm:p-9">
                <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/3 rounded-full bg-[#ff9d13]/20 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="kasi-eyebrow font-black uppercase tracking-wider text-[#ff9d13]">Subscription member</p>
                    <h3 className="mt-2 text-4xl font-black">R140<span className="text-base font-bold text-blue-100">/month</span></h3>
                  </div>
                  <BrandGradientIcon icon={Wallet} tone="green" className="h-10 w-10" />
                </div>
                <p className="relative mt-6 font-black">Unlock even more value:</p>
                <ul className="relative mt-5 flex-1 space-y-3 text-sm text-blue-50">
                  {["More ecosystem benefits", "Value-added products & services", "Additional earning opportunities", "Eligibility for KaSi Shareholder Access*"].map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#ff9d13]" /><span>{item}</span></li>
                  ))}
                </ul>
                <Button size="lg" brandTone="orange" onClick={openRegistration} className="relative mt-8 bg-[#ff9d13] font-black text-[#0f172a] hover:bg-[#ffad32]">
                  Explore membership <Search className="h-5 w-5" />
                </Button>
              </article>
            </div>
          </div>

          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 text-[#101a48] shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#10182a] sm:p-10 lg:grid lg:grid-cols-[1.35fr_.65fr] lg:items-center lg:gap-10 lg:p-14">
              <div className="text-center lg:text-left">
                <p className="kasi-eyebrow font-black uppercase tracking-[0.18em] text-[#ff641e]">
                  <span className="block">Working? Unemployed?</span>
                  <span className="block">Side hustling?</span>
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">There&apos;s a place for you.</h2>
                <p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-300">You don&apos;t need a big salary or your own business.</p>
                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
                  Whether you want to <strong>save money, stretch your income or find new ways to earn</strong>, KaSiHuB gives you a place to start.
                </p>
                <p className="mt-6 font-black">No pressure. No get-rich-quick promises.</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Just real products, real benefits, real savings and real opportunities.</p>
              </div>
              <div className="mt-8 flex min-h-56 items-center justify-center rounded-2xl bg-blue-50 p-8 dark:bg-white/5 lg:mt-0">
                <BrandGradientIcon icon={BriefcaseBusiness} tone="orange" className="h-24 w-24" />
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 text-[#101a48] shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#10182a] sm:p-10 lg:grid lg:grid-cols-[.65fr_1.35fr] lg:items-center lg:gap-10 lg:p-14">
              <div className="flex min-h-56 items-center justify-center rounded-2xl bg-blue-50 p-8 dark:bg-white/5">
                <BrandGradientIcon icon={Users} tone="green" className="h-24 w-24" />
              </div>
              <div className="mt-8 text-center lg:mt-0 lg:text-left">
                <p className="kasi-eyebrow font-black uppercase tracking-[0.18em] text-[#ff641e]">When our community grows</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">We all have more opportunity.</h2>
                <ul className="mx-auto mt-6 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2 lg:mx-0">
                  {COMMUNITY_VALUE.map((item) => (
                    <li key={item} className="flex items-start justify-start gap-3 font-semibold text-slate-600 dark:text-slate-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#85d608]" /><span>{item}</span></li>
                  ))}
                </ul>
                <p className="mt-7 text-xl font-black uppercase leading-tight text-[#101a48]">
                  <span className="block">One Community.</span>
                  <span className="block">One Connection.</span>
                  <span className="block">Endless Possibilities.</span>
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Pillars */}
      <section id="pillars" className="bg-background/94 py-16 backdrop-blur-xl lg:py-24 dark:bg-[#07111d]/94">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="kasi-eyebrow mb-4 max-w-full whitespace-normal border-0 bg-transparent p-0 text-center font-black uppercase tracking-[0.12em] text-[#ff641e] shadow-none hover:bg-transparent sm:tracking-[0.18em]">
              Reasons to join our community
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">One EcoSystem, Multiple ways to earn</h2>
            <p className="mt-4 text-muted-foreground">
              Every part of KaSiHUB feeds back into the community. Profits from the marketplace and mall
              flow into the KasiPool, shared equally among all eligible members every night at midnight SAST.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Card className={`group h-full ${PILLAR_CARD_STYLES[i]} p-6 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                  {i === 0 && (
                    <div className="mb-5 flex justify-center">
                      <BrandLogo className="h-[65px] w-auto max-w-full object-contain" />
                    </div>
                  )}
                  {i === 1 && (
                    <div className="mb-5 flex justify-center">
                      <Image
                        alt="KaSiPay"
                        className="h-[65px] w-auto max-w-full object-contain"
                        height={116}
                        src="/kasipay-logo-20260808.png"
                        width={463}
                      />
                    </div>
                  )}
                  {i === 2 && <div aria-hidden="true" className="mb-5 h-[65px]" />}
                  {i === 4 && (
                    <div className="mb-5 flex justify-center">
                      <Image
                        alt="KaSiHuB Business-in-a-Box"
                        className="h-[65px] w-auto max-w-full object-contain"
                        height={150}
                        loading="eager"
                        src="/kasihub-business-in-a-box.png"
                        width={265}
                      />
                    </div>
                  )}
                  <h3 className="mb-2 text-center !text-lg font-bold uppercase tracking-tight">{p.title}</h3>
                  <p className={`mb-4 text-sm font-medium leading-relaxed ${i % 2 === 0 ? "text-blue-100" : "text-[#101a48]/80"}`}>{p.desc}</p>
                  <ul className="space-y-1.5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${i % 2 === 0 ? "text-[#ff9d13]" : "text-[#0798f2]"}`} />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}

            {/* KasiPool card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className={`relative h-full overflow-hidden ${PILLAR_CARD_STYLES[5]} p-6 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <h3 className="mb-2 text-center !text-lg font-bold uppercase tracking-tight">KaSiMarketPlace Pool</h3>
                <p className="mb-4 text-sm font-medium leading-relaxed text-[#101a48]/80">
                  All profits from the Marketplace, Mall, and subscription differences flow into one shared pool.
                  It&apos;s split equally among every eligible Hub member and paid into their Roots Bank account
                  <strong className="text-[#101a48]"> every night at 12:00 SAST</strong>.
                </p>
                <div className="space-y-1.5">
                  {["Equal share for all members", "Nightly payouts", "Funded by 3 revenue streams"].map((pt) => (
                    <div key={pt} className="flex items-start gap-2 text-sm text-[#101a48]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0798f2]" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="flow" className="bg-blue-50/94 py-16 backdrop-blur-xl lg:py-24 dark:bg-[#0a1725]/94">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="kasi-eyebrow mb-3">How it works</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From invite to ecosystem in 4 steps.</h2>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-emerald-200 via-amber-200 to-emerald-200" />
            <div className="grid gap-8 lg:grid-cols-4">
              {FLOW.map((f, i) => (
                <motion.div
                  key={f.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative text-center"
                >
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border-2 border-emerald-200 mb-4 z-10">
                    <span className="text-lg font-black bg-gradient-to-br from-emerald-600 to-amber-500 bg-clip-text text-transparent">{f.step}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pioneer CTA */}
      {false && (
      <section id="pioneer" className="bg-gradient-to-br from-orange-50/95 via-blue-50/95 to-orange-50/95 py-16 backdrop-blur-xl dark:from-[#241609]/95 dark:via-[#091827]/95 dark:to-[#241609]/95 lg:py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="kasi-eyebrow mb-4 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                <Sparkles className="h-3 w-3 mr-1" /> Limited to 200 pioneers
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Become a Roots Bank Pioneer.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Roots CO-OP Bank needs 200 individuals to purchase 1 share at R500 and register as
                founding members. As a thank-you, pioneers share in <strong>1% of all Kasi Mall and
                Marketplace profits</strong> for life — over and above ordinary dividends.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { cat: "Kids & Students (16-18)", price: "R550", note: "R500 share + R50 membership" },
                  { cat: "Adults (18-65)", price: "R700", note: "R500 share + R200 membership" },
                  { cat: "Pensioners (65+, or 60+ on SASSA)", price: "R550", note: "R500 share + R50 membership" },
                ].map((c) => (
                  <div key={c.cat} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/60">
                    <div>
                      <p className="font-semibold text-sm">{c.cat}</p>
                      <p className="text-xs text-muted-foreground">{c.note}</p>
                    </div>
                    <p className="text-2xl font-black text-amber-600">{c.price}</p>
                  </div>
                ))}
              </div>
              <Button size="lg" brandTone="green" onClick={openRegistration} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white">
                Claim your pioneer spot <Pointer className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <Card className="p-8 bg-card/80 backdrop-blur border-amber-200/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <BrandGradientIcon icon={TrendingUp} tone="blue" className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-bold">Pioneer Pool progress</p>
                    <p className="text-xs text-muted-foreground">153 spots remaining</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Pioneers registered</span>
                      <span className="font-bold">47 / 200</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "23.5%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
                      <p className="text-2xl font-black text-amber-600">1%</p>
                      <p className="text-xs text-muted-foreground">of all Kasi profits</p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                      <p className="text-2xl font-black text-emerald-600">∞</p>
                      <p className="text-xs text-muted-foreground">lifetime share</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border/60">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      Roots Bank is a separate entity from Kasi. Pioneer shares are held in a closed group
                      and distributed via the PioneerPool.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Contact / Footer */}
      <footer id="contact" className="mt-auto border-t border-white/10 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#263470] text-white">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <BrandLogo className="mb-4 h-[75px] w-auto max-w-[160px]" />
              <p className="text-sm text-sidebar-foreground/70 max-w-md leading-relaxed">
                The central point of a hybrid ecosystem connecting members, shares, marketplace,
                mall and the Roots CO-OP Bank. Operated by Solidus Holdings (Pty) Ltd.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-3">Ecosystem</p>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiHub Membership</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiShares</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiMarketPlace</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiMall</a></li>
                <li><Link href="/kasipay" className="hover:text-sidebar-foreground">KaSiPay</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-3">Get in touch</p>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li className="flex items-center gap-2"><BrandGradientIcon icon={Mail} tone="orange" className="h-4 w-4" /> support@kasihub.net</li>
                <li className="flex items-center gap-2"><BrandGradientIcon icon={Phone} tone="green" className="h-4 w-4" /> +27 11 000 0000</li>
                <li className="flex items-center gap-2"><BrandGradientIcon icon={MapPin} tone="blue" className="h-4 w-4" /> South Africa</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-sidebar-border flex flex-col sm:flex-row justify-between gap-4 text-xs text-sidebar-foreground/50">
            <p>© {new Date().getFullYear()} KaSiHub Eco (Pty) Ltd. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Roots Bank is a separate entity from Kasi <ChevronRight className="h-3 w-3" />
            </p>
          </div>
        </div>
      </footer>
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="border-blue-200 bg-background/95 shadow-2xl backdrop-blur-xl dark:border-blue-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{loginIntent === "admin" ? "Sign in to the Admin Portal" : "Sign in to KaSiHUB"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAccountLogin}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-primary" />
                Show password
              </label>
            </div>
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <Button type="submit" className="w-full" disabled={signingIn}>
              {signingIn ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* Author: Klaasvaakie ( |╲ ) — public, website-only KaSiHub information assistant. */}
      <PublicAssistant />
    </div>
  );
}
