"use client";

// Author: Klaasvaakie ( |╲ )
// Mobile dashboard presentation built from the supplied KaSiHUB visual references.
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Crown,
  Headphones,
  HeartPulse,
  Loader2,
  Menu,
  Package,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import { useKasiStore } from "@/lib/store";
import { loadDashboard } from "@/lib/dashboard-client";
import type { DashboardStats, ViewKey } from "@/lib/types";

const quickActions: { label: string; sub: string; icon: typeof Wallet; view: ViewKey; tone: string }[] = [
  { label: "Marketplace", sub: "Shop & save", icon: ShoppingCart, view: "marketplace", tone: "bg-[#1688ed]" },
  { label: "Deals", sub: "Hot offers", icon: Tag, view: "vouchers", tone: "bg-[#f58220]" },
  { label: "Membership", sub: "View benefits", icon: Users, view: "ecosystem", tone: "bg-[#ff9f0a]" },
  { label: "My earnings", sub: "Track earnings", icon: Wallet, view: "profile", tone: "bg-[#1688ed]" },
];

const categories = [
  { label: "Groceries", icon: ShoppingBasket, color: "text-blue-600" },
  { label: "Electronics", icon: Headphones, color: "text-blue-600" },
  { label: "Fashion", icon: Shirt, color: "text-orange-600" },
  { label: "Health & Beauty", icon: HeartPulse, color: "text-violet-600" },
  { label: "Home & Living", icon: Package, color: "text-amber-600" },
];

