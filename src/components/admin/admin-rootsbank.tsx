"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Landmark, Loader2, Crown, Users, DollarSign, Award, Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface Pioneer {
  id: string; category: string; sharePrice: number; membershipFee: number;
  totalAmount: number; paymentRef: string | null; pioneerPool: boolean;
  status: string; createdAt: string;
  member: { profileNumber: string; name: string; email: string; country: string };
}
interface Payout {
  id: string; amount: number; description: string; createdAt: string;
  member: { profileNumber: string; name: string };
}

export function AdminRootsBank() {
  const [pioneers, setPioneers] = useState<Pioneer[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState({ KIDS_STUDENT: 0, ADULT: 0, PENSIONER: 0 });
  const [totalCollected, setTotalCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/rootsbank", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          setPioneers(d.pioneers);
          setPayouts(d.pioneerPayouts);
          setCategoryBreakdown(d.categoryBreakdown);
          setTotalCollected(d.totalCollected);
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
  const remaining = 200 - pioneers.length;
  const pct = (pioneers.length / 200) * 100;
  const totalPayouts = payouts.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><Landmark className="h-5 w-5 text-amber-600" /><h2 className="text-2xl font-black tracking-tight">Roots Bank pioneers</h2></div>
        <p className="text-sm text-muted-foreground">200 pioneers constitute the Roots CO-OP Bank and share in 1% of all Kasi profits for life.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Pioneers registered</p><Crown className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1">{pioneers.length} / 200</p><Progress value={pct} className="h-1.5 mt-2" /></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total collected</p><DollarSign className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(totalCollected)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Spots remaining</p><Sparkles className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1 text-amber-600">{remaining}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">PioneerPool paid out</p><Award className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(totalPayouts)}</p></Card>
      </div>

      {/* Category breakdown + progress */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold mb-4">Category breakdown</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: "Kids & Students", count: categoryBreakdown.KIDS_STUDENT, fee: 550, color: "teal" },
              { label: "Adults (18-65)", count: categoryBreakdown.ADULT, fee: 700, color: "amber" },
              { label: "Pensioners (65+)", count: categoryBreakdown.PENSIONER, fee: 550, color: "emerald" },
            ].map((c) => (
              <div key={c.label} className="p-4 rounded-xl border border-border/60 bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-black mt-1">{c.count}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{fmt(c.fee)} each</p>
                <p className="text-xs font-semibold mt-2 text-emerald-600">{fmt(c.count * c.fee)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative">
            <Crown className="h-8 w-8 mb-3" />
            <h3 className="font-bold text-lg">PioneerPool progress</h3>
            <p className="text-sm text-amber-50 mt-1">{remaining} spots remaining</p>
            <div className="mt-4"><div className="flex justify-between text-xs mb-1.5"><span className="text-amber-100">Registered</span><span className="font-bold">{pioneers.length}/200</span></div><div className="h-2.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} /></div></div>
          </div>
        </Card>
      </div>

      {/* Pioneers table */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">All pioneers ({pioneers.length})</h3>
        <div className="overflow-x-auto scrollbar-kasi max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">#</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Member</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Total paid</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">Payment ref</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden xl:table-cell">Country</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden xl:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody>
              {pioneers.map((p, i) => (
                <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 10 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span></td>
                  <td className="px-3 py-2"><p className="font-semibold text-xs">{p.member.name}</p><p className="text-[10px] text-muted-foreground font-mono">{p.member.profileNumber}</p></td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.category.replace(/_/g, " ")}</Badge></td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(p.totalAmount)}</td>
                  <td className="px-3 py-2 hidden lg:table-cell font-mono text-[10px]">{p.paymentRef}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-xs">{p.member.country}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-ZA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pioneer payouts */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> PioneerPool payouts</h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pioneer payouts recorded yet.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-kasi">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center"><Crown className="h-4 w-4 text-amber-600" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.description}</p><p className="text-[10px] text-muted-foreground">{p.member.name} · {new Date(p.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</p></div>
                <p className="text-sm font-bold text-amber-600">+{fmt(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
