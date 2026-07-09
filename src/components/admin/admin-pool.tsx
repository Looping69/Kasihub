"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Droplets, Loader2, TrendingUp, Wallet, Zap, Users,
  Calendar, Send,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Distribution {
  id: string; amount: number; source: string; payoutDate: string;
  status: string; member: { profileNumber: string; name: string };
}

export function AdminPool() {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [totals, setTotals] = useState({ totalIncoming: 0, mallPoolIncoming: 0, marketplacePoolIncoming: 0, totalPaidOut: 0, balance: 0, distributionCount: 0 });
  const [sourceBreakdown, setSourceBreakdown] = useState<{ source: string; amount: number; count: number }[]>([]);
  const [dailyTrend, setDailyTrend] = useState<{ date: string; amount: number }[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerAmount, setTriggerAmount] = useState("5000");
  const [triggerSource, setTriggerSource] = useState("MANUAL");
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/pool", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setDistributions(d.distributions);
        setTotals(d.totals);
        setSourceBreakdown(d.sourceBreakdown);
        setDailyTrend(d.dailyTrend);
        setEligibleMembers(d.eligibleMembers);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function triggerDistribution() {
    setTriggering(true);
    try {
      const res = await fetch("/api/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount: parseFloat(triggerAmount), source: triggerSource }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Distribution failed");
      } else {
        toast.success(`Distributed R${result.perMember.toFixed(2)} to ${result.distributed} eligible members.`);
        setTriggerOpen(false);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTriggering(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const perMember = eligibleMembers > 0 ? parseFloat(triggerAmount) / eligibleMembers : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><Droplets className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">KasiPool management</h2></div>
          <p className="text-sm text-muted-foreground">Shared pool funded by mall, marketplace, and subscription differences. Paid nightly at 12:00 SAST.</p>
        </div>
        <Button onClick={() => setTriggerOpen(true)} className="bg-gradient-to-r from-emerald-600 to-emerald-500"><Zap className="h-4 w-4 mr-1.5" />Trigger distribution</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          <div className="relative"><div className="flex items-center justify-between"><p className="text-xs text-emerald-100">Current pool balance</p><Wallet className="h-4 w-4" /></div><p className="text-3xl font-black mt-1">{fmt(totals.balance)}</p><p className="text-[10px] text-emerald-100 mt-1">available for distribution</p></div>
        </Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total incoming</p><TrendingUp className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(totals.totalIncoming)}</p><p className="text-[10px] text-muted-foreground mt-1">mall + marketplace</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total paid out</p><Droplets className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1">{fmt(totals.totalPaidOut)}</p><p className="text-[10px] text-muted-foreground mt-1">{totals.distributionCount} distributions</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Eligible members</p><Users className="h-4 w-4 text-teal-600" /></div><p className="text-2xl font-black mt-1">{eligibleMembers}</p><p className="text-[10px] text-muted-foreground mt-1">active subscriptions</p></Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-bold">Daily distributions</h3><p className="text-xs text-muted-foreground">Last 14 days</p></div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><Calendar className="h-3 w-3 mr-1" />12:00 SAST</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <defs><linearGradient id="poolGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0.4} /><stop offset="100%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} tickFormatter={(d) => new Date(d).getDate().toString()} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} tickFormatter={(v) => `R${v}`} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: "oklch(0.17 0.02 155)", border: "none", borderRadius: "8px", color: "white", fontSize: "12px" }} formatter={(v: number) => fmt(v)} labelFormatter={(d) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} />
                <Area type="monotone" dataKey="amount" stroke="oklch(0.52 0.13 158)" strokeWidth={2} fill="url(#poolGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-4">Source breakdown</h3>
          <div className="space-y-3">
            {sourceBreakdown.map((s) => (
              <div key={s.source} className="p-3 rounded-lg bg-muted/40">
                <div className="flex justify-between mb-1"><span className="text-xs font-semibold">{s.source.replace(/_/g, " ")}</span><span className="text-xs font-bold">{fmt(s.amount)}</span></div>
                <p className="text-[10px] text-muted-foreground">{s.count} distributions</p>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">From KasiMall</span><span className="font-semibold">{fmt(totals.mallPoolIncoming)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">From Marketplace</span><span className="font-semibold">{fmt(totals.marketplacePoolIncoming)}</span></div>
          </div>
        </Card>
      </div>

      {/* Distribution history */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">Distribution history</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-kasi">
          {distributions.slice(0, 50).map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><Droplets className="h-4 w-4 text-emerald-600" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium">{d.member.name}</p><p className="text-[10px] text-muted-foreground font-mono">{d.member.profileNumber} · {new Date(d.payoutDate).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</p></div>
              <Badge variant="outline" className="text-[9px]">{d.source.replace(/_/g, " ")}</Badge>
              <p className="text-sm font-bold text-emerald-600 w-24 text-right">+{fmt(d.amount)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Trigger dialog */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-600" />Trigger manual distribution</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Total amount to distribute (ZAR)</Label>
              <Input type="number" value={triggerAmount} onChange={(e) => setTriggerAmount(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Source label</Label>
              <Select value={triggerSource} onValueChange={setTriggerSource}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
                  <SelectItem value="MALL">Mall</SelectItem>
                  <SelectItem value="SUBSCRIPTION_DIFF">Subscription difference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total amount</span><span className="font-semibold">{fmt(parseFloat(triggerAmount) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Eligible members</span><span className="font-semibold">{eligibleMembers}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="font-semibold">Per member</span><span className="font-bold text-emerald-600">{fmt(perMember)}</span></div>
            </Card>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p>This will immediately distribute {fmt(parseFloat(triggerAmount) || 0)} equally among all {eligibleMembers} active members and create a POOL_PAYOUT transaction for each.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancel</Button>
            <Button onClick={triggerDistribution} disabled={triggering} className="bg-gradient-to-r from-emerald-600 to-emerald-500">{triggering ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Distributing...</> : <><Send className="h-4 w-4 mr-1.5" />Distribute now</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
