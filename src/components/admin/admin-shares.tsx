"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins, Loader2, Award, TrendingUp, Edit, Save, X, Plus,
  DollarSign, FileText, Calendar,
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

interface Phase {
  id: string; phase: number; pricePerShare: number; totalShares: number;
  soldShares: number; status: string; bonusBuyOneGet: boolean;
}
interface ShareRecord {
  id: string; phase: number; pricePerShare: number; quantity: number;
  totalAmount: number; certificateNo: string; status: string; createdAt: string;
  member: { profileNumber: string; name: string; email: string };
}
interface Dividend {
  id: string; amount: number; totalShares: number; perShareAmount: number;
  status: string; declaredAt: string; paidAt: string | null;
}

export function AdminShares() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [totals, setTotals] = useState({ totalActiveShares: 0, totalActiveValue: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Phase | null>(null);
  const [dividendOpen, setDividendOpen] = useState(false);
  const [dividendAmount, setDividendAmount] = useState("50000");
  const [declaring, setDeclaring] = useState(false);

  async function load() {
    try {
      const [sharesRes, statsRes] = await Promise.all([
        fetch("/api/admin/shares", { cache: "no-store" }),
        fetch("/api/admin/stats", { cache: "no-store" }),
      ]);
      if (sharesRes.ok) {
        const d = await sharesRes.json();
        setShares(d.shares);
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
        headers: { "Content-Type": "application/json" },
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
        toast.success(`Dividend declared! $${result.perShareAmount.toFixed(4)}/share distributed to ${result.distributedTo} members.`);
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

  const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><Coins className="h-5 w-5 text-amber-600" /><h2 className="text-2xl font-black tracking-tight">KasiShares management</h2></div>
          <p className="text-sm text-muted-foreground">Manage phases, declare dividends, and view all certificates.</p>
        </div>
        <Button onClick={() => setDividendOpen(true)} className="bg-gradient-to-r from-amber-500 to-amber-600"><Award className="h-4 w-4 mr-1.5" /> Declare dividend</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Active shares outstanding</p><Coins className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1">{totals.totalActiveShares.toLocaleString()}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total value sold</p><DollarSign className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmtUSD(totals.totalActiveValue)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Dividends declared</p><Award className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{dividends.length}</p></Card>
      </div>

      {/* Phases management */}
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

      {/* Dividends */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> Dividend history</h3>
        {dividends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No dividends declared yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dividends.map((d) => (
              <div key={d.id} className="p-4 rounded-xl border border-border/60 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{d.status}</Badge>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(d.declaredAt).toLocaleDateString("en-ZA")}</p>
                </div>
                <p className="text-xl font-black">{fmtUSD(d.amount)}</p>
                <Separator className="my-2" />
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><p className="text-muted-foreground">Shares</p><p className="font-semibold">{d.totalShares.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Per share</p><p className="font-semibold">{fmtUSD(d.perShareAmount)}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* All certificates */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-600" /> All certificates</h3>
        <div className="overflow-x-auto scrollbar-kasi max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Certificate</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Member</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Phase</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Qty</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Total</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{s.certificateNo}</td>
                  <td className="px-3 py-2"><p className="font-semibold text-xs">{s.member.name}</p><p className="text-[10px] text-muted-foreground font-mono">{s.member.profileNumber}</p></td>
                  <td className="px-3 py-2 text-xs">{s.phase}</td>
                  <td className="px-3 py-2 text-right font-semibold">{s.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmtUSD(s.totalAmount)}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className={s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]" : "bg-muted text-[9px]"}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
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
                <div><p className="font-semibold text-sm">Buy One Get One Free</p><p className="text-xs text-muted-foreground">Phase 1 bonus special</p></div>
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

      {/* Declare dividend dialog */}
      <Dialog open={dividendOpen} onOpenChange={setDividendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-600" /> Declare dividend</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Total dividend amount (USD)</Label>
              <Input type="number" value={dividendAmount} onChange={(e) => setDividendAmount(e.target.value)} className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1.5">This will be distributed equally across all {totals.totalActiveShares.toLocaleString()} active shares held by members with ACTIVE subscriptions.</p>
            </div>
            <Card className="p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total amount</span><span className="font-semibold">{fmtUSD(parseFloat(dividendAmount) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Eligible shares</span><span className="font-semibold">{totals.totalActiveShares.toLocaleString()}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="font-semibold">Per share</span><span className="font-bold text-amber-600">{fmtUSD(totals.totalActiveShares > 0 ? (parseFloat(dividendAmount) || 0) / totals.totalActiveShares : 0)}</span></div>
            </Card>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <p>The dividend will be immediately distributed to all eligible shareholders as a DIVIDEND transaction, paid to their Roots Bank accounts.</p>
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
