"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Network, User, Coins, ShoppingBag,
  Building2, Landmark, LogOut, Menu, X, Bell, Search,
  ChevronRight, Wallet, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useKasiStore } from "@/lib/store";
import type { ViewKey } from "@/lib/types";
import { DashboardView } from "@/components/views/dashboard-view";
import { EcosystemView } from "@/components/views/ecosystem-view";
import { ProfileView } from "@/components/views/profile-view";
import { SharesView } from "@/components/views/shares-view";
import { MarketplaceView } from "@/components/views/marketplace-view";
import { MallView } from "@/components/views/mall-view";
import { RootsBankView } from "@/components/views/rootsbank-view";

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Stats & overview" },
  { key: "ecosystem", label: "Ecosystem", icon: Network, desc: "5×6 forced matrix" },
  { key: "profile", label: "Profile", icon: User, desc: "KYC & details" },
  { key: "shares", label: "KasiShares", icon: Coins, desc: "Buy & dividends" },
  { key: "marketplace", label: "Marketplace", icon: ShoppingBag, desc: "Products & services" },
  { key: "mall", label: "KasiMall", icon: Building2, desc: "Cashless mall" },
  { key: "rootsbank", label: "Roots Bank", icon: Landmark, desc: "Pioneer shares" },
];

export function AppShell() {
  const { currentMember, activeView, setView, logout, sidebarOpen, setSidebarOpen } = useKasiStore();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!currentMember) return;
    async function load() {
      try {
        const res = await fetch(`/api/dashboard?memberId=${currentMember!.id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setWalletBalance(data.totalEarnings);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [currentMember, activeView]);

  const activeNav = NAV.find((n) => n.key === activeView) || NAV[0];

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30 bg-sidebar text-sidebar-foreground">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetHeader className="p-4 border-b border-sidebar-border">
            <SheetTitle className="text-sidebar-foreground">KaSiHUB Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent mobile />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>KaSiHUB</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{activeNav.label}</span>
                </div>
                <h1 className="font-bold text-base sm:text-lg leading-tight truncate">{activeNav.desc}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Wallet balance */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <div className="leading-none">
                  <p className="text-[10px] text-muted-foreground">Wallet</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {walletBalance !== null ? `R ${walletBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
              </Button>

              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9 border-2 border-emerald-200 dark:border-emerald-900">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-amber-500 text-white text-xs font-bold">
                    {currentMember?.firstName?.[0]}{currentMember?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block leading-none">
                  <p className="text-sm font-semibold">{currentMember?.firstName} {currentMember?.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{currentMember?.profileNumber}</p>
                </div>
              </div>

              <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {activeView === "dashboard" && <DashboardView />}
              {activeView === "ecosystem" && <EcosystemView />}
              {activeView === "profile" && <ProfileView />}
              {activeView === "shares" && <SharesView />}
              {activeView === "marketplace" && <MarketplaceView />}
              {activeView === "mall" && <MallView />}
              {activeView === "rootsbank" && <RootsBankView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ mobile = false }: { mobile?: boolean }) {
  const { activeView, setView, currentMember, logout } = useKasiStore();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`p-5 ${mobile ? "hidden" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500" />
            <div className="absolute inset-0.5 rounded-[10px] bg-sidebar flex items-center justify-center">
              <span className="text-xl font-black bg-gradient-to-br from-emerald-400 to-amber-400 bg-clip-text text-transparent">K</span>
            </div>
          </div>
          <div>
            <p className="font-black text-lg leading-none text-sidebar-foreground">KaSiHUB</p>
            <p className="text-[10px] text-sidebar-foreground/60 leading-none mt-0.5">Hybrid Ecosystem</p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-kasi">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Menu</p>
        {NAV.map((item) => {
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-emerald-900/20"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`h-4.5 w-4.5 flex-shrink-0 ${active ? "" : "group-hover:scale-110 transition-transform"}`} />
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium leading-none">{item.label}</p>
                <p className={`text-[10px] mt-1 ${active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/50"}`}>{item.desc}</p>
              </div>
              {active && <ChevronRight className="h-4 w-4" />}
            </button>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Member card */}
      <div className="p-3">
        <div className="rounded-xl bg-sidebar-accent p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-semibold text-sidebar-foreground">KYC Verified</p>
            <Badge variant="outline" className="ml-auto text-[9px] py-0 h-4 border-emerald-400/50 text-emerald-300 bg-emerald-500/10">
              {currentMember?.kycStatus}
            </Badge>
          </div>
          <p className="text-[10px] text-sidebar-foreground/60 leading-relaxed">
            Profile: <span className="font-mono text-sidebar-foreground/90">{currentMember?.profileNumber}</span>
          </p>
          <p className="text-[10px] text-sidebar-foreground/60 leading-relaxed">
            NFC Tag: <span className="font-mono text-sidebar-foreground/90">{currentMember?.nfcTagId}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full mt-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}
