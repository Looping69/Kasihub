"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Users, Network, ShoppingBag, Building2, Landmark,
  Sparkles, Wallet, TrendingUp, Coins, QrCode,
  CheckCircle2, Phone, Mail, MapPin, Menu, X, ChevronRight,
  ShieldCheck, LoaderCircle, PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/brand-logo";
import { useKasiStore } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublicAssistant } from "@/components/public-assistant";

// Author: Klaasvaakie ( |╲ )
const PILLARS = [
  {
    icon: Network,
    title: "KasiHub Membership",
    desc: "Join the hybrid ecosystem with a R140/mo subscription. Get placed in a 5×6 Eco-System — no recruitment required to earn.",
    color: "from-emerald-500 to-emerald-600",
    points: ["5×6 Eco-System", "R140/mo individual / R300 business", "R47 paid up 6 levels", "Unique profile number"],
  },
  {
    icon: Landmark,
    title: "Roots CO-OP Bank",
    desc: "200 Pioneer members purchase 1 share @ R500 to constitute the Roots Bank. Pioneers share in 1% of Kasi profits for life.",
    color: "from-amber-500 to-amber-600",
    points: ["Only 200 pioneer spots", "R550 kids/pensioners · R700 adults", "1% PioneerPool forever", "NFC tag + VISA card"],
  },
  {
    icon: Coins,
    title: "KasiShares",
    desc: "Class B private shares sold in phases, starting at $25 in Phase 1 (Buy One Get One Free). Earn daily dividends from KasiMall profits.",
    color: "from-yellow-500 to-amber-600",
    points: ["Phase 1: $25/share (BOGO)", "Daily profit share", "Digital certificates", "Dividends declared by KasiMall"],
  },
  {
    icon: ShoppingBag,
    title: "KasiMarketPlace",
    desc: "Virtual marketplace of third-party products & services. Every purchase generates commission that flows back into the KasiPool.",
    color: "from-teal-500 to-emerald-600",
    points: ["Airtime, groceries, utilities", "Insurance & health", "Cashback to KasiPool", "Pay from Roots Bank account"],
  },
  {
    icon: Building2,
    title: "KasiMall",
    desc: "Physical cashless malls built once 5,000 members register in an area. NFC-tag payments split instantly across cost, VAT, SharePool & KasiPool.",
    color: "from-rose-500 to-amber-600",
    points: ["100% cashless NFC payments", "Smart-contract silo splits", "Owned & operated by KasiMall Co", "Builds at 5,000 members/area"],
  },
];

const STATS = [
  { label: "Active Members", value: "1,240+", icon: Users },
  { label: "Shares Sold (Phase 1)", value: "18,420", icon: Coins },
  { label: "KasiPool Paid Out", value: "R 2.1M", icon: Wallet },
  { label: "Pioneer Spots Left", value: "153", icon: Sparkles },
];

const FLOW = [
  { step: "01", title: "Join with a link", desc: "Receive a unique invite link from your upline or join via bulk registration." },
  { step: "02", title: "Choose membership", desc: "Individual (Adult/Kids) or Company. Pick your subscription tier." },
  { step: "03", title: "Complete KYC", desc: "Fill in your profile, upload ID/Passport, verify your identity." },
  { step: "04", title: "Get your profile number", desc: "Receive a unique profile number, NFC tag & VISA card from Roots Bank." },
  { step: "05", title: "Access the ecosystem", desc: "Earn from the 5×6 matrix, KasiPool, dividends, marketplace & mall." },
];

