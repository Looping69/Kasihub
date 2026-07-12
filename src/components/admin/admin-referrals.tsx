"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UserPlus, Loader2, Gift, CheckCircle2, Clock, Award,
  Users, TrendingUp, Share2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface Referral {
  id: string; referralCode: string; referredName: string; referredEmail: string;
  referredMobile: string; status: string; rewardAmount: number;
  createdAt: string; convertedAt: string | null;
  referrer: { profileNumber: string; name: string };
}

interface ReferralData {
  referrals: Referral[];
  stats: { total: number; registered: number; pending: number; conversionRate: number; totalRewards: number };
  topReferrers: { name: string; profileNumber: string; count: number; rewards: number }[];
}

export function AdminReferrals() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/referrals", { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><UserPlus className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">Referral management</h2></div>
        <p className="text-sm text-muted-foreground">Refer an Enabler program — track referrals, conversions, and reward payouts.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total referrals</p><Users className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{data.stats.total}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Registered</p><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1 text-emerald-600">{data.stats.registered}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Conversion rate</p><TrendingUp className="h-4 w-4 text-teal-600" /></div><p className="text-2xl font-black mt-1">{data.stats.conversionRate}%</p><Progress value={data.stats.conversionRate} className="h-1.5 mt-2" /></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total rewards paid</p><Gift className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1 text-amber-600">{fmt(data.stats.totalRewards)}</p></Card>
      </div>

      {/* Top referrers + all referrals */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top referrers */}
        <Card className="p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> Top referrers</h3>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No referrals yet.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-kasi">
              {data.topReferrers.map((r, i) => (
                <div key={r.profileNumber} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{r.name}</p><p className="text-[10px] text-muted-foreground font-mono">{r.profileNumber}</p></div>
                  <div className="text-right"><p className="text-xs font-bold">{r.count}</p><p className="text-[10px] text-emerald-600">{fmt(r.rewards)}</p></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* All referrals table */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold mb-4">All referrals ({data.referrals.length})</h3>
          <div className="overflow-x-auto scrollbar-kasi max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Referred</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden md:table-cell">Referrer</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Reward</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2"><p className="font-semibold text-xs">{r.referredName}</p><p className="text-[10px] text-muted-foreground">{r.referredMobile}</p></td>
                    <td className="px-3 py-2 hidden md:table-cell"><p className="text-xs font-medium">{r.referrer.name}</p><p className="text-[10px] text-muted-foreground font-mono">{r.referrer.profileNumber}</p></td>
                    <td className="px-3 py-2">
                      {r.status === "REGISTERED" ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">Registered</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Pending</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{r.rewardAmount > 0 ? fmt(r.rewardAmount) : "—"}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-ZA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
