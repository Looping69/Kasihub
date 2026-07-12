"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ticket, Loader2, Clock, CheckCircle2, XCircle, Send, Zap,
  Wallet, AlertTriangle, MessageCircle, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKasiStore } from "@/lib/store";
import { toast } from "sonner";

interface Voucher {
  id: string; code: string; title: string; description: string;
  provider: string; value: number; category: string; status: string;
  issueDate: string; expiryDate: string; anniversaryDate: string | null;
  wablastSent: boolean; expiringSent: boolean; daysToExpiry: number;
  member: { profileNumber: string; name: string; mobile: string };
}

export function AdminVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, expiringSoon: 0, wablastPushed: 0, expiringPushed: 0, totalValue: 0 });
  const [categoryStats, setCategoryStats] = useState<{ category: string; count: number; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/vouchers", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setVouchers(data.vouchers);
          setStats(data.stats);
          setCategoryStats(data.categoryStats);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><Ticket className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">Voucher management</h2></div>
        <p className="text-sm text-muted-foreground">All member vouchers across the platform. WABlast pushes active and expiring vouchers via WhatsApp.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total vouchers</p><Ticket className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{stats.total}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Active</p><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1 text-emerald-600">{stats.active}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Expiring soon</p><AlertTriangle className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1 text-amber-600">{stats.expiringSoon}</p><p className="text-[10px] text-muted-foreground mt-1">within 5 days</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total value</p><Wallet className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(stats.totalValue)}</p></Card>
      </div>

      {/* WABlast stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative flex items-center justify-between">
            <div><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur"><MessageCircle className="h-5 w-5" /></div><div><p className="font-bold">Active vouchers pushed</p><p className="text-xs text-emerald-50">via WABlast to WhatsApp</p></div></div></div>
            <p className="text-3xl font-black">{stats.wablastPushed}</p>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative flex items-center justify-between">
            <div><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur"><Zap className="h-5 w-5" /></div><div><p className="font-bold">Expiring reminders pushed</p><p className="text-xs text-amber-50">5 days before anniversary</p></div></div></div>
            <p className="text-3xl font-black">{stats.expiringPushed}</p>
          </div>
        </Card>
      </div>

      {/* Category breakdown */}
      {categoryStats.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-4">Vouchers by category</h3>
          <div className="grid gap-3 sm:grid-cols-5">
            {categoryStats.map((c) => (
              <div key={c.category} className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.category}</p>
                <p className="text-lg font-black mt-1">{c.count}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">{fmt(c.value)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All vouchers table */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">All vouchers ({vouchers.length})</h3>
        <div className="overflow-x-auto scrollbar-kasi max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Voucher</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Member</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden md:table-cell">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Value</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">Expiry</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Status</th>
                <th className="text-center px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden xl:table-cell">WABlast</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2"><p className="font-semibold text-xs">{v.title}</p><p className="text-[10px] text-muted-foreground font-mono">{v.code}</p></td>
                  <td className="px-3 py-2"><p className="text-xs font-medium">{v.member.name}</p><p className="text-[10px] text-muted-foreground font-mono">{v.member.profileNumber}</p></td>
                  <td className="px-3 py-2 hidden md:table-cell"><Badge variant="outline" className="text-[9px]">{v.category}</Badge></td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(v.value)}</td>
                  <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">{new Date(v.expiryDate).toLocaleDateString("en-ZA")}</td>
                  <td className="px-3 py-2">
                    {v.status === "ACTIVE" && v.daysToExpiry > 5 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">Active</Badge>}
                    {v.status === "ACTIVE" && v.daysToExpiry > 0 && v.daysToExpiry <= 5 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Expiring ({v.daysToExpiry}d)</Badge>}
                    {(v.status === "EXPIRED" || v.daysToExpiry <= 0) && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px]">Expired</Badge>}
                  </td>
                  <td className="px-3 py-2 hidden xl:table-cell text-center">
                    {v.wablastSent && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] mr-1"><MessageCircle className="h-2.5 w-2.5 mr-0.5" />Active</Badge>}
                    {v.expiringSent && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]"><Zap className="h-2.5 w-2.5 mr-0.5" />Expiring</Badge>}
                    {!v.wablastSent && !v.expiringSent && <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