export function Landing() {
  const { openRegistration, login } = useKasiStore();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [loginIntent, setLoginIntent] = useState<"member" | "admin">("member");

  // Author: Klaasvaakie ( |╲ )
  // Both portals use real credentials; the admin intent is enforced server-side.
  function openLogin(intent: "member" | "admin") {
    setLoginIntent(intent);
    setLoginError("");
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
      <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-[#075bb8]/88 text-white shadow-lg backdrop-blur-xl dark:bg-[#050b12]/90">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <BrandLogo className="h-14 w-auto max-w-32" priority />

            <nav className="hidden md:flex items-center gap-1">
              <a href="#pillars" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">Ecosystem</a>
              <a href="#flow" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">How it works</a>
              <a href="#pioneer" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">Pioneer Pool</a>
              <Link href="/kasipay" className="px-3 py-2 text-sm font-semibold text-orange-200 transition-colors hover:text-white">KaSiPay</Link>
              <a href="#contact" className="px-3 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors">Contact</a>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
              <Button variant="ghost" size="sm" onClick={() => openLogin("admin")} className="hidden sm:inline-flex text-orange-200 hover:bg-white/15 hover:text-white">
                <ShieldCheck className="h-4 w-4 mr-1" /> Admin
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openLogin("member")} className="hidden text-white hover:bg-white/15 hover:text-white sm:inline-flex">
                Sign in
              </Button>
              <Button size="sm" onClick={openRegistration} className="bg-gradient-to-r from-[#ff9d13] to-[#ff641e] text-white shadow-lg hover:from-[#ffad32] hover:to-[#ff7435]">
                Join KaSiHUB <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/15 bg-[#064b94]/96 md:hidden dark:bg-[#07111d]/96">
            <nav className="container mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
              <a href="#pillars" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">Ecosystem</a>
              <a href="#flow" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">How it works</a>
              <a href="#pioneer" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">Pioneer Pool</a>
              <Link href="/kasipay" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-muted rounded-md">KaSiPay</Link>
              <a href="#contact" onClick={() => setMobileMenu(false)} className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">Contact</a>
              <button onClick={() => { setMobileMenu(false); void handleEnter(); }} className="rounded-md px-3 py-2 text-left text-sm font-bold text-orange-200 hover:bg-white/10">Explore demo</button>
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

        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <BrandLogo className="mx-auto mb-5 h-32 w-auto max-w-[340px] drop-shadow-2xl sm:h-40" priority />
            <Badge variant="outline" className="mb-6 border-blue-200/50 bg-blue-950/35 text-blue-50 backdrop-blur-md">
              <Sparkles className="h-3 w-3 mr-1" /> Powered by Solidus Holdings (Pty) Ltd
            </Badge>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight drop-shadow-xl sm:text-5xl lg:text-7xl">
              The hybrid ecosystem for
              <span className="mt-2 block bg-gradient-to-r from-[#69c5ff] via-white to-[#ff9d13] bg-clip-text text-transparent">
                community wealth.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-blue-50 sm:text-xl">
              KaSiHUB is the central point connecting members to a 5×6 Eco-System, KasiShares,
              the KasiMarketPlace, KasiMall, and the Roots CO-OP Bank — all in one app.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={openRegistration} className="bg-gradient-to-r from-[#ff9d13] to-[#ff641e] text-white shadow-xl shadow-orange-950/30 hover:from-[#ffad32] hover:to-[#ff7435]">
                Become a member <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleEnter} disabled={demoLoading} className="border-white !bg-white font-bold !text-[#075bb8] shadow-xl hover:!bg-blue-50 hover:!text-[#ff641e]">
                {demoLoading ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                {demoLoading ? "Opening demo…" : "Explore the demo"}
              </Button>
            </div>
            {loginError && <p role="alert" className="mx-auto mt-4 max-w-xl rounded-xl border border-orange-300/50 bg-[#2a1208]/80 px-4 py-3 text-sm font-semibold text-orange-100 backdrop-blur">{loginError}</p>}
            <p className="mt-4 text-xs text-blue-100">
              R140/mo individual · R300/mo company · No recruitment required to earn
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {STATS.map((s) => (
              <Card key={s.label} className="border-white/20 bg-[#06192d]/72 p-5 text-center text-white shadow-xl backdrop-blur-xl">
                <s.icon className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
                <p className="text-2xl sm:text-3xl font-black tracking-tight">{s.value}</p>
                <p className="mt-1 text-xs text-blue-100">{s.label}</p>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section id="pillars" className="bg-background/94 py-16 backdrop-blur-xl lg:py-24 dark:bg-[#07111d]/94">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="mb-3">The 5 Pillars</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">One ecosystem, five ways to grow.</h2>
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
                <Card className="h-full p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/60 group">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <p.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                  <ul className="space-y-1.5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
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
              <Card className="h-full p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <Wallet className="h-8 w-8 mb-4" />
                <h3 className="text-xl font-bold mb-2">The KasiPool</h3>
                <p className="text-sm text-emerald-50 leading-relaxed mb-4">
                  All profits from the Marketplace, Mall, and subscription differences flow into one shared pool.
                  It&apos;s split equally among every eligible Hub member and paid into their Roots Bank account
                  <strong className="text-white"> every night at 12:00 SAST</strong>.
                </p>
                <div className="space-y-1.5">
                  {["Equal share for all members", "Nightly payouts", "Funded by 3 revenue streams"].map((pt) => (
                    <div key={pt} className="flex items-start gap-2 text-sm text-emerald-50">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
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
            <Badge variant="secondary" className="mb-3">How it works</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From invite to ecosystem in 5 steps.</h2>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-emerald-200 via-amber-200 to-emerald-200" />
            <div className="grid gap-8 lg:grid-cols-5">
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
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pioneer CTA */}
      <section id="pioneer" className="bg-gradient-to-br from-orange-50/95 via-blue-50/95 to-orange-50/95 py-16 backdrop-blur-xl dark:from-[#241609]/95 dark:via-[#091827]/95 dark:to-[#241609]/95 lg:py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
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
              <Button size="lg" onClick={openRegistration} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white">
                Claim your pioneer spot <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <Card className="p-8 bg-card/80 backdrop-blur border-amber-200/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
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

      {/* Contact / Footer */}
      <footer id="contact" className="border-t border-border/40 bg-sidebar text-sidebar-foreground mt-auto">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <BrandLogo className="h-24 w-auto max-w-48 mb-4" />
              <p className="text-sm text-sidebar-foreground/70 max-w-md leading-relaxed">
                The central point of a hybrid ecosystem connecting members, shares, marketplace,
                mall and the Roots CO-OP Bank. Operated by Solidus Holdings (Pty) Ltd.
              </p>
              <div className="mt-4 space-y-2 text-sm text-sidebar-foreground/70">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Solidus Holdings (Pty) Ltd · FNB Gold Business</p>
                <p className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Account: 63212306319 · Branch: 210835</p>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-3">Ecosystem</p>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiHub Membership</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiShares</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiMarketPlace</a></li>
                <li><a href="#pillars" className="hover:text-sidebar-foreground">KasiMall</a></li>
                <li><Link href="/kasipay" className="hover:text-sidebar-foreground">KaSiPay</Link></li>
                <li><a href="#pioneer" className="hover:text-sidebar-foreground">Roots Bank Pioneers</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-3">Get in touch</p>
              <ul className="space-y-2 text-sm text-sidebar-foreground/70">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@kasihub.co.za</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +27 11 000 0000</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Johannesburg, South Africa</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-sidebar-border flex flex-col sm:flex-row justify-between gap-4 text-xs text-sidebar-foreground/50">
            <p>© {new Date().getFullYear()} KaSiHUB. All rights reserved. Operated by Solidus Holdings (Pty) Ltd.</p>
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
              <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
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
