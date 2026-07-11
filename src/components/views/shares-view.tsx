"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins, TrendingUp, Award, FileText, Loader2, Sparkles, DollarSign,
  Check, Lock, Calendar, Printer, Gem,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useKasiStore } from "@/lib/store";
import type { Share, SharePhase, AureusShare, Member } from "@/lib/types";
import { toast } from "sonner";

interface SharesData {
  phases: SharePhase[];
  activeShares: Share[];
  retractedShares: Share[];
  aureusShares: AureusShare[];
  retractedAureusShares: AureusShare[];
  totalShares: number;
  totalValue: number; // = totalShares × shareValuePerShare
  shareValuePerShare: number; // $39.95
  aureusValuePerShare: number; // $15.00
  aureusTotalShares: number;
  aureusTotalValue: number;
  dailyDividendPerShare: number;
  myDailyDividend: number;
  totalSharesOutstanding: number;
}

/** Derive a printable display name from a Member record. */
function memberDisplayName(member: Member | null): string {
  if (!member) return "—";
  const isCompany =
    member.membershipType === "COMPANY" ||
    member.membershipType === "NPO_NGO" ||
    member.membershipType === "SOLE_PROPRIETOR";
  if (isCompany && member.companyName) return member.companyName;
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return member.email;
}

/** Open a new window with a printable KasiShare certificate and call print(). */
function printKasiCertificate(share: Share, memberName: string) {
  const issued = new Date(share.createdAt).toLocaleDateString("en-ZA", {
    year: "numeric", month: "long", day: "numeric",
  });
  const total = (share.totalAmount ?? 0).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
  const perShare = (share.pricePerShare ?? 0).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>KaSiHUB Share Certificate ${share.certificateNo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; padding: 40px; background: #f5f5f4; color: #1c1917; margin: 0; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .cert {
    position: relative;
    border: 8px double #059669;
    padding: 48px 56px;
    background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
    box-shadow: 0 4px 24px rgba(5,150,105,0.15);
  }
  .cert::before {
    content: ""; position: absolute; inset: 12px;
    border: 2px solid #f59e0b; pointer-events: none;
  }
  .corner { position: absolute; width: 40px; height: 40px; border: 3px solid #d97706; }
  .corner.tl { top: 22px; left: 22px; border-right: none; border-bottom: none; }
  .corner.tr { top: 22px; right: 22px; border-left: none; border-bottom: none; }
  .corner.bl { bottom: 22px; left: 22px; border-right: none; border-top: none; }
  .corner.br { bottom: 22px; right: 22px; border-left: none; border-top: none; }
  .head { text-align: center; margin-bottom: 24px; }
  .brand { font-size: 14px; letter-spacing: 4px; color: #d97706; text-transform: uppercase; font-weight: bold; }
  h1 { color: #047857; font-size: 32px; margin: 8px 0 4px; letter-spacing: 1px; }
  .sub { color: #6b7280; font-size: 13px; font-style: italic; }
  .seal {
    width: 88px; height: 88px; border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #fbbf24, #d97706);
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 11px; text-align: center; line-height: 1.2;
    margin: 0 auto 24px; box-shadow: 0 2px 8px rgba(217,119,6,0.4);
    border: 3px solid #fff; outline: 2px solid #d97706;
  }
  .intro { text-align: center; font-size: 14px; color: #374151; margin-bottom: 24px; line-height: 1.6; }
  .name { text-align: center; font-size: 22px; font-weight: bold; color: #1c1917; margin: 4px 0 24px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; margin-bottom: 24px; }
  .field { border-bottom: 1px dashed #9ca3af; padding-bottom: 6px; }
  .label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; margin-bottom: 2px; }
  .value { font-size: 16px; font-weight: bold; color: #111827; }
  .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #d1d5db; }
  .footer .co { font-size: 13px; font-weight: bold; color: #047857; }
  .footer .legal { font-size: 10px; color: #9ca3af; margin-top: 4px; line-height: 1.5; }
  @media print { body { background: #fff; padding: 0; } .cert { box-shadow: none; } }
</style></head><body><div class="wrap">
  <div class="cert">
    <span class="corner tl"></span><span class="corner tr"></span>
    <span class="corner bl"></span><span class="corner br"></span>
    <div class="head">
      <div class="brand">Solidus Holdings (Pty) Ltd</div>
      <h1>KaSiHUB Share Certificate</h1>
      <div class="sub">Class B Private Shares</div>
    </div>
    <div class="seal">OFFICIAL<br/>SEAL</div>
    <p class="intro">This is to certify that</p>
    <div class="name">${memberName}</div>
    <p class="intro">is the registered holder of <strong>${share.quantity}</strong> KasiShare(s) in the KaSiHUB private offering, subject to the terms and conditions of Solidus Holdings (Pty) Ltd.</p>
    <div class="grid">
      <div class="field"><div class="label">Certificate No.</div><div class="value">${share.certificateNo}</div></div>
      <div class="field"><div class="label">Phase</div><div class="value">Phase ${share.phase}</div></div>
      <div class="field"><div class="label">Number of Shares</div><div class="value">${share.quantity}</div></div>
      <div class="field"><div class="label">Price per Share</div><div class="value">${perShare}</div></div>
      <div class="field"><div class="label">Total Amount</div><div class="value">${total}</div></div>
      <div class="field"><div class="label">Date Issued</div><div class="value">${issued}</div></div>
    </div>
    <div class="footer">
      <div class="co">Solidus Holdings (Pty) Ltd</div>
      <div class="legal">This certificate is non-transferable and represents a private shareholding. Dividends are declared at the discretion of KasiMall from daily profits. The holder must maintain KaSiHUB membership to receive payouts.</div>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</div></body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    toast.error("Pop-up blocked. Please allow pop-ups to print the certificate.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Open a new window with a printable Aureus certificate and call print(). */
function printAureusCertificate(share: AureusShare, memberName: string) {
  const issued = new Date(share.createdAt).toLocaleDateString("en-ZA", {
    year: "numeric", month: "long", day: "numeric",
  });
  const total = (share.totalAmount ?? 0).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
  const perShare = (share.pricePerShare ?? 0).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Aureus Share Certificate ${share.certificateNo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; padding: 40px; background: #f5f5f4; color: #1c1917; margin: 0; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .cert {
    position: relative;
    border: 8px double #b45309;
    padding: 48px 56px;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    box-shadow: 0 4px 24px rgba(180,83,9,0.18);
  }
  .cert::before {
    content: ""; position: absolute; inset: 12px;
    border: 2px solid #92400e; pointer-events: none;
  }
  .corner { position: absolute; width: 40px; height: 40px; border: 3px solid #92400e; }
  .corner.tl { top: 22px; left: 22px; border-right: none; border-bottom: none; }
  .corner.tr { top: 22px; right: 22px; border-left: none; border-bottom: none; }
  .corner.bl { bottom: 22px; left: 22px; border-right: none; border-top: none; }
  .corner.br { bottom: 22px; right: 22px; border-left: none; border-top: none; }
  .head { text-align: center; margin-bottom: 24px; }
  .brand { font-size: 14px; letter-spacing: 4px; color: #92400e; text-transform: uppercase; font-weight: bold; }
  h1 { color: #92400e; font-size: 32px; margin: 8px 0 4px; letter-spacing: 1px; }
  .sub { color: #6b7280; font-size: 13px; font-style: italic; }
  .seal {
    width: 88px; height: 88px; border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #fde68a, #b45309);
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 11px; text-align: center; line-height: 1.2;
    margin: 0 auto 24px; box-shadow: 0 2px 8px rgba(180,83,9,0.4);
    border: 3px solid #fff; outline: 2px solid #92400e;
  }
  .intro { text-align: center; font-size: 14px; color: #374151; margin-bottom: 24px; line-height: 1.6; }
  .name { text-align: center; font-size: 22px; font-weight: bold; color: #1c1917; margin: 4px 0 24px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; margin-bottom: 24px; }
  .field { border-bottom: 1px dashed #9ca3af; padding-bottom: 6px; }
  .label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; margin-bottom: 2px; }
  .value { font-size: 16px; font-weight: bold; color: #111827; }
  .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #d1d5db; }
  .footer .co { font-size: 13px; font-weight: bold; color: #92400e; }
  .footer .legal { font-size: 10px; color: #9ca3af; margin-top: 4px; line-height: 1.5; }
  @media print { body { background: #fff; padding: 0; } .cert { box-shadow: none; } }
</style></head><body><div class="wrap">
  <div class="cert">
    <span class="corner tl"></span><span class="corner tr"></span>
    <span class="corner bl"></span><span class="corner br"></span>
    <div class="head">
      <div class="brand">Solidus Holdings (Pty) Ltd</div>
      <h1>Aureus Share Certificate</h1>
      <div class="sub">Private Aureus Shareholding</div>
    </div>
    <div class="seal">AUREUS<br/>SEAL</div>
    <p class="intro">This is to certify that</p>
    <div class="name">${memberName}</div>
    <p class="intro">is the registered holder of <strong>${share.quantity}</strong> Aureus Share(s) issued by Solidus Holdings (Pty) Ltd.</p>
    <div class="grid">
      <div class="field"><div class="label">Certificate No.</div><div class="value">${share.certificateNo}</div></div>
      <div class="field"><div class="label">Phase</div><div class="value">Phase ${share.phase}</div></div>
      <div class="field"><div class="label">Number of Shares</div><div class="value">${share.quantity}</div></div>
      <div class="field"><div class="label">Price per Share</div><div class="value">${perShare}</div></div>
      <div class="field"><div class="label">Total Amount</div><div class="value">${total}</div></div>
      <div class="field"><div class="label">Date Issued</div><div class="value">${issued}</div></div>
    </div>
    <div class="footer">
      <div class="co">Solidus Holdings (Pty) Ltd</div>
      <div class="legal">This certificate is non-transferable and represents a private Aureus shareholding. The holder must maintain KaSiHUB membership to retain this shareholding.</div>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</div></body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    toast.error("Pop-up blocked. Please allow pop-ups to print the certificate.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function SharesView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<SharesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number>(1);
  const [quantity, setQuantity] = useState(10);
  const [buying, setBuying] = useState(false);

  async function load() {
    if (!currentMember) return;
    try {
      const res = await fetch(`/api/shares?memberId=${currentMember.id}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [currentMember]);

  async function handleBuy() {
    if (!currentMember) return;
    setBuying(true);
    try {
      const res = await fetch("/api/shares/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id, phase: selectedPhase, quantity }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Purchase failed");
      } else {
        toast.success(`Purchased ${quantity} share${quantity > 1 ? "s" : ""}! Certificate ${result.certificateNo} issued.`);
        setBuyOpen(false);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBuying(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activePhase = data.phases.find((p) => p.status === "OPEN");
  const fmtUSD = (n: number) => `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const memberName = memberDisplayName(currentMember);

  const kasiActiveCount = data.activeShares.length;
  const kasiRetractedCount = data.retractedShares.length;
  const aureusActiveCount = data.aureusShares.length;
  const aureusRetractedCount = data.retractedAureusShares.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Coins className="h-5 w-5 text-amber-600" />
            <h2 className="text-2xl font-black tracking-tight">KasiShares</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Class B private shares sold by Solidus Holdings (Pty) Ltd. Daily dividends from KasiMall profits.
          </p>
        </div>
        <Button
          onClick={() => setBuyOpen(true)}
          disabled={!activePhase}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
        >
          <Coins className="h-4 w-4 mr-1.5" /> Buy shares
        </Button>
      </div>

      {/* KasiShares stats — value × shares = total (visual equation) */}
      <Card className="p-5 border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/60 via-emerald-50/30 to-amber-50/60 dark:from-amber-950/20 dark:via-emerald-950/10 dark:to-amber-950/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Coins className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">KasiShares holdings</p>
              <p className="text-[10px] text-muted-foreground">Current share value</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
            <Sparkles className="h-3 w-3 mr-1" /> {fmtUSD(data.shareValuePerShare)} / share
          </Badge>
        </div>

        {/* Equation row: shares × value = total */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 sm:gap-3 items-center">
          <div className="rounded-lg bg-white/70 dark:bg-card/60 p-3 text-center border border-amber-100 dark:border-amber-900/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your shares</p>
            <p className="text-2xl font-black mt-0.5">{data.totalShares}</p>
            <p className="text-[10px] text-muted-foreground">{kasiActiveCount} certificate{kasiActiveCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="hidden sm:flex items-center justify-center text-amber-600 font-black text-xl">×</div>
          <div className="rounded-lg bg-white/70 dark:bg-card/60 p-3 text-center border border-amber-100 dark:border-amber-900/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Share value</p>
            <p className="text-2xl font-black mt-0.5 text-amber-600">{fmtUSD(data.shareValuePerShare)}</p>
            <p className="text-[10px] text-muted-foreground">per share</p>
          </div>
          <div className="hidden sm:flex items-center justify-center text-amber-600 font-black text-xl">=</div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center border-2 border-emerald-200 dark:border-emerald-900">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total value</p>
            <p className="text-2xl font-black mt-0.5 text-emerald-600">{fmtUSD(data.totalValue)}</p>
            <p className="text-[10px] text-muted-foreground">at current rate</p>
          </div>
        </div>

        {/* Dividend mini-row */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 p-3 border border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Your daily dividend</p>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-lg font-black text-emerald-600 mt-0.5">{fmtUSD(data.myDailyDividend)}</p>
          </div>
          <div className="rounded-lg bg-white/70 dark:bg-card/60 p-3 border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Per share / day</p>
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-lg font-black mt-0.5">{fmtUSD(data.dailyDividendPerShare)}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{data.totalSharesOutstanding.toLocaleString()} shares outstanding</p>
          </div>
        </div>
      </Card>

      {/* Aureus Shares section */}
      <Card className="p-5 border-2 border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50/60 via-amber-50/30 to-orange-50/60 dark:from-orange-950/20 dark:via-amber-950/10 dark:to-orange-950/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-700 flex items-center justify-center">
              <Gem className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Aureus Shares</p>
              <p className="text-[10px] text-muted-foreground">Private gold-tier shareholding</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900">
            <Gem className="h-3 w-3 mr-1" /> {fmtUSD(data.aureusValuePerShare)} / share
          </Badge>
        </div>

        {/* Equation row */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 sm:gap-3 items-center">
          <div className="rounded-lg bg-white/70 dark:bg-card/60 p-3 text-center border border-orange-100 dark:border-orange-900/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your shares</p>
            <p className="text-2xl font-black mt-0.5">{data.aureusTotalShares}</p>
            <p className="text-[10px] text-muted-foreground">{aureusActiveCount} certificate{aureusActiveCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="hidden sm:flex items-center justify-center text-orange-600 font-black text-xl">×</div>
          <div className="rounded-lg bg-white/70 dark:bg-card/60 p-3 text-center border border-orange-100 dark:border-orange-900/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Share value</p>
            <p className="text-2xl font-black mt-0.5 text-orange-600">{fmtUSD(data.aureusValuePerShare)}</p>
            <p className="text-[10px] text-muted-foreground">per share</p>
          </div>
          <div className="hidden sm:flex items-center justify-center text-orange-600 font-black text-xl">=</div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center border-2 border-amber-200 dark:border-amber-900">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total value</p>
            <p className="text-2xl font-black mt-0.5 text-amber-600">{fmtUSD(data.aureusTotalValue)}</p>
            <p className="text-[10px] text-muted-foreground">at current rate</p>
          </div>
        </div>
      </Card>

      {/* Phases */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Share phases</h3>
            <p className="text-xs text-muted-foreground">Each phase has a set number of shares at a fixed price. Next phase opens when current sells out.</p>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Sparkles className="h-3 w-3 mr-1" /> Phase 1 BOGO
          </Badge>
        </div>

        <div className="space-y-3">
          {data.phases.map((p) => {
            const soldPct = (p.soldShares / p.totalShares) * 100;
            const isOpen = p.status === "OPEN";
            return (
              <motion.div
                key={p.phase}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isOpen ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${
                      isOpen ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {p.phase}
                    </div>
                    <div>
                      <p className="font-bold text-sm">Phase {p.phase}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtUSD(p.pricePerShare)} per share
                        {p.bonusBuyOneGet && <span className="ml-2 text-amber-600 font-semibold">· Buy One Get One Free</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isOpen ? "default" : "outline"} className={isOpen ? "bg-amber-500" : ""}>
                      {p.status === "OPEN" && "Open"}
                      {p.status === "UPCOMING" && "Upcoming"}
                      {p.status === "SOLD_OUT" && "Sold out"}
                    </Badge>
                    {isOpen && (
                      <Button size="sm" onClick={() => { setSelectedPhase(p.phase); setBuyOpen(true); }}>
                        Buy
                      </Button>
                    )}
                    {!isOpen && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{p.soldShares.toLocaleString()} / {p.totalShares.toLocaleString()} sold</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">{soldPct.toFixed(1)}%</span>
                </div>
                <Progress value={soldPct} className="h-1.5 mt-1.5" />
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Certificates with tabs */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Your certificates
            </h3>
            <p className="text-xs text-muted-foreground">Digital certificates are re-issued when you purchase more shares. Retracted certificates are kept as historical records.</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active" className="data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400">
              <Award className="h-3.5 w-3.5 mr-1.5" />
              Active
              {(kasiActiveCount + aureusActiveCount) > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{kasiActiveCount + aureusActiveCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="retracted" className="data-[state=active]:bg-rose-50 dark:data-[state=active]:bg-rose-950/40 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Retracted
              {(kasiRetractedCount + aureusRetractedCount) > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{kasiRetractedCount + aureusRetractedCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active tab */}
          <TabsContent value="active" className="mt-4 space-y-5">
            {kasiActiveCount === 0 && aureusActiveCount === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-semibold mb-1">No active certificates yet</p>
                <p className="text-sm text-muted-foreground mb-4">Purchase your first shares to receive a digital certificate.</p>
                <Button onClick={() => setBuyOpen(true)} className="bg-gradient-to-r from-amber-500 to-amber-600">
                  <Coins className="h-4 w-4 mr-1.5" /> Buy your first shares
                </Button>
              </div>
            ) : (
              <>
                {/* Active KasiShare certificates */}
                {kasiActiveCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">KasiShare certificates</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.activeShares.map((s) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded-xl border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 via-emerald-50/40 to-amber-50 dark:from-amber-950/30 dark:via-emerald-950/20 dark:to-amber-950/30 p-5 overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl translate-x-1/3 -translate-y-1/3" />
                          <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">KasiShares Certificate</p>
                                <p className="font-mono text-xs text-muted-foreground mt-0.5">{s.certificateNo}</p>
                              </div>
                              <Award className="h-8 w-8 text-amber-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Phase</p>
                                <p className="text-lg font-black">{s.phase}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Shares</p>
                                <p className="text-lg font-black">{s.quantity}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Price/share</p>
                                <p className="text-sm font-bold">{fmtUSD(s.pricePerShare)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Total paid</p>
                                <p className="text-sm font-bold">{fmtUSD(s.totalAmount)}</p>
                              </div>
                            </div>
                            <Separator className="my-3 bg-amber-200 dark:bg-amber-900" />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Issued {new Date(s.createdAt).toLocaleDateString("en-ZA")}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printKasiCertificate(s, memberName)}
                                className="h-7 gap-1 text-[11px] border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40"
                              >
                                <Printer className="h-3 w-3" /> Print
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Aureus certificates */}
                {aureusActiveCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gem className="h-3.5 w-3.5 text-orange-600" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aureus certificates</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.aureusShares.map((s) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded-xl border-2 border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 via-amber-50/40 to-orange-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 p-5 overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl translate-x-1/3 -translate-y-1/3" />
                          <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-orange-700 dark:text-orange-400 font-semibold">Aureus Certificate</p>
                                <p className="font-mono text-xs text-muted-foreground mt-0.5">{s.certificateNo}</p>
                              </div>
                              <Gem className="h-8 w-8 text-orange-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Phase</p>
                                <p className="text-lg font-black">{s.phase}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Shares</p>
                                <p className="text-lg font-black">{s.quantity}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Price/share</p>
                                <p className="text-sm font-bold">{fmtUSD(s.pricePerShare)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Total paid</p>
                                <p className="text-sm font-bold">{fmtUSD(s.totalAmount)}</p>
                              </div>
                            </div>
                            <Separator className="my-3 bg-orange-200 dark:bg-orange-900" />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Issued {new Date(s.createdAt).toLocaleDateString("en-ZA")}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printAureusCertificate(s, memberName)}
                                className="h-7 gap-1 text-[11px] border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-400 dark:hover:bg-orange-950/40"
                              >
                                <Printer className="h-3 w-3" /> Print
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Retracted tab */}
          <TabsContent value="retracted" className="mt-4 space-y-5">
            {kasiRetractedCount === 0 && aureusRetractedCount === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-semibold mb-1">No retracted certificates</p>
                <p className="text-sm text-muted-foreground">When you purchase more shares, the previous certificate is revoked and kept here as a historical record.</p>
              </div>
            ) : (
              <>
                {/* Retracted KasiShare certificates */}
                {kasiRetractedCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revoked KasiShare certificates</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.retractedShares.map((s) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10 p-5 overflow-hidden opacity-70"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold line-through">KasiShares Certificate</p>
                              <p className="font-mono text-xs text-muted-foreground mt-0.5 line-through">{s.certificateNo}</p>
                            </div>
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
                              Revoked
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Phase</p>
                              <p className="text-lg font-black text-muted-foreground line-through">{s.phase}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Shares</p>
                              <p className="text-lg font-black text-muted-foreground line-through">{s.quantity}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Price/share</p>
                              <p className="text-sm font-bold text-muted-foreground">{fmtUSD(s.pricePerShare)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Total paid</p>
                              <p className="text-sm font-bold text-muted-foreground">{fmtUSD(s.totalAmount)}</p>
                            </div>
                          </div>
                          <Separator className="my-3 bg-muted-foreground/20" />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Issued {new Date(s.createdAt).toLocaleDateString("en-ZA")}
                            </span>
                            {s.prevCertificateNo && (
                              <span className="text-rose-700 dark:text-rose-400">Replaced by newer certificate</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retracted Aureus certificates */}
                {aureusRetractedCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gem className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retracted Aureus certificates</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.retractedAureusShares.map((s) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10 p-5 overflow-hidden opacity-70"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold line-through">Aureus Certificate</p>
                              <p className="font-mono text-xs text-muted-foreground mt-0.5 line-through">{s.certificateNo}</p>
                            </div>
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
                              Retracted
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Phase</p>
                              <p className="text-lg font-black text-muted-foreground line-through">{s.phase}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Shares</p>
                              <p className="text-lg font-black text-muted-foreground line-through">{s.quantity}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Price/share</p>
                              <p className="text-sm font-bold text-muted-foreground">{fmtUSD(s.pricePerShare)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Total paid</p>
                              <p className="text-sm font-bold text-muted-foreground">{fmtUSD(s.totalAmount)}</p>
                            </div>
                          </div>
                          <Separator className="my-3 bg-muted-foreground/20" />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Issued {new Date(s.createdAt).toLocaleDateString("en-ZA")}
                            </span>
                            {s.prevCertificateNo && (
                              <span className="text-rose-700 dark:text-rose-400">Replaced by newer certificate</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Info */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-2">About KasiShares</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Shares are a private offering by Solidus Holdings, not open to the public.</li>
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Income from shares funds KasiMall construction and operations.</li>
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Daily percentage of KasiMall profits shared equally between all sold shares.</li>
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Dividends declared from time to time by KasiMall, paid to Roots Bank accounts.</li>
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Must maintain KasiHub membership to receive dividends and daily payouts.</li>
              <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> When you buy more, the previous certificate is revoked and a new one issued.</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Buy dialog */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600" /> Buy KasiShares
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Phase</Label>
              <Select value={String(selectedPhase)} onValueChange={(v) => setSelectedPhase(parseInt(v))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.phases.filter((p) => p.status === "OPEN").map((p) => (
                    <SelectItem key={p.phase} value={String(p.phase)}>
                      Phase {p.phase} — {fmtUSD(p.pricePerShare)}/share {p.bonusBuyOneGet ? "(BOGO)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1.5"
              />
            </div>
            {(() => {
              const phase = data.phases.find((p) => p.phase === selectedPhase);
              if (!phase) return null;
              const total = phase.pricePerShare * quantity;
              const effective = phase.bonusBuyOneGet ? quantity * 2 : quantity;
              return (
                <Card className="p-4 bg-muted/30">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Price per share</span><span className="font-semibold">{fmtUSD(phase.pricePerShare)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="font-semibold">{quantity}</span></div>
                    {phase.bonusBuyOneGet && (
                      <div className="flex justify-between text-amber-600"><span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> BOGO bonus</span><span className="font-semibold">+{quantity} free</span></div>
                    )}
                    <Separator />
                    <div className="flex justify-between"><span className="text-muted-foreground">Total shares issued</span><span className="font-bold">{effective}</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Total cost</span><span className="font-bold text-amber-600">{fmtUSD(total)}</span></div>
                  </div>
                </Card>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={buying} className="bg-gradient-to-r from-amber-500 to-amber-600">
              {buying ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing...</> : <>Confirm purchase</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
