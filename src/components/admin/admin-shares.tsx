"use client";

import { useEffect, useState } from "react";
import {
  Coins, Loader2, Award, TrendingUp, Edit, Save,
  DollarSign, Calendar, Sparkles, Search, Download, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdminPresaleCampaigns } from "@/components/admin/admin-presale-campaigns";

interface Phase {
  id: string; phase: number; pricePerShare: number; totalShares: number;
  soldShares: number; status: string; bonusBuyOneGet: boolean;
}
interface ShareRecord {
  id: string; phase: number; pricePerShare: number; quantity: number;
  purchasedQuantity: number; bonusQuantity: number; totalAmount: number; currency: string;
  certificateNo: string; status: string; createdAt: string; revokedAt: string | null;
  profileId: string; profileNumber: string; holderName: string; email: string; country: string;
  source: string; orderReference: string | null; campaignName: string | null;
}
interface RegisterSummary {
  registerEntries: number; shareholderCount: number; certificateCount: number; issuedShares: number; revokedShares: number;
}
interface Dividend {
  id: string; amount: number; totalShares: number; perShareAmount: number;
  status: string; declaredAt: string; paidAt: string | null;
}

// Approximate daily profit pool shared across all outstanding shares (ZAR)
const DAILY_PROFIT_POOL_ZAR = 37000;

