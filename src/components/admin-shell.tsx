"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Network, Coins, ShoppingBag, Building2,
  Droplets, Landmark, Settings, LogOut, Menu, Bell, ChevronRight,
  ShieldCheck, Crown, UserRound, ArrowLeftRight, Wallet, Ticket, UserPlus, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useKasiStore, type AdminViewKey } from "@/lib/store";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminMembers } from "@/components/admin/admin-members";
import { AdminMatrix } from "@/components/admin/admin-matrix";
import { AdminShares } from "@/components/admin/admin-shares";
import { AdminMarketplace } from "@/components/admin/admin-marketplace";
import { AdminMall } from "@/components/admin/admin-mall";
import { AdminPool } from "@/components/admin/admin-pool";
import { AdminRootsBank } from "@/components/admin/admin-rootsbank";
import { AdminVouchers } from "@/components/admin/admin-vouchers";
import { AdminReferrals } from "@/components/admin/admin-referrals";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminSettings } from "@/components/admin/admin-settings";
// Design Studio is intentionally dormant while its persistence path is stabilised.
// Restore its signed import, navigation entry and view together.
// Author: Klaasvaakie ( |╲ )
// import { AdminDesignSuite } from "@/components/admin/admin-design-suite";
import { BrandLogo } from "@/components/brand-logo";

const NAV: { key: AdminViewKey; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, desc: "Platform analytics" },
  { key: "members", label: "Members & KYC", icon: Users, desc: "Manage members" },
  { key: "matrix", label: "Eco-System", icon: Network, desc: "5×6 structure view" },
  { key: "shares", label: "KasiShares", icon: Coins, desc: "Phases & dividends" },
  { key: "marketplace", label: "Marketplace", icon: ShoppingBag, desc: "Products & orders" },
  { key: "mall", label: "KasiMall", icon: Building2, desc: "Transactions & silos" },
  { key: "pool", label: "KasiPool", icon: Droplets, desc: "Distributions & payouts" },
  { key: "rootsbank", label: "Roots Bank", icon: Landmark, desc: "Pioneer pool" },
  { key: "vouchers", label: "Vouchers", icon: Ticket, desc: "WABlast & vouchers" },
  { key: "referrals", label: "Referrals", icon: UserPlus, desc: "Enabler referrals" },
  { key: "notifications", label: "Notifications", icon: MessageCircle, desc: "WhatsApp reminders" },
  // { key: "design", label: "Design Suite", icon: Palette, desc: "App styling & themes" },
  { key: "settings", label: "Settings", icon: Settings, desc: "Exco config" },
];

export function AdminShell() {
  const { currentMember, adminView, logout, sidebarOpen, setSidebarOpen, setAdminMode } = useKasiStore();
  // Persisted Design Studio state must fall back safely while that surface is dormant.
  // Author: Klaasvaakie ( |╲ )
  const visibleAdminView = NAV.some((item) => item.key === adminView) ? adminView : "overview";
  const activeNav = NAV.find((n) => n.key === visibleAdminView) || NAV[0];

  return (
    <div className="min-h-screen flex bg-role-page">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30 bg-sidebar text-sidebar-foreground">
        <AdminSidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetHeader className="p-4 border-b border-sidebar-border">
            <SheetTitle className="text-sidebar-foreground">KaSiHUB Admin</SheetTitle>
          </SheetHeader>
          <AdminSidebarContent mobile />
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
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] h-4">
                    <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> ADMIN
                  </Badge>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{activeNav.label}</span>
                </div>
                <h1 className="font-bold text-base sm:text-lg leading-tight truncate">{activeNav.desc}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mode toggle */}
              <Button variant="outline" size="sm" onClick={() => setAdminMode(false)} className="hidden sm:inline-flex">
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Member view
              </Button>

              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              </Button>

              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9 border-2 border-amber-300">
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-600 text-white text-xs font-bold">
                    {currentMember?.firstName?.[0]}{currentMember?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block leading-none">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    {currentMember?.firstName} {currentMember?.lastName}
                    <Crown className="h-3 w-3 text-amber-500" />
                  </p>
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
              key={visibleAdminView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {visibleAdminView === "overview" && <AdminOverview />}
              {visibleAdminView === "members" && <AdminMembers />}
              {visibleAdminView === "matrix" && <AdminMatrix />}
              {visibleAdminView === "shares" && <AdminShares />}
              {visibleAdminView === "marketplace" && <AdminMarketplace />}
              {visibleAdminView === "mall" && <AdminMall />}
              {visibleAdminView === "pool" && <AdminPool />}
              {visibleAdminView === "rootsbank" && <AdminRootsBank />}
              {visibleAdminView === "vouchers" && <AdminVouchers />}
              {visibleAdminView === "referrals" && <AdminReferrals />}
              {visibleAdminView === "notifications" && <AdminNotifications />}
              {/* {adminView === "design" && <AdminDesignSuite />} */}
              {visibleAdminView === "settings" && <AdminSettings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function AdminSidebarContent({ mobile = false }: { mobile?: boolean }) {
  const { adminView, setAdminView, currentMember, logout, setAdminMode } = useKasiStore();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`px-5 py-3 ${mobile ? "hidden" : ""}`}>
        <BrandLogo className="h-16 w-full" priority />
        <p className="mt-1 text-center text-[10px] text-amber-400/90 font-semibold uppercase tracking-[0.18em]">Admin Portal</p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-kasi">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Management</p>
        {NAV.map((item) => {
          const active = adminView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setAdminView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-orange-950/20"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
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

      {/* Admin card + actions */}
      <div className="p-3 space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdminMode(false)}
          className="w-full bg-transparent border-sidebar-border text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground justify-start"
        >
          <UserRound className="h-4 w-4 mr-2" /> Switch to member view
        </Button>
        <div className="rounded-xl bg-sidebar-accent p-3">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-sidebar-foreground">Exco Administrator</p>
          </div>
          <p className="text-[10px] text-sidebar-foreground/60 leading-relaxed">
            {currentMember?.firstName} {currentMember?.lastName}
          </p>
          <p className="text-[10px] text-sidebar-foreground/60 font-mono">{currentMember?.profileNumber}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}
