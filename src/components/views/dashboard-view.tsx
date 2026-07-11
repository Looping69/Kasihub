"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Users,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Award,
  Network,
  Loader2,
  Crown,
  ShoppingBag,
  PieChart as PieChartIcon,
  Gem,
  Landmark,
  BellRing,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useKasiStore } from "@/lib/store";
import type { DashboardStats } from "@/lib/types";

export function DashboardView() {
  const { currentMember, setView } = useKasiStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) return;
    async function load() {
      try {
        const res = await fetch(`/api/dashboard?memberId=${currentMember!.id}`, {
          cache: "no-store",
        });
        if (res.ok) setStats(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentMember]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtUSD = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            {stats.auditorNotified && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              >
                <BellRing className="h-3 w-3 mr-1" />
                Auditor notified — earnings exceeded R7,000/mo
              </Badge>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {currentMember?.firstName} {currentMember?.lastName}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {currentMember?.profileNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("shares")}>
            <Coins className="h-4 w-4 mr-1.5" /> Buy shares
          </Button>
          <Button
            size="sm"
            onClick={() => setView("marketplace")}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500"
          >
            <Wallet className="h-4 w-4 mr-1.5" /> Marketplace
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Total earnings"
          value={fmt(stats.totalEarnings)}
          sub="All-time credits"
          trend="+12.4%"
          color="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="This month"
          value={fmt(stats.earningsThisMonth)}
          sub={stats.member.taxThreshold ? "Tax threshold reached" : "Below tax threshold"}
          trend="+8.1%"
          color="amber"
        />
        <KpiCard
          icon={Coins}
          label="KasiShares value"
          value={fmtUSD(stats.kasiShares.totalValue)}
          sub={`${stats.kasiShares.count} shares × ${fmtUSD(stats.kasiShares.valuePerShare)}`}
          trend={fmtUSD(stats.kasiShares.valuePerShare)}
          color="yellow"
        />
        <KpiCard
          icon={Users}
          label="Ecosystem downline"
          value={`${stats.ecosystemDownline}`}
          sub={`${stats.ecosystemLevels} levels deep`}
          trend="5×6"
          color="teal"
        />
      </div>

      {/* Ecosystem Earnings Today block */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/20 border-emerald-200 dark:border-emerald-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Ecosystem earnings today
              </p>
              <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {fmt(stats.ecosystemEarningsToday)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 sm:min-w-[360px]">
            <MiniStat
              label="Daily"
              value={fmt(stats.earningsToday)}
              accent="emerald"
            />
            <MiniStat
              label="Weekly"
              value={fmt(stats.earningsThisWeek)}
              accent="amber"
            />
            <MiniStat
              label="Monthly"
              value={fmt(stats.earningsThisMonth)}
              accent="teal"
            />
          </div>
        </div>
      </Card>

      {/* 3 Pool blocks */}
      <div className="grid gap-4 lg:grid-cols-3">
        {stats.pools.pioneer.eligible && (
          <PoolBlock
            icon={Crown}
            title="Pioneer KasiPool"
            subtitle="1% of Kasi profits"
            todayAmount={stats.pools.pioneer.today}
            totalAmount={stats.pools.pioneer.total}
            theme="amber"
            note="You're receiving a share of the 1% PioneerPool every night."
          />
        )}
        <PoolBlock
          icon={ShoppingBag}
          title="KasiMarketplace Pool"
          subtitle="Paid Enablers Only"
          todayAmount={stats.pools.marketplace.today}
          totalAmount={stats.pools.marketplace.total}
          theme="teal"
          note="This amount is included in your Total Earnings for today."
        />
        <PoolBlock
          icon={PieChartIcon}
          title="Kasi Shareholders Pool"
          subtitle="Shareholders only"
          todayAmount={stats.pools.shareholders.today}
          totalAmount={stats.pools.shareholders.total}
          theme="emerald"
          action={
            <Button
              size="sm"
              variant="outline"
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              onClick={() => setView("shares")}
            >
              <Coins className="h-3.5 w-3.5 mr-1.5" /> Buy shares
            </Button>
          }
        />
      </div>

      {/* Shares blocks */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ShareBlock
          icon={Coins}
          title="KasiShares"
          count={stats.kasiShares.count}
          countLabel="shares"
          valuePerShare={fmtUSD(stats.kasiShares.valuePerShare)}
          totalValue={fmtUSD(stats.kasiShares.totalValue)}
          theme="emerald"
        />
        <ShareBlock
          icon={Gem}
          title="Aureus Shares"
          count={stats.aureusShares.count}
          countLabel="shares"
          valuePerShare={fmtUSD(stats.aureusShares.valuePerShare)}
          totalValue={fmtUSD(stats.aureusShares.totalValue)}
          theme="amber"
        />
        <ShareBlock
          icon={Landmark}
          title="Roots Bank Shares"
          count={stats.rootsBankShares.count}
          countLabel="pioneer shares"
          valuePerShare={null}
          totalValue={fmt(stats.rootsBankShares.totalValue)}
          theme="teal"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Total Earnings trend */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Total Earnings</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Daily
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.totalEarningsTrend}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.52 0.13 158)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }}
                  tickFormatter={(d) => new Date(d).getDate().toString()}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.5 0.02 150)" }}
                  tickFormatter={(v) => `R${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.17 0.02 155)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "12px",
                  }}
                  labelFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
                  }
                  formatter={(v: number) => [`R ${v.toFixed(2)}`, "Earnings"]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="oklch(0.52 0.13 158)"
                  strokeWidth={2}
                  fill="url(#earningsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Earnings breakdown */}
        <Card className="p-5">
          <h3 className="font-bold mb-1">Earnings breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">By source</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.earningsBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {stats.earningsBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.17 0.02 155)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "12px",
                  }}
                  formatter={(v: number) => `R ${v.toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3 max-h-40 overflow-y-auto scrollbar-kasi">
            {stats.earningsBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No earnings yet
              </p>
            ) : (
              stats.earningsBreakdown.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    <span className="text-muted-foreground">{b.name}</span>
                  </div>
                  <span className="font-semibold">{fmt(b.value)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Eco-System + Pioneer Pool + Profile */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="p-5 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setView("ecosystem")}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold">Eco-System (5×6)</h3>
              <p className="text-xs text-muted-foreground">5×6 structure</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-emerald-600">{stats.ecosystemDownline}</p>
              <p className="text-[10px] text-muted-foreground">downline members</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600">{stats.ecosystemLevels}</p>
              <p className="text-[10px] text-muted-foreground">levels deep</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
            View Eco-System <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold">Pioneer Pool</h3>
              <p className="text-xs text-muted-foreground">1% of Kasi profits</p>
            </div>
          </div>
          {stats.pioneerPoolEligible ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Eligible
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                You&apos;re receiving a share of the 1% PioneerPool every night.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Purchase a Roots Bank pioneer share to unlock lifetime 1% profit share.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                onClick={() => setView("rootsbank")}
              >
                Claim pioneer spot
              </Button>
            </>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold">Profile</h3>
              <p className="text-xs text-muted-foreground">Member status</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">KYC</span>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[9px] h-4"
              >
                {stats.member.kycStatus}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subscription</span>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[9px] h-4"
              >
                {stats.member.subscriptionStatus}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">NFC Tag</span>
              <span className="font-mono text-[10px]">{stats.member.nfcTagId || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VISA Card</span>
              <span className="font-mono text-[10px]">
                {stats.member.visaCardLast4 ? `****${stats.member.visaCardLast4}` : "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Recent transactions</h3>
            <p className="text-xs text-muted-foreground">Latest activity on your account</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("profile")}>
            View all <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-kasi">
          {stats.transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No transactions yet
            </p>
          ) : (
            stats.transactions.slice(0, 12).map((tx) => {
              const isEco = tx.type === "MATRIX_PAYOUT";
              const typeLabel = isEco
                ? "Eco-System Commission"
                : tx.type.replace(/_/g, " ");
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tx.amount > 0
                        ? "bg-emerald-50 dark:bg-emerald-950/40"
                        : "bg-rose-50 dark:bg-rose-950/40"
                    }`}
                  >
                    {tx.amount > 0 ? (
                      <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {typeLabel}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      tx.amount > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {fmt(tx.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub: string;
  trend: string;
  color: "emerald" | "amber" | "teal" | "yellow";
}) {
  const colors = {
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    teal: "from-teal-500 to-emerald-600",
    yellow: "from-yellow-500 to-amber-600",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5 hover:shadow-md transition-shadow h-full">
        <div className="flex items-start justify-between">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <Badge variant="outline" className="text-[9px] h-4 bg-muted/50">
            {trend}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{label}</p>
        <p className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </Card>
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "amber" | "teal";
}) {
  const accents = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    teal: "text-teal-600 dark:text-teal-400",
  };
  return (
    <div className="rounded-lg bg-white/70 dark:bg-background/60 backdrop-blur px-3 py-2 text-center border border-emerald-100 dark:border-emerald-900/60">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
        <Calendar className="h-2.5 w-2.5" />
        {label}
      </p>
      <p className={`text-sm font-bold mt-0.5 ${accents[accent]}`}>{value}</p>
    </div>
  );
}

function PoolBlock({
  icon: Icon,
  title,
  subtitle,
  todayAmount,
  totalAmount,
  theme,
  note,
  action,
}: {
  icon: typeof Wallet;
  title: string;
  subtitle: string;
  todayAmount: number;
  totalAmount: number;
  theme: "amber" | "teal" | "emerald";
  note?: string;
  action?: React.ReactNode;
}) {
  const themes = {
    amber: {
      grad: "from-amber-500 to-amber-600",
      chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    },
    teal: {
      grad: "from-teal-500 to-emerald-600",
      chip: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
      bar: "bg-teal-500",
      text: "text-teal-600 dark:text-teal-400",
    },
    emerald: {
      grad: "from-emerald-500 to-emerald-600",
      chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    },
  };
  const t = themes[theme];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5 hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.grad} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Today</p>
            <p className={`text-base font-black mt-0.5 ${t.text}`}>
              R {todayAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <p className={`text-base font-black mt-0.5 ${t.text}`}>
              R {totalAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {note && <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">{note}</p>}

        {action}

        {!action && (
          <div className="mt-auto pt-2">
            <Progress value={totalAmount > 0 ? Math.min(100, (todayAmount / (totalAmount || 1)) * 100) : 0} className="h-1.5" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function ShareBlock({
  icon: Icon,
  title,
  count,
  countLabel,
  valuePerShare,
  totalValue,
  theme,
}: {
  icon: typeof Wallet;
  title: string;
  count: number;
  countLabel: string;
  valuePerShare: string | null;
  totalValue: string;
  theme: "amber" | "teal" | "emerald";
}) {
  const themes = {
    emerald: {
      grad: "from-emerald-500 to-emerald-600",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      grad: "from-amber-500 to-amber-600",
      text: "text-amber-600 dark:text-amber-400",
    },
    teal: {
      grad: "from-teal-500 to-emerald-600",
      text: "text-teal-600 dark:text-teal-400",
    },
  };
  const t = themes[theme];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5 hover:shadow-md transition-shadow h-full">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.grad} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">Share portfolio</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Holdings</span>
            <span className="font-bold">
              {count} <span className="text-xs font-normal text-muted-foreground">{countLabel}</span>
            </span>
          </div>
          {valuePerShare !== null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Value per share</span>
              <span className="font-semibold">{valuePerShare}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <span className="text-xs text-muted-foreground">Total value</span>
            <span className={`font-black ${t.text}`}>{totalValue}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
