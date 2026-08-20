// Author: Klaasvaakie ( |╲ )
"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReceivingRoute = {
  id: string;
  provider: "kasihub" | "remitano";
  network: "tron" | "bsc";
  currency: "USDT";
  addressReference: string;
  tokenContract: string;
  decimals: number;
  minimumConfirmations: number;
  intentTtlSeconds: number;
  status: "active" | "retired";
  custodyReconciliationRequired: boolean;
};

type DraftReceivingRoute = {
  provider: "remitano";
  network: "tron" | "bsc";
  addressReference: string;
  tokenContract: string;
  decimals: string;
  minimumConfirmations: string;
  intentTtlSeconds: string;
};

const initialRoute: DraftReceivingRoute = {
  provider: "remitano" as const,
  network: "bsc" as const,
  addressReference: "",
  tokenContract: "",
  decimals: "18",
  minimumConfirmations: "15",
  intentTtlSeconds: "1800",
};

export function AdminReceivingRoutes() {
  const [routes, setRoutes] = useState<ReceivingRoute[]>([]);
  const [route, setRoute] = useState(initialRoute);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/payments/receiving-config", { cache: "no-store" });
    if (!response.ok) throw new Error("unable_to_load_receiving_routes");
    const data = await response.json() as { configurations: ReceivingRoute[] };
    setRoutes(data.configurations);
  }

  useEffect(() => {
    load().catch(() => toast.error("Could not load receiving routes")).finally(() => setLoading(false));
  }, []);

  async function register() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/payments/receiving-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...route,
          currency: "USDT",
          decimals: Number(route.decimals),
          minimumConfirmations: Number(route.minimumConfirmations),
          intentTtlSeconds: Number(route.intentTtlSeconds),
          custodyReconciliationRequired: true,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "unable_to_register_receiving_route");
      toast.success("Receiving route registered and prior route retired");
      setRoute(initialRoute);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register receiving route");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"><WalletCards className="h-5 w-5" /></div>
        <div><h3 className="font-bold">International USDT receiving routes</h3><p className="mt-1 text-xs text-muted-foreground">Server-controlled routes for approved international payment obligations. Changing a network retires its prior active receiver.</p></div>
      </div>

      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="receiving-network">Network</Label><select id="receiving-network" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={route.network} onChange={(event) => setRoute({ ...route, network: event.target.value as "tron" | "bsc", decimals: event.target.value === "tron" ? "6" : "18" })}><option value="bsc">BNB Smart Chain (BEP20)</option><option value="tron">TRON (TRC20)</option></select></div>
          <div><Label htmlFor="receiving-provider">Collection provider</Label><Input id="receiving-provider" className="mt-1" value="Remitano" disabled /></div>
          <div className="sm:col-span-2"><Label htmlFor="receiving-address">Deposit address</Label><Input id="receiving-address" className="mt-1 font-mono text-xs" value={route.addressReference} onChange={(event) => setRoute({ ...route, addressReference: event.target.value })} placeholder="Exact provider-controlled deposit address" /></div>
          <div className="sm:col-span-2"><Label htmlFor="token-contract">Exact USDT token contract</Label><Input id="token-contract" className="mt-1 font-mono text-xs" value={route.tokenContract} onChange={(event) => setRoute({ ...route, tokenContract: event.target.value })} placeholder="Verified contract for the selected network" /></div>
          <div><Label htmlFor="route-decimals">Token decimals</Label><Input id="route-decimals" className="mt-1" inputMode="numeric" value={route.decimals} onChange={(event) => setRoute({ ...route, decimals: event.target.value })} /></div>
          <div><Label htmlFor="route-confirmations">Minimum confirmations</Label><Input id="route-confirmations" className="mt-1" inputMode="numeric" value={route.minimumConfirmations} onChange={(event) => setRoute({ ...route, minimumConfirmations: event.target.value })} /></div>
          <div><Label htmlFor="route-ttl">Payment window (seconds)</Label><Input id="route-ttl" className="mt-1" inputMode="numeric" value={route.intentTtlSeconds} onChange={(event) => setRoute({ ...route, intentTtlSeconds: event.target.value })} /></div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Remitano is the inbound USDT custodian. Every route requires matching on-chain and Remitano deposit evidence before KaSiHub can settle the obligation. Registering a route does not issue shares or activate a public campaign.</span></div>
        <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" disabled={saving || !route.addressReference || !route.tokenContract} onClick={register}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering route</> : "Register receiving route"}</Button>
        {routes.length > 0 && <div className="mt-5 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configured routes</p>{routes.map((configured) => <div className="rounded-md border bg-background p-3 text-xs" key={configured.id}><strong className="uppercase">{configured.network}</strong> · {configured.provider} · {configured.status}<br /><span className="font-mono text-muted-foreground">{configured.addressReference}</span><br /><span className="text-muted-foreground">Custody reconciliation: {configured.custodyReconciliationRequired ? "required before settlement" : "not required"}</span></div>)}</div>}
      </>}
    </Card>
  );
}
