"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ticket, Loader2, Clock, CheckCircle2, XCircle, Send, Zap,
  Calendar, Wallet, AlertTriangle, MessageCircle, Gift,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useKasiStore } from "@/lib/store";
import { toast } from "sonner";

interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  provider: string;
  value: number;
  category: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  anniversaryDate: string | null;
  wablastSent: boolean;
  expiringSent: boolean;
  daysToExpiry: number;
}

interface VoucherData {
  vouchers: Voucher[];
  active: number;
  expiringSoon: number;
  expired: number;
  totalValue: number;
}

export function VouchersView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<VoucherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<"active" | "expiring" | null>(null);

  async function load() {
    if (!currentMember) return;
    try {
      const res = await fetch(`/api/vouchers?memberId=${currentMember.id}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentMember]);

  async function pushActive() {
    if (!currentMember) return;
    setPushing("active");
    try {
      const res = await fetch("/api/vouchers/wablast-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Push failed");
      } else {
        toast.success(result.message);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPushing(null);
    }
  }

  async function pushExpiring() {
    if (!currentMember) return;
    setPushing("expiring");
    try {
      const res = await fetch("/api/vouchers/wablast-expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Push failed");
      } else {
        toast.success(result.message);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPushing(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const active = data.vouchers.filter((v) => v.status === "ACTIVE" && v.daysToExpiry > 0);
  const expiring = active.filter((v) => v.daysToExpiry <= 5);
  const expired = data.vouchers.filter((v) => v.status === "EXPIRED" || v.daysToExpiry <= 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Ticket className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-black tracking-tight">My Vouchers</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your voucher wallet. Vouchers are pushed to your WhatsApp via WABlast.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Active vouchers</p><Ticket className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-2xl font-black mt-1">{data.active}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total value</p><Wallet className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-2xl font-black mt-1 text-emerald-600">{fmt(data.totalValue)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Expiring soon</p><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
          <p className="text-2xl font-black mt-1 text-amber-600">{data.expiringSoon}</p>
          <p className="text-[10px] text-muted-foreground mt-1">within 5 days</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Expired</p><XCircle className="h-4 w-4 text-rose-600" /></div>
          <p className="text-2xl font-black mt-1 text-rose-600">{data.expired}</p>
        </Card>
      </div>

      {/* WABlast push actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">Push active vouchers</p>
                <p className="text-xs text-emerald-50">Send all active vouchers to your WhatsApp</p>
              </div>
            </div>
            <p className="text-xs text-emerald-100 mb-4">
              Pushes all your active vouchers to WABlast, which delivers them directly to your WhatsApp number ({currentMember?.mobile}).
            </p>
            <Button variant="secondary" size="sm" onClick={pushActive} disabled={pushing === "active"} className="w-full">
              {pushing === "active" ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Pushing...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />Push to WhatsApp</>}
            </Button>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">Push expiring vouchers</p>
                <p className="text-xs text-amber-50">5 days before anniversary expiry</p>
              </div>
            </div>
            <p className="text-xs text-amber-100 mb-4">
              Sends a high-priority WhatsApp reminder with all valid vouchers expiring within 5 days of their anniversary date.
            </p>
            <Button variant="secondary" size="sm" onClick={pushExpiring} disabled={pushing === "expiring"} className="w-full">
              {pushing === "expiring" ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Pushing...</> : <><Zap className="h-3.5 w-3.5 mr-1.5" />Send reminders</>}
            </Button>
          </div>
        </Card>
      </div>

      {/* Active vouchers */}
      {active.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Active vouchers ({active.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative p-4 rounded-xl border-2 overflow-hidden ${
                  v.daysToExpiry <= 5 ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-emerald-200 dark:border-emerald-900"
                }`}
              >
                {v.anniversaryDate && (
                  <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[9px]">
                    <Gift className="h-2.5 w-2.5 mr-0.5" /> Anniversary
                  </Badge>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    v.daysToExpiry <= 5 ? "bg-amber-500" : "bg-emerald-500"
                  }`}>
                    <Ticket className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.provider}</p>
                  </div>
                </div>
                <p className="text-2xl font-black mt-3">{fmt(v.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{v.code}</span>
                  <span className={`flex items-center gap-1 ${v.daysToExpiry <= 5 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                    <Clock className="h-3 w-3" />
                    {v.daysToExpiry} day{v.daysToExpiry !== 1 ? "s" : ""} left
                  </span>
                </div>
                {v.wablastSent && (
                  <Badge variant="outline" className="mt-2 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    <MessageCircle className="h-2.5 w-2.5 mr-0.5" /> Sent via WhatsApp
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Expiring soon alert */}
      {expiring.length > 0 && (
        <Card className="p-5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-800 dark:text-amber-300">{expiring.length} voucher(s) expiring within 5 days</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Use them before they expire! Click "Send reminders" above to get a WhatsApp notification.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Expired vouchers */}
      {expired.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-600" /> Expired vouchers ({expired.length})
          </h3>
          <div className="space-y-2">
            {expired.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 opacity-60">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through">{v.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{v.code}</p>
                </div>
                <span className="text-xs text-rose-600">Expired {new Date(v.expiryDate).toLocaleDateString("en-ZA")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">How voucher delivery works</p>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
              <li>Active vouchers are pushed to WABlast and delivered directly to your WhatsApp number.</li>
              <li>5 days before your anniversary date, expiring vouchers are sent as a high-priority WhatsApp reminder.</li>
              <li>Each voucher has a unique code — present it at the provider to redeem.</li>
              <li>Expired vouchers remain visible in your wallet for record-keeping but cannot be redeemed.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
