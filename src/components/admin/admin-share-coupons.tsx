"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type CouponState = {
  enabled: boolean; shareLimit: number; grantedShares: number;
  coupons: Array<{ id: string; recipientEmail: string; quantity: number; status: string; expiresAt: string; reason: string }>;
};

async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/admin/presale/coupons${path}`, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Coupon request failed");
  return result;
}

export function AdminShareCoupons({ campaigns }: { campaigns: Array<{ id: string; name: string }> }) {
  const [campaignId, setCampaignId] = useState("");
  const [state, setState] = useState<CouponState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<Array<{ id: string; recipientEmail: string; code: string }>>([]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : "Coupon request failed"); }
    finally { setBusy(false); }
  }

  return <Card className="mt-5 space-y-4 p-5">
    <h3 className="text-lg font-semibold">Free share coupons</h3>
    <p className="text-sm text-muted-foreground">Recipient-bound, single-use grants. Coupons do not collect money or add bonus shares. Redemption is disabled until enabled for a campaign.</p>
    <label className="block text-sm">Campaign<select className="mt-1 block w-full rounded border bg-background p-2" value={campaignId} disabled={busy} onChange={event => {
      const id = event.target.value; setCampaignId(id); setState(null); setGenerated([]);
      if (id) void run(async () => setState(await request(`/${encodeURIComponent(id)}`)));
    }}><option value="">Select campaign</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {state ? <>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        void run(async () => { await request("/policy", { campaignId, enabled: data.get("enabled") === "on", shareLimit: Number(data.get("limit")) }); setState(await request(`/${campaignId}`)); });
      }}>
        <label className="text-sm">Giveaway share limit<Input name="limit" type="number" min={state.grantedShares} max={1000000} defaultValue={state.shareLimit} key={state.shareLimit} required disabled={busy} /></label>
        <label className="flex gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={state.enabled} key={String(state.enabled)} disabled={busy} />Enable redemption</label>
        <Button disabled={busy}>Save coupon policy</Button><span className="text-sm">{state.grantedShares.toLocaleString()} shares granted</span>
      </form>
      <form className="space-y-3 border-t pt-4" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        void run(async () => {
          const result = await request("", { campaignId, recipientEmails: String(data.get("emails")).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean), quantity: Number(data.get("quantity")), expiresAt: new Date(String(data.get("expiry"))).toISOString(), reason: data.get("reason") });
          setGenerated(result.coupons); setState(await request(`/${campaignId}`));
        });
      }}>
        <label className="block text-sm">Recipient emails (one per line, maximum 100)<textarea name="emails" className="mt-1 block w-full rounded border bg-background p-2" required disabled={busy} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Shares per coupon<Input name="quantity" type="number" min={1} max={1000000} required disabled={busy} /></label><label className="text-sm">Expiry (your local time)<Input name="expiry" type="datetime-local" required disabled={busy} /></label></div>
        <label className="block text-sm">Internal reason<Input name="reason" minLength={3} maxLength={500} required disabled={busy} /></label>
        <Button disabled={busy}>Generate coupons</Button>
      </form>
      {generated.length ? <div role="status" className="space-y-2 rounded border p-3"><p className="text-sm font-medium">Copy these codes now. They cannot be retrieved again.</p>{generated.map(c => <div key={c.id} className="break-all text-sm"><span>{c.recipientEmail}: </span><code className="select-all">{c.code}</code></div>)}</div> : null}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Recipient</th><th>Shares</th><th>Status</th><th>Expiry</th><th>Action</th></tr></thead><tbody>{state.coupons.map(c => <tr key={c.id} className="border-t"><td className="py-2" title={c.reason}>{c.recipientEmail}</td><td>{c.quantity}</td><td>{c.status}</td><td>{new Date(c.expiresAt).toLocaleString()}</td><td>{c.status === "active" ? <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await request(`/${c.id}/revoke`, {}); setState(await request(`/${campaignId}`)); })}>Revoke</Button> : null}</td></tr>)}</tbody></table></div>
    </> : null}
    {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
  </Card>;
}