export function AdminShares() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [totals, setTotals] = useState({ totalActiveShares: 0, totalActiveValue: 0 });
  const [registerSummary, setRegisterSummary] = useState<RegisterSummary>({ registerEntries: 0, shareholderCount: 0, certificateCount: 0, issuedShares: 0, revokedShares: 0 });
  const [registerSearch, setRegisterSearch] = useState("");
  const [registerStatus, setRegisterStatus] = useState("ALL");
  const [registerSource, setRegisterSource] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Phase | null>(null);
  const [dividendOpen, setDividendOpen] = useState(false);
  const [dividendAmount, setDividendAmount] = useState("37000");
  const [declaring, setDeclaring] = useState(false);

  async function load() {
    try {
      const [sharesRes, statsRes] = await Promise.all([
        fetch("/api/admin/shares?limit=500", { cache: "no-store" }),
        fetch("/api/admin/stats", { cache: "no-store" }),
      ]);
      if (sharesRes.ok) {
        const d = await sharesRes.json();
        setShares(d.shares);
        setRegisterSummary(d.summary);
        setTotals({ totalActiveShares: d.totalActiveShares, totalActiveValue: d.totalActiveValue });
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setPhases(d.phases);
        setDividends(d.dividends);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function savePhase() {
    if (!editing) return;
    try {
      const res = await fetch("/api/admin/phases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          phaseId: editing.id,
          pricePerShare: editing.pricePerShare,
          totalShares: editing.totalShares,
          status: editing.status,
          bonusBuyOneGet: editing.bonusBuyOneGet,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Update failed");
      } else {
        toast.success(`Phase ${editing.phase} updated`);
        setEditing(null);
        await load();
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function declareDividend() {
    setDeclaring(true);
    try {
      const res = await fetch("/api/admin/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(dividendAmount) }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Declaration failed");
      } else {
        toast.success(`Profit share declared! R ${result.perShareAmount.toFixed(4)}/share distributed to ${result.distributedTo} members.`);
        setDividendOpen(false);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeclaring(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmtUSD = (n: number) => `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtZAR = (n: number) => `R ${(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Helper: get a share's phase pricePerShare (current value-per-share)
  const phasePriceFor = (s: ShareRecord): number => {
    const ph = phases.find((p) => p.phase === s.phase);
    return ph?.pricePerShare ?? s.pricePerShare ?? 0;
  };
  // Phase-based current total value across all issued shares.
  const totalPhaseValue = shares
    .filter((s) => s.status === "ISSUED")
    .reduce((sum, s) => sum + s.quantity * phasePriceFor(s), 0);

  // Daily profit share per share (ZAR), based on a ~R37,000 pool split across all active shares
  const dailyProfitSharePerShare = totals.totalActiveShares > 0
    ? DAILY_PROFIT_POOL_ZAR / totals.totalActiveShares
    : 0;

  const normalizedRegisterSearch = registerSearch.trim().toLowerCase();
  const visibleRegister = shares.filter((share) => {
    const searchable = [share.holderName, share.email, share.profileNumber, share.certificateNo, share.orderReference, share.campaignName]
      .filter(Boolean).join(" ").toLowerCase();
    return (!normalizedRegisterSearch || searchable.includes(normalizedRegisterSearch))
      && (registerStatus === "ALL" || share.status === registerStatus)
      && (registerSource === "ALL" || share.source === registerSource);
  });

  function exportRegister() {
    const columns = ["Holder", "Email", "Profile number", "Country", "Campaign", "Source", "Order reference", "Certificate", "Shares", "Purchased", "Bonus", "Issued at", "Status"];
    const csvCell = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = visibleRegister.map((share) => [
      share.holderName, share.email, share.profileNumber, share.country, share.campaignName, share.source,
      share.orderReference, share.certificateNo, share.quantity, share.purchasedQuantity, share.bonusQuantity,
      new Date(share.createdAt).toISOString(), share.status,
    ]);
    const blob = new Blob([[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kasihub-share-register-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><Coins className="h-5 w-5 text-amber-600" /><h2 className="text-2xl font-black tracking-tight">KasiShares management</h2></div>
          <p className="text-sm text-muted-foreground">Manage phases, declare daily profit share, and view all certificates.</p>
        </div>
        <Button onClick={() => setDividendOpen(true)} className="bg-gradient-to-r from-amber-500 to-amber-600"><Award className="h-4 w-4 mr-1.5" /> Declare profit share</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Active shares outstanding</p><Coins className="h-4 w-4 text-amber-600" /></div>
          <p className="text-2xl font-black mt-1">{totals.totalActiveShares.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">across {registerSummary.certificateCount.toLocaleString()} issued certificate(s)</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total value sold (purchase)</p><DollarSign className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-2xl font-black mt-1">{fmtUSD(totals.totalActiveValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">sum of original purchase amounts</p>
        </Card>
        <Card className="p-5 ring-1 ring-emerald-200 dark:ring-emerald-900">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Current value (phase-based)</p><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-2xl font-black mt-1 text-emerald-600">{fmtUSD(totalPhaseValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">sum of qty × phase price</p>
        </Card>
        <Card className="p-5 ring-1 ring-amber-200 dark:ring-amber-900">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Daily profit share / share</p><Sparkles className="h-4 w-4 text-amber-600" /></div>
          <p className="text-2xl font-black mt-1 text-amber-600">{fmtZAR(dailyProfitSharePerShare)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtZAR(DAILY_PROFIT_POOL_ZAR)} pool / day</p>
        </Card>
      </div>

      {/* Phases management */}
      <AdminPresaleCampaigns />

      <Card className="p-5">
        <h3 className="font-bold mb-4">Share phases</h3>
        <div className="space-y-3">
          {phases.map((p) => {
            const soldPct = (p.soldShares / p.totalShares) * 100;
            return (
              <div key={p.id} className={`p-4 rounded-xl border-2 ${p.status === "OPEN" ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" : "border-border/60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${p.status === "OPEN" ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" : "bg-muted text-muted-foreground"}`}>{p.phase}</div>
                    <div>
                      <p className="font-bold text-sm">Phase {p.phase}{p.bonusBuyOneGet && <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-[9px]">BOGO</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{fmtUSD(p.pricePerShare)}/share · {p.soldShares.toLocaleString()}/{p.totalShares.toLocaleString()} sold</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "OPEN" ? "default" : "outline"} className={p.status === "OPEN" ? "bg-amber-500" : ""}>{p.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...p })}><Edit className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full" style={{ width: `${soldPct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Profit share history */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> Profit share history</h3>
        {dividends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No profit shares declared yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dividends.map((d) => (
              <div key={d.id} className="p-4 rounded-xl border border-border/60 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{d.status}</Badge>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(d.declaredAt).toLocaleDateString("en-ZA")}</p>
                </div>
                <p className="text-xl font-black">{fmtZAR(d.amount)}</p>
                <Separator className="my-2" />
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><p className="text-muted-foreground">Shares</p><p className="font-semibold">{d.totalShares.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Per share</p><p className="font-semibold">{fmtZAR(d.perShareAmount)}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Database-authoritative shareholder register */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Shareholder register</h3>
            <p className="mt-1 text-xs text-muted-foreground">Issued and revoked certificates from the authoritative share ledger. Showing {shares.length.toLocaleString()} of {registerSummary.registerEntries.toLocaleString()} entries.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportRegister} disabled={visibleRegister.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export visible CSV
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[10px] uppercase text-muted-foreground">Shareholders</p><p className="text-xl font-black">{registerSummary.shareholderCount.toLocaleString()}</p></div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[10px] uppercase text-muted-foreground">Issued certificates</p><p className="text-xl font-black">{registerSummary.certificateCount.toLocaleString()}</p></div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[10px] uppercase text-muted-foreground">Issued shares</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{registerSummary.issuedShares.toLocaleString()}</p></div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[10px] uppercase text-muted-foreground">Revoked shares</p><p className="text-xl font-black text-rose-700 dark:text-rose-400">{registerSummary.revokedShares.toLocaleString()}</p></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={registerSearch} onChange={(event) => setRegisterSearch(event.target.value)} placeholder="Search holder, profile, certificate or order" className="pl-9" />
          </div>
          <Select value={registerStatus} onValueChange={setRegisterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="ISSUED">Issued</SelectItem><SelectItem value="REVOKED">Revoked</SelectItem></SelectContent>
          </Select>
          <Select value={registerSource} onValueChange={setRegisterSource}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All sources</SelectItem><SelectItem value="presale">Presale</SelectItem><SelectItem value="wallet">Wallet</SelectItem></SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-x-auto scrollbar-kasi max-h-[32rem]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Shareholder</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Campaign / source</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Certificate</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Shares</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Issued</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegister.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No share register entries match these filters.</td></tr>
              ) : visibleRegister.map((s) => {
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2"><p className="font-semibold text-xs">{s.holderName}</p><p className="text-[10px] text-muted-foreground">{s.email}</p><p className="text-[10px] text-muted-foreground font-mono">{s.profileNumber}</p></td>
                    <td className="px-3 py-2"><p className="text-xs font-medium">{s.campaignName ?? (s.source === "presale" ? "Presale" : "Direct share ledger")}</p><p className="text-[10px] text-muted-foreground font-mono">{s.orderReference ?? s.source}</p></td>
                    <td className="px-3 py-2 font-mono text-xs">{s.certificateNo}</td>
                    <td className="px-3 py-2 text-right"><p className="font-semibold">{s.quantity.toLocaleString()}</p>{s.bonusQuantity > 0 && <p className="text-[10px] text-amber-700">includes {s.bonusQuantity} bonus</p>}</td>
                    <td className="px-3 py-2 text-xs">{new Date(s.createdAt).toLocaleDateString("en-ZA")}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={s.status === "ISSUED" ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]" : "bg-rose-50 text-rose-700 border-rose-200 text-[9px]"}>{s.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 sticky bottom-0">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Visible register total ({visibleRegister.length} certificate(s))</td>
                <td className="px-3 py-2 text-right font-semibold text-xs">{visibleRegister.reduce((sum, share) => sum + (share.status === "ISSUED" ? share.quantity : 0), 0).toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Edit phase dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-amber-600" /> Edit Phase {editing?.phase}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div><Label>Price per share (USD)</Label><Input type="number" value={editing.pricePerShare} onChange={(e) => setEditing({ ...editing, pricePerShare: parseFloat(e.target.value) || 0 })} className="mt-1.5" /></div>
              <div><Label>Total shares</Label><Input type="number" value={editing.totalShares} onChange={(e) => setEditing({ ...editing, totalShares: parseInt(e.target.value) || 0 })} className="mt-1.5" /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="UPCOMING">Upcoming</SelectItem><SelectItem value="SOLD_OUT">Sold out</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><p className="font-semibold text-sm">Buy One Get One Free</p><p className="text-xs text-muted-foreground">Phase 1 bonus special (legacy FREE shares)</p></div>
                <Switch checked={editing.bonusBuyOneGet} onCheckedChange={(v) => setEditing({ ...editing, bonusBuyOneGet: v })} />
              </div>
              {editing.status === "OPEN" && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">⚠️ Changing price affects new purchases immediately.</p>
                  <p>Already sold shares keep their original certificate values.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePhase} className="bg-gradient-to-r from-amber-500 to-amber-600"><Save className="h-4 w-4 mr-1.5" />Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Declare profit share dialog */}
      <Dialog open={dividendOpen} onOpenChange={setDividendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-600" /> Declare daily profit share</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Total profit share amount (ZAR)</Label>
              <Input type="number" value={dividendAmount} onChange={(e) => setDividendAmount(e.target.value)} className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1.5">This will be distributed equally across all {totals.totalActiveShares.toLocaleString()} active shares held by members with ACTIVE subscriptions. The daily profit pool is approximately {fmtZAR(DAILY_PROFIT_POOL_ZAR)}.</p>
            </div>
            <Card className="p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total amount</span><span className="font-semibold">{fmtZAR(parseFloat(dividendAmount) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Eligible shares</span><span className="font-semibold">{totals.totalActiveShares.toLocaleString()}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="font-semibold">Per share</span><span className="font-bold text-amber-600">{fmtZAR(totals.totalActiveShares > 0 ? (parseFloat(dividendAmount) || 0) / totals.totalActiveShares : 0)}</span></div>
            </Card>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <p>The profit share will be immediately distributed to all eligible shareholders as a DIVIDEND transaction, paid to their Roots Bank accounts.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDividendOpen(false)}>Cancel</Button>
            <Button onClick={declareDividend} disabled={declaring} className="bg-gradient-to-r from-amber-500 to-amber-600">{declaring ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Distributing...</> : <>Declare & distribute</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
