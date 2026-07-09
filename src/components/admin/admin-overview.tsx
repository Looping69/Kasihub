"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Coins, Building2, ShieldCheck, TrendingUp,
  Droplets, Award, Loader2, Wallet, AlertCircle, Activity, Crown,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useKasiStore } from "@/lib/store";

interface AdminStats {
  totals: {
    members: number; activeMembers: number; pendingKyc: number;
    totalShares: number; shareRevenueUSD: number; pioneerCount: number;
    pioneerTarget: number; totalRevenue: number; subscriptionRevenue: number;
    mallRevenue: number; marketplaceRevenue: number; poolPaidOut: number;
    poolBalance: number; poolIncoming: number; mallTransactions: number;
    marketplaceOrders: number; taxEligibleMembers: number;
  };
  memberGrowth: { date: string; count: number }[];
  cumulativeGrowth: { date: string; count: number }[];
  revenueBySource: { name: string; value: number; color: string }[];
  typeBreakdown: { INDIVIDUAL_ADULT: number; INDIVIDUAL_KIDS: number; COMPANY: number };
  kycBreakdown: { VERIFIED: number; PENDING: number; REJECTED: number };
  silos: { id: string; name: string; percentage: number; color: string; description: string | null }[];
  phases: { id: string; phase: number; pricePerShare: number; totalShares: number; soldShares: number; status: string; bonusBuyOneGet: boolean }[];
  dividends: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string }[];
  recentActivity: { id: string; type: string; amount: number; description: string; createdAt: string; member: { profileNumber: string; name: string } }[];
}

