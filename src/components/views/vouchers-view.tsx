// Author: Klaasvaakie ( |╲ )
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock, Gift, KeyRound,
  Loader2, MessageCircle, ShieldCheck, Smartphone, Ticket, Wallet, XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useKasiStore } from "@/lib/store";
import { toast } from "sonner";

interface Voucher {
  id: string; code: string; title: string; description: string; provider: string;
  value: number; status: string; expiryDate: string; anniversaryDate: string | null;
  wablastSent: boolean; daysToExpiry: number; daysToAnniversary: number | null;
}

interface VoucherData {
  vouchers: Voucher[]; active: number; expiringSoon: number; expired: number; totalValue: number;
}

interface WhatsAppStatus {
  verified: boolean; phone: string | null; verifiedAt: string | null; pendingVerificationExpiresAt: string | null;
}

export function VouchersView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<VoucherData | null>(null);
  const [whatsApp, setWhatsApp] = useState<WhatsAppStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"request" | "verify" | null>(null);

  async function load() {
    if (!currentMember) return;
    try {
      const [voucherResponse, statusResponse] = await Promise.all([
        fetch(`/api/vouchers?memberId=${currentMember.id}`, { cache: "no-store" }),
        fetch(`/api/whatsapp/status?memberId=${currentMember.id}`, { cache: "no-store" }),
      ]);
      if (!voucherResponse.ok || !statusResponse.ok) throw new Error("Unable to load voucher delivery details");
      const [voucherData, statusData] = await Promise.all([voucherResponse.json(), statusResponse.json()]);
      setData(voucherData);
      setWhatsApp(statusData);
      setPhone(statusData.phone ?? currentMember.mobile ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load vouchers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [currentMember]);

  async function requestCode() {
    if (!currentMember || !phone.trim()) return;
    setSubmitting("request");
    try {
      const response = await fetch("/api/whatsapp/request-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id, phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send verification code");
      toast.success(result.message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send verification code");
    } finally {
      setSubmitting(null);
    }
  }

  async function verifyCode() {
    if (!currentMember || code.length !== 6) return;
    setSubmitting("verify");
    try {
      const response = await fetch("/api/whatsapp/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to verify code");
      toast.success(result.message);
      setCode("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify code");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading || !data || !whatsApp) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const active = data.vouchers.filter((voucher) => voucher.status === "ACTIVE" && voucher.daysToExpiry > 0);
  const expiring = active.filter((voucher) => voucher.daysToAnniversary !== null && voucher.daysToAnniversary > 0 && voucher.daysToAnniversary <= 5);
  const expired = data.vouchers.filter((voucher) => voucher.status === "EXPIRED" || voucher.daysToExpiry <= 0);
  const pending = Boolean(whatsApp.pendingVerificationExpiresAt) && !whatsApp.verified;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><Ticket className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">My Vouchers</h2></div>
        <p className="text-sm text-muted-foreground">Verify your WhatsApp number once. KaSiHub then handles voucher delivery and anniversary reminders automatically.</p>
      </div>

      <Card className="overflow-hidden border-sky-200 dark:border-sky-900">
        <div className="bg-gradient-to-r from-sky-700 to-blue-600 p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-sky-100">WhatsApp voucher delivery</p><h3 className="mt-1 text-xl font-black">Three steps. One automatic flow.</h3></div>
            <Badge className={whatsApp.verified ? "bg-emerald-400 text-emerald-950" : "bg-orange-400 text-orange-950"}>{whatsApp.verified ? "Verified" : "Verification required"}</Badge>
          </div>
        </div>
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="p-5 lg:border-r">
            <StepTitle number="1" icon={Smartphone} title="Verify WhatsApp number" complete={whatsApp.verified} />
            {whatsApp.verified ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />{whatsApp.phone}</div>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Verified {whatsApp.verifiedAt ? new Date(whatsApp.verifiedAt).toLocaleDateString("en-ZA") : "successfully"}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5"><Label htmlFor="whatsapp-number">WhatsApp number</Label><Input id="whatsapp-number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+27 82 123 4567" disabled={pending} /></div>
                {!pending ? (
                  <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={requestCode} disabled={submitting !== null || !phone.trim()}>{submitting === "request" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}Send verification code</Button>
                ) : (
                  <>
                    <div className="space-y-1.5"><Label htmlFor="whatsapp-code">6-digit verification code</Label><Input id="whatsapp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="text-center text-lg tracking-[0.4em]" /></div>
                    <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={verifyCode} disabled={submitting !== null || code.length !== 6}>{submitting === "verify" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Verify number</Button>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { setWhatsApp({ ...whatsApp, pendingVerificationExpiresAt: null }); setCode(""); }}>Use a different number</Button>
                  </>
                )}
              </div>
            )}
          </div>
          <DeliveryStep number="2" icon={MessageCircle} title="Active vouchers delivered" enabled={whatsApp.verified} text="Once verified, all active vouchers are queued automatically for delivery to your WhatsApp number." />
          <DeliveryStep number="3" icon={CalendarClock} title="Five-day expiry reminder" enabled={whatsApp.verified} text="Five days before your anniversary date, expiring vouchers are queued again as a reminder to redeem them." />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Active vouchers" value={String(data.active)} icon={Ticket} />
        <Stat label="Total value" value={fmt(data.totalValue)} icon={Wallet} tone="text-emerald-600" />
        <Stat label="Expiring soon" value={String(data.expiringSoon)} icon={AlertTriangle} tone="text-amber-600" note="within 5 days" />
        <Stat label="Expired" value={String(data.expired)} icon={XCircle} tone="text-rose-600" />
      </div>

      {active.length > 0 && <Card className="p-5"><h3 className="font-bold mb-4 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Active vouchers ({active.length})</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{active.map((voucher, index) => <VoucherCard key={voucher.id} voucher={voucher} index={index} fmt={fmt} />)}</div></Card>}

      {expiring.length > 0 && <Card className="p-5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-white" /></div><div><p className="font-bold text-amber-800 dark:text-amber-300">{expiring.length} voucher(s) expiring within 5 days</p><p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{whatsApp.verified ? "Your automatic WhatsApp reminder is enabled." : "Verify your WhatsApp number above to receive the automatic reminder."}</p></div></div></Card>}

      {expired.length > 0 && <Card className="p-5"><h3 className="font-bold mb-4 flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-600" />Expired vouchers ({expired.length})</h3><div className="space-y-2">{expired.map((voucher) => <div key={voucher.id} className="flex items-center gap-3 p-3 rounded-lg border opacity-60"><Ticket className="h-4 w-4" /><div className="flex-1"><p className="text-sm font-medium line-through">{voucher.title}</p><p className="text-xs font-mono">{voucher.code}</p></div><span className="text-xs text-rose-600">Expired {new Date(voucher.expiryDate).toLocaleDateString("en-ZA")}</span></div>)}</div></Card>}

      <Card className="p-5 bg-muted/30 border-dashed"><div className="flex items-start gap-3"><MessageCircle className="h-5 w-5 text-emerald-600 mt-1" /><div className="text-sm"><p className="font-semibold mb-1">How voucher delivery works</p><ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside"><li>Active vouchers are delivered directly to your verified WhatsApp number.</li><li>5 days before your anniversary date, expiring vouchers are sent to you again via WhatsApp as a reminder to redeem them within 5 days.</li><li>Each voucher has a unique code — present it at the provider to redeem.</li><li>Expired vouchers remain visible for record-keeping but cannot be redeemed.</li></ul></div></div></Card>
    </div>
  );
}

type IconType = typeof Ticket;
function StepTitle({ number, icon: Icon, title, complete }: { number: string; icon: IconType; title: string; complete: boolean }) { return <div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${complete ? "bg-emerald-500 text-white" : "bg-orange-100 text-orange-700"}`}>{complete ? <CheckCircle2 className="h-5 w-5" /> : number}</div><div><p className="text-xs text-muted-foreground">Step {number}</p><p className="font-bold flex items-center gap-1.5"><Icon className="h-4 w-4" />{title}</p></div></div>; }
function DeliveryStep({ number, icon, title, enabled, text }: { number: string; icon: IconType; title: string; enabled: boolean; text: string }) { return <div className={`p-5 lg:border-r last:border-r-0 ${enabled ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "opacity-65"}`}><StepTitle number={number} icon={icon} title={title} complete={enabled} /><p className="mt-4 text-sm text-muted-foreground">{text}</p><Badge variant="outline" className="mt-4">{enabled ? "Automatic delivery enabled" : "Enabled after verification"}</Badge></div>; }
function Stat({ label, value, icon: Icon, tone = "", note }: { label: string; value: string; icon: IconType; tone?: string; note?: string }) { return <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className={`h-4 w-4 ${tone || "text-emerald-600"}`} /></div><p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>{note && <p className="text-[10px] text-muted-foreground mt-1">{note}</p>}</Card>; }
function VoucherCard({ voucher, index, fmt }: { voucher: Voucher; index: number; fmt: (value: number) => string }) { return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`relative p-4 rounded-xl border-2 ${voucher.daysToExpiry <= 5 ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-emerald-200 dark:border-emerald-900"}`}>{voucher.anniversaryDate && <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[9px]"><Gift className="h-2.5 w-2.5 mr-0.5" />Anniversary</Badge>}<div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${voucher.daysToExpiry <= 5 ? "bg-amber-500" : "bg-emerald-500"}`}><Ticket className="h-5 w-5 text-white" /></div><div><p className="font-bold text-sm">{voucher.title}</p><p className="text-xs text-muted-foreground">{voucher.provider}</p></div></div><p className="text-2xl font-black mt-3">{fmt(voucher.value)}</p><p className="text-xs text-muted-foreground mt-1">{voucher.description}</p><Separator className="my-3" /><div className="flex items-center justify-between text-xs"><span className="font-mono text-muted-foreground">{voucher.code}</span><span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{voucher.daysToExpiry} day{voucher.daysToExpiry !== 1 ? "s" : ""} left</span></div>{voucher.wablastSent && <Badge variant="outline" className="mt-2 text-[9px] bg-sky-50 text-sky-700 border-sky-200"><MessageCircle className="h-2.5 w-2.5 mr-0.5" />Queued for WhatsApp delivery</Badge>}</motion.div>; }