export function MobileDashboardView() {
  const { currentMember, setView, setSidebarOpen } = useKasiStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!currentMember) return;
    void loadDashboard(currentMember.id).then(setStats).catch(() => setStats(null));
  }, [currentMember]);

  if (!stats) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;
  }

  const money = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-b-[28px] bg-[#f7f9fc] shadow-2xl shadow-slate-950/20 dark:bg-[#05080d] dark:shadow-black/60">
      <section className="relative overflow-hidden bg-[#06101a] px-4 pb-5 pt-2 text-white">
        <Image src="/kasi-township-bg.png" alt="Blue KaSiHUB township background" fill sizes="(max-width: 520px) 100vw, 520px" priority className="object-cover opacity-95 dark:hidden" />
        <Image src="/kasi-energy-bg.webp" alt="Blue and orange KaSiHUB energy" fill sizes="(max-width: 520px) 100vw, 520px" priority className="hidden object-cover opacity-65 dark:block" />
        <div className="absolute inset-0 bg-[#002b9c]/25 dark:bg-black/25" />
        <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm"><Menu className="h-6 w-6" /></button>
        <button aria-label="Notifications" onClick={() => setView("vouchers")} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm"><Bell className="h-5 w-5" /></button>
        <div className="relative flex justify-center py-1">
          <Image src="/kasihub-logo.webp" alt="KaSiHUB" width={285} height={160} priority style={{ width: "72%", height: "auto" }} className="max-w-[300px] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,.7)]" />
        </div>
        <div className="relative mt-1 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#f58220] bg-gradient-to-br from-[#1688ed] to-[#075aa0] text-sm font-black">
              {currentMember?.firstName?.[0]}{currentMember?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold">Hello, {currentMember?.firstName}! <span aria-hidden>👋</span></p>
              <p className="text-[11px] text-white/70">Welcome to KaSiHUB</p>
            </div>
          </div>
          <button onClick={() => setView("ecosystem")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-[#071e58]/80 px-3 py-1.5 text-[11px] font-bold shadow-lg">
            <Crown className="h-3.5 w-3.5 text-[#ffd028]" /> KaSi Member
          </button>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => setView("profile")} className="flex min-h-[96px] items-center gap-3 rounded-2xl bg-gradient-to-br from-[#1688ed] to-[#075aa0] p-3 text-left shadow-xl">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#087fe8]"><Wallet className="h-6 w-6" /></span>
            <span className="min-w-0"><span className="block text-[9px] font-bold uppercase text-white/85">Wallet balance</span><span className="block truncate text-lg font-black">{money(stats.walletBalance)}</span><span className="mt-2 block text-[9px] text-white/75">Available {stats.walletCurrency}</span></span>
          </button>
          <button onClick={() => setView("ecosystem")} className="flex min-h-[96px] items-center gap-3 rounded-2xl bg-gradient-to-br from-[#ffc400] to-[#ff8a00] p-3 text-left shadow-xl">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#ff9b00]"><Crown className="h-6 w-6" /></span>
            <span className="min-w-0"><span className="block text-[9px] font-bold uppercase text-white/90">Membership</span><span className="block text-lg font-black">{stats.member.subscriptionStatus}</span><span className="mt-2 block text-[9px] text-white/80">R{stats.member.subscriptionAmount.toFixed(2)} / month</span></span>
          </button>
        </div>
      </section>

      <section className="relative z-10 -mt-1 bg-[#f7f9fc] px-4 pb-5 dark:bg-[#05080d]">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white px-2 py-4 shadow-lg ring-1 ring-slate-200 dark:bg-[#0c131d] dark:ring-[#23466a]">
          {quickActions.map(({ label, sub, icon: Icon, view, tone }) => (
            <button key={label} onClick={() => setView(view)} className="flex min-w-0 flex-col items-center gap-1 text-center">
              <span className={`grid h-11 w-11 place-items-center rounded-full text-white shadow-md ${tone}`}><Icon className="h-5 w-5" /></span>
              <span className="mt-1 text-[10px] font-extrabold leading-tight text-slate-900 dark:text-white">{label}</span>
              <span className="text-[8px] leading-tight text-slate-500 dark:text-slate-400">{sub}</span>
            </button>
          ))}
        </div>

        <button onClick={() => setView("marketplace")} className="relative mt-4 flex min-h-[122px] w-full overflow-hidden rounded-2xl border-2 border-[#1497ff] bg-[#004ac8] p-5 text-left text-white shadow-lg">
          <Image src="/kasi-township-bg.png" alt="South African township" fill sizes="(max-width: 520px) 100vw, 520px" className="object-cover opacity-35" />
          <span className="relative z-10 max-w-[58%]"><span className="block text-xl font-black uppercase leading-[.95]">Shop smart.<br />Support local.<br />Earn more.</span><span className="mt-4 inline-flex items-center gap-1 rounded-md bg-[#ffd322] px-3 py-2 text-[10px] font-black text-slate-950">Explore marketplace <ArrowRight className="h-3 w-3" /></span></span>
          <ShoppingBasket className="absolute bottom-3 right-5 z-10 h-20 w-20 text-[#ff9e00] drop-shadow-xl" strokeWidth={1.6} />
        </button>

        <button onClick={() => setView("ecosystem")} className="relative mt-3 flex min-h-[105px] w-full overflow-hidden rounded-2xl bg-[#050608] p-4 text-left text-white shadow-lg ring-1 ring-slate-700">
          <Image src="/kasi-energy-bg.webp" alt="KaSiHUB membership energy" fill sizes="(max-width: 520px) 100vw, 520px" priority className="object-cover opacity-35" />
          <span className="relative z-10 max-w-[64%]"><span className="block text-sm font-black"><span className="text-[#ffad00]">KaSiHuB</span> MEMBERSHIP</span><span className="mt-2 block text-[10px] leading-relaxed text-white/70">Unlock exclusive benefits, cashback, and partner discounts.</span><span className="mt-3 inline-flex rounded bg-[#087fe8] px-3 py-1.5 text-[9px] font-black">View benefits</span></span>
          <Crown className="absolute bottom-4 right-6 z-10 h-16 w-16 text-[#ffc400]" strokeWidth={1.4} />
        </button>

        <div className="mt-4 flex items-center justify-between"><h3 className="text-xs font-black text-slate-900 dark:text-white">Popular categories</h3><button onClick={() => setView("marketplace")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400">View all</button></div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {categories.map(({ label, icon: Icon, color }) => <button key={label} onClick={() => setView("marketplace")} className="flex min-w-0 flex-col items-center rounded-xl bg-white px-1 py-2 shadow-sm ring-1 ring-slate-200 dark:bg-[#0c131d] dark:ring-[#23466a]"><Icon className={`h-7 w-7 ${color}`} /><span className="mt-1 text-[7px] font-bold leading-tight text-slate-700 dark:text-slate-200">{label}</span></button>)}
        </div>
      </section>
    </div>
  );
}