export function AdminOverview() {
  const { setAdminView } = useKasiStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (res.ok) setStats(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black tracking-tight">Platform overview</h2>
        <p className="text-sm text-muted-foreground">Real-time analytics across the entire KaSiHUB ecosystem.</p>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Total members" value={stats.totals.members.toLocaleString()} sub={`${stats.totals.activeMembers} active`} color="emerald" trend="+12 this week" />
        <Kpi icon={DollarSign} label="Total revenue" value={fmt(stats.totals.totalRevenue)} sub="all sources" color="amber" trend="+8.2%" />
        <Kpi icon={Coins} label="Shares sold" value={stats.totals.totalShares.toLocaleString()} sub={`${fmtUSD(stats.totals.shareRevenueUSD)} value`} color="yellow" trend="Phase 1 open" />
        <Kpi icon={Droplets} label="KasiPool balance" value={fmt(stats.totals.poolBalance)} sub={`${fmt(stats.totals.poolPaidOut)} paid out`} color="teal" trend="nightly payouts" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpi icon={ShieldCheck} label="Pending KYC" value={stats.totals.pendingKyc} color="amber" onClick={() => setAdminView("members")} />
        <MiniKpi icon={Crown} label="Pioneers" value={`${stats.totals.pioneerCount}/${stats.totals.pioneerTarget}`} color="amber" onClick={() => setAdminView("rootsbank")} />
        <MiniKpi icon={Building2} label="Mall transactions" value={stats.totals.mallTransactions} color="rose" onClick={() => setAdminView("mall")} />
        <MiniKpi icon={AlertCircle} label="Tax-eligible members" value={stats.totals.taxEligibleMembers} color="rose" sub="earning > R7k/mo" />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Member growth */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Member growth</h3>
              <p className="text-xs text-muted-foreground">New registrations · last 14 days</p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <TrendingUp className="h-3 w-3 mr-1" /> {stats.memberGrowth.reduce((s, x) => s + x.count, 0)} new
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulativeGrowth}>
                <defs>
                  <linearGradient id="memberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} tickFormatter={(d) => new Date(d).getDate().toString()} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: "oklch(0.17 0.02 155)", border: "none", borderRadius: "8px", color: "white", fontSize: "12px" }} labelFormatter={(d) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} />
                <Area type="monotone" dataKey="count" stroke="oklch(0.52 0.13 158)" strokeWidth={2} fill="url(#memberGradient)" name="Total members" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Revenue by source */}
        <Card className="p-5">
          <h3 className="font-bold mb-1">Revenue by source</h3>
          <p className="text-xs text-muted-foreground mb-4">All-time breakdown</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.revenueBySource} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {stats.revenueBySource.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.17 0.02 155)", border: "none", borderRadius: "8px", color: "white", fontSize: "12px" }} formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {stats.revenueBySource.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-muted-foreground">{r.name}</span>
                </div>
                <span className="font-semibold">{fmt(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily new members bar */}
        <Card className="p-5">
          <h3 className="font-bold mb-1">Daily registrations</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 14 days</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.memberGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} tickFormatter={(d) => new Date(d).getDate().toString()} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: "oklch(0.17 0.02 155)", border: "none", borderRadius: "8px", color: "white", fontSize: "12px" }} />
                <Bar dataKey="count" fill="oklch(0.75 0.15 80)" radius={[4, 4, 0, 0]} name="New members" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Membership types */}
        <Card className="p-5">
          <h3 className="font-bold mb-1">Membership types</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution</p>
          <div className="space-y-3">
            {[
              { label: "Individual — Adult", count: stats.typeBreakdown.INDIVIDUAL_ADULT, color: "bg-emerald-500", pct: (stats.typeBreakdown.INDIVIDUAL_ADULT / stats.totals.members) * 100 },
              { label: "Individual — Kids", count: stats.typeBreakdown.INDIVIDUAL_KIDS, color: "bg-teal-500", pct: (stats.typeBreakdown.INDIVIDUAL_KIDS / stats.totals.members) * 100 },
              { label: "Company", count: stats.typeBreakdown.COMPANY, color: "bg-amber-500", pct: (stats.typeBreakdown.COMPANY / stats.totals.members) * 100 },
            ].map((t) => (
              <div key={t.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className="font-semibold">{t.count} ({t.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${t.color} rounded-full`} style={{ width: `${t.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div>
            <p className="text-xs text-muted-foreground mb-2">KYC status</p>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{stats.kycBreakdown.VERIFIED} verified</Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{stats.kycBreakdown.PENDING} pending</Badge>
              {stats.kycBreakdown.REJECTED > 0 && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{stats.kycBreakdown.REJECTED} rejected</Badge>}
            </div>
          </div>
        </Card>

        {/* Share phases quick view */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Share phases</h3>
              <p className="text-xs text-muted-foreground">Sales progress</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAdminView("shares")}>Manage <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
          </div>
          <div className="space-y-3">
            {stats.phases.slice(0, 3).map((p) => {
              const pct = (p.soldShares / p.totalShares) * 100;
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">Phase {p.phase} · {fmtUSD(p.pricePerShare)}</span>
                    <span className="text-muted-foreground">{p.soldShares.toLocaleString()}/{p.totalShares.toLocaleString()}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent activity + silos */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" /> Recent activity</h3>
              <p className="text-xs text-muted-foreground">Latest platform-wide transactions</p>
            </div>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-kasi">
            {stats.recentActivity.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.amount > 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40"}`}>
                  {t.amount > 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground">{t.member.name} · {new Date(t.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <p className={`text-xs font-bold font-mono ${t.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.amount > 0 ? "+" : ""}{t.amount !== 0 ? fmt(t.amount) : "—"}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Silo config preview */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Mall silo splits</h3>
              <p className="text-xs text-muted-foreground">Current Exco config</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAdminView("mall")}>Edit <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
          </div>
          <div className="space-y-2">
            {stats.silos.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-medium">{s.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.percentage}%</span>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center gap-2 text-xs">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">Mall revenue:</span>
            <span className="font-bold">{fmt(stats.totals.mallRevenue)}</span>
          </div>
        </Card>
      </div>

      {/* Dividend history */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> Dividend declarations</h3>
            <p className="text-xs text-muted-foreground">KasiMall dividend history</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAdminView("shares")}>Declare new <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.dividends.slice(0, 3).map((d) => (
            <div key={d.id} className="p-4 rounded-xl border border-border/60 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{d.status}</Badge>
                <p className="text-[10px] text-muted-foreground">{new Date(d.declaredAt).toLocaleDateString("en-ZA")}</p>
              </div>
              <p className="text-xl font-black">{fmtUSD(d.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.totalShares.toLocaleString()} shares · {fmtUSD(d.perShareAmount)}/share</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, trend, color }: {
  icon: typeof Users; label: string; value: string; sub: string; trend: string;
  color: "emerald" | "amber" | "teal" | "yellow";
}) {
  const colors = {
    emerald: "from-emerald-500 to-emerald-600", amber: "from-amber-500 to-amber-600",
    teal: "from-teal-500 to-emerald-600", yellow: "from-yellow-500 to-amber-600",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <Badge variant="outline" className="text-[9px] h-4 bg-muted/50">{trend}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{label}</p>
        <p className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </Card>
    </motion.div>
  );
}

function MiniKpi({ icon: Icon, label, value, sub, color, onClick }: {
  icon: typeof Users; label: string; value: string | number; sub?: string;
  color: "emerald" | "amber" | "rose" | "teal"; onClick?: () => void;
}) {
  const colors = { emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600", teal: "text-teal-600" };
  return (
    <Card className={`p-4 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} onClick={onClick}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${colors[color]}`} />
        <div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className="text-lg font-black">{value}</p>
          {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}
