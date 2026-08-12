"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Copy, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Offer = {
  name: string;
  issuerName: string;
  shareClass: string;
  priceUsdt: string;
  priceUsd: string;
  usdtPerUsd: string;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  sharesRemaining: number;
  invitationSharesRemaining: number;
  invitationEmail?: string;
  minConfirmations: number;
  paymentWindowMinutes: number;
  termsVersion: string;
};

type Order = {
  orderReference: string;
  campaign: string;
  issuerName: string;
  shareClass: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPriceUsdt: string;
  totalUsdt: string;
  status: string;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  minConfirmations: number;
  paymentDeadline: string;
  transactionHash?: string;
  confirmations: number;
  confirmedAt?: string;
  incorporationStatus: string;
};

function statusLabel(status: string) {
  return ({
    awaiting_payment: "Awaiting USDT payment",
    payment_submitted: "Transaction submitted",
    payment_detected: "Payment detected — confirming",
    confirmed: "Payment confirmed",
    expired: "Reservation expired",
    cancelled: "Order cancelled",
    incorporated: "Shares incorporated",
  } as Record<string, string>)[status] ?? status;
}

export function PresaleClient({ inviteToken }: { inviteToken: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inviteToken) { setLoading(false); return; }
    void fetch(`/api/presale/offer?invite=${encodeURIComponent(inviteToken)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Invitation unavailable");
        setOffer(payload.offer);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Invitation unavailable"))
      .finally(() => setLoading(false));
  }, [inviteToken]);

  const refreshOrder = useCallback(async () => {
    if (!order || !accessToken) return;
    // Keep the bearer-style access token out of browser history and request URLs.
    // Author: Klaasvaakie ( |╲ )
    const response = await fetch(`/api/presale/orders/${encodeURIComponent(order.orderReference)}`, {
      cache: "no-store",
      headers: { "X-Presale-Access-Token": accessToken },
    });
    if (response.ok) setOrder((await response.json()).order);
  }, [accessToken, order]);

  useEffect(() => {
    if (!order || !accessToken || ["confirmed", "expired", "cancelled", "incorporated"].includes(order.status)) return;
    const timer = window.setInterval(() => { void refreshOrder(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [accessToken, order, refreshOrder]);

  const totalPreview = offer ? Number(offer.priceUsdt) : 0;

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer) return;
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get("quantity"));
    try {
      const response = await fetch("/api/presale/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          inviteToken,
          buyerName: data.get("buyerName"),
          buyerEmail: data.get("buyerEmail"),
          buyerPhone: data.get("buyerPhone") || undefined,
          quantity,
          termsAccepted: data.get("termsAccepted") === "on",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Order could not be created");
      setOrder(payload.order);
      setAccessToken(payload.accessToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Order could not be created");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProof(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/presale/orders/${encodeURIComponent(order.orderReference)}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, txHash }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Transaction could not be submitted");
      await refreshOrder();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaction could not be submitted");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAddress() {
    if (!order) return;
    await navigator.clipboard.writeText(order.receivingAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <Shell><p className="text-sm text-slate-400">Validating private invitation…</p></Shell>;
  if (!inviteToken || (!offer && error)) return (
    <Shell>
      <Card className="w-full max-w-xl border-white/10 bg-white/5 text-white">
        <CardHeader><LockKeyhole className="mb-3 h-8 w-8 text-amber-400" /><h2 className="font-semibold leading-none">Private invitation required</h2>
          <CardDescription className="text-slate-400">This Class B share presale is not open to the general public. Use the private link issued to you.</CardDescription></CardHeader>
      </Card>
    </Shell>
  );
  if (!offer) return null;

  return (
    <Shell>
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[.18em] text-amber-300">
            <LockKeyhole className="h-3.5 w-3.5" /> Private presale
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{offer.name}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Reserve {offer.shareClass} shares issued by {offer.issuerName} and settle the reservation in USDT.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Price per paid share" value={`$${Number(offer.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Metric label="Server USDT quote" value={`${Number(offer.priceUsdt).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDT`} />
            <Metric label="Your allocation" value={`${offer.invitationSharesRemaining.toLocaleString()} shares`} />
            <Metric label="Network" value={offer.network} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5 text-sm leading-6 text-slate-300">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Clean separation by design</div>
            Presale orders and blockchain evidence are held in an isolated database. Confirmed orders are prepared for controlled incorporation into the live KaSiShares ledger; this page does not issue a final share certificate.
          </div>
        </section>

        {!order ? (
          <Card className="border-white/10 bg-white/[.06] text-white shadow-2xl shadow-black/20">
            <CardHeader><h2 className="font-semibold leading-none">Reserve your allocation</h2><CardDescription className="text-slate-400">Your payment window starts after this reservation is created.</CardDescription></CardHeader>
            <CardContent><form className="space-y-4" onSubmit={createOrder}>
              <Field label="Full legal name"><Input name="buyerName" required minLength={2} className="border-white/15 bg-black/20" /></Field>
              <Field label="Email address"><Input name="buyerEmail" type="email" required defaultValue={offer.invitationEmail} readOnly={Boolean(offer.invitationEmail)} className="border-white/15 bg-black/20" /></Field>
              <Field label="Phone number (optional)"><Input name="buyerPhone" className="border-white/15 bg-black/20" /></Field>
              <Field label="Number of shares"><Input name="quantity" type="number" required min={1} max={Math.min(offer.invitationSharesRemaining, offer.sharesRemaining)} defaultValue={1} className="border-white/15 bg-black/20" /></Field>
              <p className="text-xs text-slate-400">At 1 share, the payment is {totalPreview.toFixed(6)} USDT. The final amount is locked when the reservation is created.</p>
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input name="termsAccepted" type="checkbox" required className="mt-1" />
                <span>I accept the presale reservation acknowledgement (version {offer.termsVersion}) and understand that blockchain confirmation is payment evidence, not a Share Subscription Agreement or final share certificate.</span></label>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <Button className="h-11 w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={submitting}>{submitting ? "Creating reservation…" : "Reserve and view payment"}</Button>
            </form></CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-white/[.06] text-white shadow-2xl shadow-black/20">
            <CardHeader><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold leading-none">{statusLabel(order.status)}</h2><CardDescription className="mt-2 font-mono text-slate-400">{order.orderReference}</CardDescription></div>
              {order.status === "confirmed" ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <Clock3 className="h-8 w-8 text-amber-400" />}</div></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-200">Send exactly</p><p className="mt-1 text-3xl font-black text-white">{order.totalUsdt} USDT</p>
                <p className="mt-1 text-sm text-amber-100/80">using {order.network} only</p>
              </div>
              <div><p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Receiving address</p><div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 p-3 text-xs text-slate-200">{order.receivingAddress}</code>
                <Button type="button" variant="outline" size="icon" onClick={copyAddress} aria-label="Copy receiving address"><Copy className="h-4 w-4" /></Button></div>{copied && <p className="mt-1 text-xs text-emerald-300">Address copied</p>}</div>
              {order.tokenContract && <div><p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Verified USDT contract</p><code className="break-all text-xs text-slate-300">{order.tokenContract}</code></div>}
              {order.status === "confirmed" ? (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Payment has reached {order.confirmations} confirmations. Your order is secured for later incorporation into the live share ledger.</div>
              ) : (
                <form className="space-y-3" onSubmit={submitProof}><Field label="Transaction hash"><Input value={txHash} onChange={(event) => setTxHash(event.target.value)} required minLength={16} placeholder="Paste the blockchain transaction hash" className="border-white/15 bg-black/20" /></Field>
                  {error && <p className="text-sm text-red-300">{error}</p>}<Button className="w-full" disabled={submitting}>{submitting ? "Submitting…" : "Submit transaction for confirmation"}</Button></form>
              )}
              {order.transactionHash && <div className="text-xs text-slate-400">Confirmations: {order.confirmations}/{order.minConfirmations}<br /><span className="break-all font-mono">{order.transactionHash}</span></div>}
              <p className="text-xs leading-5 text-slate-500">Never send assets on another network. A transaction hash is not accepted as settled until the configured blockchain verifier confirms the receiver, token contract, amount, and confirmation depth.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#173d35_0%,#08110f_42%,#050706_100%)] px-5 py-8"><div className="mx-auto mb-12 flex max-w-6xl items-center justify-between"><Link href="/" className="text-xl font-black text-white">KaSi<span className="text-amber-400">HUB</span></Link><div className="flex items-center gap-2 text-xs text-slate-400"><WalletCards className="h-4 w-4" /> USDT settlement</div></div><div className="flex justify-center">{children}</div></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 font-bold text-white">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium text-slate-200"><span>{label}</span>{children}</label>;
}
