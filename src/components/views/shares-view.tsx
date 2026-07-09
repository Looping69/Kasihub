"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins, TrendingUp, Award, FileText, Loader2, Sparkles, DollarSign,
  Check, Lock, ArrowUpRight, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useKasiStore } from "@/lib/store";
import type { Share, SharePhase } from "@/lib/types";
import { toast } from "sonner";

interface SharesData {
  phases: SharePhase[];
  shares: Share[];
  totalShares: number;
  totalValue: number;
  dailyDividendPerShare: number;
  myDailyDividend: number;
  totalSharesOutstanding: number;
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
  const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtRand = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        <Button onClick={() => setBuyOpen(true)} disabled={!activePhase} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
          <Coins className="h-4 w-4 mr-1.5" /> Buy shares
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Your shares</p>
            <Coins className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black mt-1">{data.totalShares}</p>
          <p className="text-[10px] text-muted-foreground mt-1">across {data.shares.length} certificate{data.shares.length !== 1 ? "s" : ""}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total value</p>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black mt-1">{fmtUSD(data.totalValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">purchase value</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Daily dividend</p>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black mt-1 text-emerald-600">{fmtUSD(data.myDailyDividend)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">from KasiMall profits</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Per share / day</p>
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black mt-1">{fmtUSD(data.dailyDividendPerShare)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.totalSharesOutstanding.toLocaleString()} shares outstanding</p>
        </Card>
      </div>

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

      {/* Certificates */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Your certificates
            </h3>
            <p className="text-xs text-muted-foreground">Digital certificates are re-issued when you purchase more shares.</p>
          </div>
        </div>

        {data.shares.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold mb-1">No certificates yet</p>
            <p className="text-sm text-muted-foreground mb-4">Purchase your first shares to receive a digital certificate.</p>
            <Button onClick={() => setBuyOpen(true)} className="bg-gradient-to-r from-amber-500 to-amber-600">
              <Coins className="h-4 w-4 mr-1.5" /> Buy your first shares
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.shares.map((s) => (
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
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Issued {new Date(s.createdAt).toLocaleDateString("en-ZA")}
                    </span>
                    {s.prevCertificateNo && (
                      <span className="text-amber-700 dark:text-amber-400">Revoked: {s.prevCertificateNo}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
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
