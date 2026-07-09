"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Loader2, Save, Store, PieChart, TrendingUp,
  AlertTriangle, Edit, Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Silo {
  id: string; name: string; percentage: number; description: string | null;
  color: string; sortOrder: number;
}
interface MallTx {
  id: string; nfcTagId: string; storeName: string; amount: number;
  costOfSale: number; vat: number; sharePool: number; kasiPool: number;
  status: string; createdAt: string;
}

export function AdminMall() {
  const [silos, setSilos] = useState<Silo[]>([]);
  const [editSilos, setEditSilos] = useState<Silo[] | null>(null);
  const [transactions, setTransactions] = useState<MallTx[]>([]);
  const [totals, setTotals] = useState({ amount: 0, costOfSale: 0, vat: 0, sharePool: 0, kasiPool: 0 });
  const [storePerformance, setStorePerformance] = useState<{ store: string; revenue: number; count: number }[]>([]);
  const [mallProgress, setMallProgress] = useState({ memberCount: 0, mallThreshold: 0, pct: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/mall", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setSilos(d.silos);
        setTransactions(d.transactions);
        setTotals(d.totals);
        setStorePerformance(d.storePerformance);
        setMallProgress({ memberCount: d.memberCount, mallThreshold: d.mallThreshold, pct: d.mallProgress });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveSilos() {
    if (!editSilos) return;
    const total = editSilos.reduce((s, x) => s + parseFloat(String(x.percentage)), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Percentages must total 100%. Current: ${total}%`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/silos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silos: editSilos.map((s) => ({ id: s.id, percentage: s.percentage, name: s.name, description: s.description })) }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Save failed");
      } else {
        toast.success("Silo configuration updated");
        setSilos(result.silos);
        setEditSilos(null);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const editingTotal = editSilos ? editSilos.reduce((s, x) => s + parseFloat(String(x.percentage)), 0) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><Building2 className="h-5 w-5 text-rose-600" /><h2 className="text-2xl font-black tracking-tight">KasiMall management</h2></div>
        <p className="text-sm text-muted-foreground">All transactions across the platform, store performance, and the Exco-editable silo configuration.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total mall revenue</p><TrendingUp className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(totals.amount)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Transactions</p><Store className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1">{transactions.length}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">SharePool distributed</p><PieChart className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1 text-amber-600">{fmt(totals.sharePool)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">KasiPool distributed</p><PieChart className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1 text-emerald-600">{fmt(totals.kasiPool)}</p></Card>
      </div>

      {/* Silo config (Exco-editable) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold flex items-center gap-2"><PieChart className="h-4 w-4 text-emerald-600" /> Silo configuration</h3>
            <p className="text-xs text-muted-foreground">Exco-editable — every KasiMall payment splits across these silos instantly.</p>
          </div>
          {editSilos ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditSilos(null)}>Cancel</Button>
              <Button size="sm" onClick={saveSilos} disabled={saving} className="bg-gradient-to-r from-emerald-600 to-emerald-500">{saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Saving</> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditSilos([...silos])}><Edit className="h-3.5 w-3.5 mr-1" />Edit splits</Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pie visualization */}
          <Card className="p-5 bg-muted/30 flex items-center justify-center">
            <div className="w-full">
              <div className="relative w-48 h-48 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {(() => {
                    let offset = 0;
                    const activeSilos = editSilos || silos;
                    return activeSilos.map((s) => {
                      const dash = (s.percentage / 100) * 251.2;
                      const circle = <circle key={s.id} cx="50" cy="50" r="40" fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${dash} 251.2`} strokeDashoffset={-offset} />;
                      offset += dash;
                      return circle;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-muted-foreground">Total processed</p>
                  <p className="text-lg font-black">{fmt(totals.amount)}</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">Current silo split</p>
            </div>
          </Card>

          {/* Silo list / editor */}
          <div className="space-y-3">
            {(editSilos || silos).map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-lg border border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                    {editSilos ? (
                      <Input value={s.name} onChange={(e) => setEditSilos(editSilos.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x))} className="h-7 text-sm font-semibold w-48" />
                    ) : (
                      <span className="font-semibold text-sm">{s.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editSilos ? (
                      <>
                        <Input type="number" value={s.percentage} onChange={(e) => setEditSilos(editSilos.map((x) => x.id === s.id ? { ...x, percentage: parseFloat(e.target.value) || 0 } : x))} className="h-8 w-20 text-right" />
                        <span className="text-sm font-bold">%</span>
                      </>
                    ) : (
                      <span className="text-lg font-black" style={{ color: s.color }}>{s.percentage}%</span>
                    )}
                  </div>
                </div>
                {editSilos ? (
                  <Input value={s.description || ""} onChange={(e) => setEditSilos(editSilos.map((x) => x.id === s.id ? { ...x, description: e.target.value } : x))} className="h-7 text-xs" placeholder="Description" />
                ) : (
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                )}
                <p className="text-xs font-semibold mt-1">of total: <span className="font-mono">{fmt(totals.amount * s.percentage / 100)}</span></p>
              </motion.div>
            ))}
            {editSilos && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${Math.abs(editingTotal - 100) < 0.01 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"}`}>
                {Math.abs(editingTotal - 100) < 0.01 ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span className="text-sm font-semibold">Total: {editingTotal}%{Math.abs(editingTotal - 100) < 0.01 ? " ✓ valid" : " — must equal 100%"}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Store performance + mall progress */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Store className="h-4 w-4 text-rose-600" /> Store performance</h3>
          <div className="space-y-2">
            {storePerformance.map((s, i) => {
              const maxRev = storePerformance[0]?.revenue || 1;
              return (
                <div key={s.store} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{s.store}</span><span className="text-muted-foreground">{s.count} txns</span></div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full" style={{ width: `${(s.revenue / maxRev) * 100}%` }} /></div>
                  </div>
                  <span className="text-sm font-bold font-mono w-24 text-right">{fmt(s.revenue)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-4">Mall construction progress</h3>
          <div className="text-center py-4">
            <p className="text-3xl font-black">{mallProgress.memberCount.toLocaleString()} / {mallProgress.mallThreshold.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">members registered in zone</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden mt-4"><div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full" style={{ width: `${mallProgress.pct}%` }} /></div>
            <p className="text-xs text-muted-foreground mt-2">{mallProgress.pct.toFixed(1)}% to construction threshold</p>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><p className="text-xl font-black text-emerald-600">{(mallProgress.mallThreshold - mallProgress.memberCount).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">members needed</p></div>
            <div><p className="text-xl font-black text-amber-600">Soweto</p><p className="text-[10px] text-muted-foreground">target zone</p></div>
          </div>
        </Card>
      </div>

      {/* Transactions table */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">All mall transactions</h3>
        <div className="overflow-x-auto scrollbar-kasi max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Store</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden md:table-cell">NFC Tag</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Amount</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">Cost</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">VAT</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">SharePool</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">KasiPool</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden xl:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2"><p className="font-semibold text-xs">{t.storeName}</p></td>
                  <td className="px-3 py-2 hidden md:table-cell font-mono text-[10px] text-muted-foreground">{t.nfcTagId}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(t.amount)}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell font-mono text-xs">{fmt(t.costOfSale)}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell font-mono text-xs">{fmt(t.vat)}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell font-mono text-xs text-amber-600">{fmt(t.sharePool)}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell font-mono text-xs text-emerald-600">{fmt(t.kasiPool)}</td>
                  <td className="px-3 py-2 hidden xl:table-cell text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
