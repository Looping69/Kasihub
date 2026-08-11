"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, Loader2, Save, DollarSign, Percent, Users,
  Building2, Calendar, Coins,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useKasiStore } from "@/lib/store";
import { AdminReceivingRoutes } from "@/components/admin/admin-receiving-routes";

interface SettingItem { key: string; value: string; }
interface GroupedSettings { [category: string]: SettingItem[]; }

const CATEGORY_META: Record<string, { label: string; icon: typeof Settings; desc: string }> = {
  matrix: { label: "Matrix commission", icon: Users, desc: "Per-level commission rates (R47 of R140 distributed up 6 levels)" },
  subscription: { label: "Subscription amounts", icon: DollarSign, desc: "Monthly membership fees by type and region" },
  tax: { label: "Tax configuration", icon: Percent, desc: "SARS tax threshold and rate for high earners" },
  rootsbank: { label: "Roots Bank pioneer", icon: Building2, desc: "Pioneer pool percentage and target count" },
  mall: { label: "Mall configuration", icon: Building2, desc: "Member threshold for mall construction" },
  shares: { label: "Share dividends", icon: Coins, desc: "Daily profit pool distributed to shareholders" },
  pool: { label: "KasiPool payouts", icon: Calendar, desc: "Nightly payout schedule" },
};

const LABEL_MAP: Record<string, string> = {
  commission_per_level: "Commission per level (R, JSON array)",
  subscription_amount_individual: "Individual subscription (ZAR)",
  subscription_amount_company: "Company subscription (ZAR)",
  subscription_amount_intl_individual: "International individual (USD)",
  subscription_amount_intl_company: "International company (USD)",
  tax_threshold_monthly: "Tax threshold (ZAR/month)",
  tax_rate: "Tax rate (%)",
  pioneer_pool_pct: "Pioneer pool share (%)",
  pioneer_pool_target: "Pioneer target count",
  mall_member_threshold: "Mall construction threshold (members)",
  daily_profit_pool_usd: "Daily profit pool (USD)",
  payout_time_sast: "Payout time (SAST)",
};

export function AdminSettings() {
  const [settings, setSettings] = useState<GroupedSettings>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(key: string) {
    const value = edits[key];
    if (value === undefined) return;
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Save failed");
      } else {
        toast.success(`${LABEL_MAP[key] || key} updated`);
        setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><Settings className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">Exco configuration</h2></div>
        <p className="text-sm text-muted-foreground">Edit platform-wide settings without code changes. Changes take effect immediately.</p>
      </div>

      {/* Warning banner */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Exco-controlled settings</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">These values govern commission, subscription, tax, and pool behavior across the platform. Changes require Exco approval.</p>
          </div>
        </div>
      </Card>

      {/* Settings by category */}
      {Object.entries(settings).map(([category, items]) => {
        const meta = CATEGORY_META[category] || { label: category, icon: Settings, desc: "" };
        const Icon = meta.icon;
        return (
          <motion.div key={category} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center"><Icon className="h-5 w-5 text-white" /></div>
                <div><h3 className="font-bold">{meta.label}</h3><p className="text-xs text-muted-foreground">{meta.desc}</p></div>
              </div>
              <Separator className="mb-4" />
              <div className="space-y-3">
                {items.map((s) => {
                  const val = edits[s.key] !== undefined ? edits[s.key] : s.value;
                  const isJson = s.key === "commission_per_level";
                  const changed = edits[s.key] !== undefined && edits[s.key] !== s.value;
                  return (
                    <div key={s.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs">{LABEL_MAP[s.key] || s.key}</Label>
                        {isJson ? (
                          <Input value={val} onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })} className="mt-1 font-mono text-xs" />
                        ) : (
                          <Input value={val} onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })} className="mt-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:self-end">
                        {changed && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">modified</Badge>}
                        <Button size="sm" variant={changed ? "default" : "outline"} disabled={!changed || saving === s.key} onClick={() => save(s.key)} className={changed ? "bg-gradient-to-r from-emerald-600 to-emerald-500" : ""}>
                          {saving === s.key ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Saving</> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        );
      })}

      {/* Silo config link */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0"><Percent className="h-5 w-5 text-emerald-600" /></div>
          <div className="text-sm">
            <p className="font-semibold mb-1">Mall silo percentages</p>
            <p className="text-xs text-muted-foreground">The Exco-editable silo split table (Cost of Sale, VAT, SharePool, KasiPool) is managed in the KasiMall admin section.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => useKasiStore.getState().setAdminView("mall")}>Go to KasiMall silos</Button>
          </div>
        </div>
      </Card>

      <AdminReceivingRoutes />
    </div>
  );
}
