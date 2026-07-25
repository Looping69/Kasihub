"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Loader2, QrCode, Wallet, PieChart, ShoppingBag,
  Store, TrendingUp, Info, Users, MapPin, Construction,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKasiStore } from "@/lib/store";

interface MallData {
  nfcTagId: string | null;
  transactions: {
    id: string;
    storeName: string;
    amount: number;
    costOfSale: number;
    vat: number;
    sharePool: number;
    kasiPool: number;
    createdAt: string;
  }[];
  totals: { amount: number; costOfSale: number; vat: number; sharePool: number; kasiPool: number };
  silos: { name: string; pct: number; color: string; description: string }[];
  mallProgress: number;
  memberCount: number;
  mallThreshold: number;
}

export function MallView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<MallData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) return;
    async function load() {
      try {
        const res = await fetch(`/api/mall?memberId=${currentMember!.id}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentMember]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-rose-600" />
          <h2 className="text-2xl font-black tracking-tight">KasiMall</h2>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Construction className="h-3 w-3 mr-1" /> Phase 2
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Physical cashless malls owned & operated by KasiMall Co. Built once {data.mallThreshold.toLocaleString()} members register in an area.
        </p>
      </div>

      {/* NFC Tag card */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-500/10 to-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative grid sm:grid-cols-2 gap-6 items-center">
          <div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 mb-3">
              <QrCode className="h-3 w-3 mr-1" /> Your NFC Tag
            </Badge>
            <h3 className="text-xl font-black mb-1">Cashless payments, instant splits.</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Tap your NFC Tag at any KasiMall store to pay instantly from your Roots Bank account.
              Every payment is split in real time across the cost, VAT, SharePool and KasiPool silos.
            </p>
            <div className="rounded-xl bg-gradient-to-br from-rose-600 to-amber-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-100">NFC Tag ID</p>
                  <p className="font-mono font-bold">{data.nfcTagId || "Not assigned"}</p>
                </div>
                <QrCode className="h-10 w-10 text-white/80" />
              </div>
            </div>
          </div>

          {/* Mall progress */}
          <Card className="p-5 bg-muted/30 border-dashed">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-emerald-600" />
              <p className="font-semibold text-sm">Mall construction threshold</p>
            </div>
            <p className="text-2xl font-black mb-1">{data.memberCount.toLocaleString()} / {data.mallThreshold.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mb-3">members registered in your area</p>
            <Progress value={data.mallProgress} className="h-2" />
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Soweto zone · {data.mallProgress.toFixed(1)}% to construction</span>
            </div>
          </Card>
        </div>
      </Card>

      {/* Smart contract silos — moved to Admin dashboard */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
            <PieChart className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">Smart-contract silo splits</p>
            <p className="text-xs text-muted-foreground">
              The Exco-editable silo split configuration (Cost of Sale, VAT, SharePool, KasiPool) is managed in the Admin dashboard under KasiMall.
            </p>
          </div>
        </div>
      </Card>

      {/* Recent mall transactions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600" /> Your KasiMall transactions
            </h3>
            <p className="text-xs text-muted-foreground">Recent NFC-tag payments at KasiMall stores</p>
          </div>
        </div>

        {data.transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
              <Store className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold mb-1">No mall transactions yet</p>
            <p className="text-sm text-muted-foreground">KasiMalls open once 5,000 members register in your area.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-kasi">
            {data.transactions.map((t) => (
              <div key={t.id} className="p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.storeName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </div>
                  <p className="text-lg font-black">{fmt(t.amount)}</p>
                </div>
                <TooltipProvider>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {[
                      { label: "Cost", value: t.costOfSale, color: "oklch(0.55 0.08 50)" },
                      { label: "VAT", value: t.vat, color: "oklch(0.65 0.18 145)" },
                      { label: "SharePool", value: t.sharePool, color: "oklch(0.75 0.15 80)" },
                      { label: "KasiPool", value: t.kasiPool, color: "oklch(0.52 0.13 158)" },
                    ].map((s) => (
                      <Tooltip key={s.label}>
                        <TooltipTrigger asChild>
                          <div className="text-center p-1.5 rounded bg-muted/40">
                            <p className="text-muted-foreground">{s.label}</p>
                            <p className="font-semibold font-mono" style={{ color: s.color }}>R{s.value.toFixed(0)}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{s.label}: R {s.value.toFixed(2)}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Stores preview */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold">KasiMall stores</h3>
            <p className="text-xs text-muted-foreground">All stores are owned and managed by KasiMall Co.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["KasiGrocer", "KasiBakery", "KasiButchery", "KasiFresh Produce", "KasiPharmacy", "KasiFashion", "KasiElectronics", "KasiCafe"].map((s) => (
            <div key={s} className="p-3 rounded-lg bg-card border border-border/60 text-center">
              <Store className="h-5 w-5 mx-auto mb-1 text-rose-600" />
              <p className="text-xs font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Info */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5 text-rose-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-2">About KasiMall</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><TrendingUp className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Malls are built in designated areas once 5,000 KasiHub members register.</li>
              <li className="flex items-start gap-2"><Wallet className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> 100% Cashless — pay with your KaSiPay Gini App.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
