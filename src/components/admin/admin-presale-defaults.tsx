// Author: Klaasvaakie ( |╲ )
"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Setting = { key: string; value: string };

const DEFAULTS: Array<{ key: string; label: string; placeholder: string; type?: "number" }> = [
  { key: "presale_default_issuer_name", label: "Issuer", placeholder: "e.g. Solidus Holdings" },
  { key: "presale_default_share_class", label: "Share class", placeholder: "e.g. Ordinary shares" },
  { key: "presale_default_receiving_address", label: "Receiving address", placeholder: "Wallet address for new campaigns" },
  { key: "presale_default_token_contract", label: "USDT token contract", placeholder: "Required before activating a campaign" },
  { key: "presale_default_usdt_per_usd", label: "Server USDT per USD quote", placeholder: "1.000000", type: "number" },
  { key: "presale_default_min_confirmations", label: "Minimum confirmations", placeholder: "15", type: "number" },
  { key: "presale_default_payment_window_minutes", label: "Payment window (minutes)", placeholder: "30", type: "number" },
];

export function AdminPresaleDefaults() {
  const [values, setValues] = useState<Record<string, string>>({
    presale_default_network: "bsc",
    presale_default_min_confirmations: "15",
    presale_default_payment_window_minutes: "30",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { raw?: Setting[] };
        setValues((current) => ({ ...current, ...Object.fromEntries((data.raw ?? []).filter((item) => item.key.startsWith("presale_default_")).map((item) => [item.key, item.value])) }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const results = await Promise.all(DEFAULTS.concat({ key: "presale_default_network", label: "", placeholder: "" }).map(async ({ key }) => {
        const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value: values[key] ?? "" }) });
        if (!response.ok) throw new Error(key);
      }));
      void results;
      toast.success("Campaign defaults saved for future campaigns");
    } catch {
      toast.error("Some defaults could not be saved. Nothing has been activated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="p-5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center"><SlidersHorizontal className="h-5 w-5 text-violet-600" /></div>
        <div><h3 className="font-bold">Private campaign defaults</h3><p className="text-xs text-muted-foreground mt-0.5">Used to prefill new campaigns only. Review every campaign before activation.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label className="text-xs">Network</Label><Select value={values.presale_default_network || "bsc"} onValueChange={(value) => setValues((current) => ({ ...current, presale_default_network: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bsc">BNB Smart Chain (BSC)</SelectItem><SelectItem value="tron">TRON</SelectItem></SelectContent></Select></div>
        {DEFAULTS.map((field) => <div key={field.key}><Label className="text-xs">{field.label}</Label><Input type={field.type} value={values[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1" /></div>)}
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save} disabled={saving} className="bg-gradient-to-r from-violet-600 to-violet-500">{saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving</> : <><Save className="h-4 w-4 mr-1.5" />Save campaign defaults</>}</Button></div>
    </Card>
  );
}
