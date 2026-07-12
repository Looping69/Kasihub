"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UserPlus, Loader2, Gift, CheckCircle2, Clock, Send, Share2,
  Award, Users, TrendingUp, Copy, MessageCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useKasiStore } from "@/lib/store";
import { toast } from "sonner";

interface Referral {
  id: string;
  referralCode: string;
  referredName: string;
  referredEmail: string;
  referredMobile: string;
  status: string;
  rewardAmount: number;
  createdAt: string;
  convertedAt: string | null;
}

interface ReferralData {
  referrals: Referral[];
  stats: { total: number; registered: number; pending: number; totalRewards: number };
}

export function ReferView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "" });

  async function load() {
    if (!currentMember) return;
    try {
      const res = await fetch(`/api/referrals?memberId=${currentMember.id}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentMember]);

  async function submit() {
    if (!currentMember || !form.name || !form.email || !form.mobile) {
      toast.error("All fields are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerId: currentMember.id,
          referredName: form.name,
          referredEmail: form.email,
          referredMobile: form.mobile,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to create referral");
      } else {
        toast.success("Referral created! WhatsApp invitation will be sent via WABlast.");
        setOpen(false);
        setForm({ name: "", email: "", mobile: "" });
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  function copyReferralLink() {
    const link = `https://kasihub.co.za/join?ref=${currentMember?.profileNumber}`;
    navigator.clipboard?.writeText(link);
    toast.success("Referral link copied to clipboard!");
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-black tracking-tight">Refer an Enabler</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Grow the KaSiHUB community and earn rewards for every successful referral.
        </p>
      </div>

      {/* Introduction */}
      <Card className="p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative">
          <h3 className="text-xl font-black mb-3">Earn R50 for every Enabler you refer</h3>
          <p className="text-sm text-emerald-50 leading-relaxed mb-4">
            Invite friends, family, and businesses to join the KaSiHUB ecosystem. When they register
            as a paid member using your referral, you both earn rewards — and they get placed in your
            Eco-System downline.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <p className="text-3xl font-black">{data.stats.total}</p>
              <p className="text-xs text-emerald-100">Total referred</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black">{data.stats.registered}</p>
              <p className="text-xs text-emerald-100">Registered</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black">{fmt(data.stats.totalRewards)}</p>
              <p className="text-xs text-emerald-100">Rewards earned</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Referral link */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Share2 className="h-4 w-4 text-emerald-600" /> Your referral link</h3>
        <div className="flex gap-2">
          <Input
            readOnly
            value={`https://kasihub.co.za/join?ref=${currentMember?.profileNumber}`}
            className="font-mono text-sm"
          />
          <Button onClick={copyReferralLink} variant="outline">
            <Copy className="h-4 w-4 mr-1.5" /> Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share this link with potential Enablers. When they register, they&apos;ll be asked to confirm you as their upline.
        </p>
      </Card>

      {/* Refer someone */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Refer a new Enabler</h3>
            <p className="text-xs text-muted-foreground">Send a WhatsApp invitation directly to their phone</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
            <UserPlus className="h-4 w-4 mr-1.5" /> Refer someone
          </Button>
        </div>

        {data.referrals.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">No referrals yet</p>
            <p className="text-sm text-muted-foreground">Start referring to earn rewards!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  {r.status === "REGISTERED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{r.referredName}</p>
                  <p className="text-xs text-muted-foreground">{r.referredMobile} · {r.referredEmail}</p>
                </div>
                <div className="text-right">
                  {r.status === "REGISTERED" ? (
                    <>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">Registered</Badge>
                      {r.rewardAmount > 0 && <p className="text-xs font-bold text-emerald-600 mt-1">+{fmt(r.rewardAmount)}</p>}
                    </>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Pending</Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* How it works */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <h3 className="font-bold mb-4">How referrals work</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: UserPlus, title: "1. Refer", desc: "Enter the Enabler's details or share your referral link. They receive a WhatsApp invitation via WABlast." },
            { icon: CheckCircle2, title: "2. They register", desc: "The referred person joins KaSiHUB as a paid member and confirms you as their upline." },
            { icon: Gift, title: "3. You earn", desc: "You receive R50 referral reward, and they're placed in your Eco-System downline — earning you ongoing commissions." },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-3">
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <p className="font-bold text-sm">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Benefits */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <Award className="h-8 w-8 text-amber-600 mx-auto mb-2" />
          <p className="font-bold">R50 per referral</p>
          <p className="text-xs text-muted-foreground mt-1">Instant reward when they register</p>
        </Card>
        <Card className="p-5 text-center">
          <Users className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <p className="font-bold">Eco-System growth</p>
          <p className="text-xs text-muted-foreground mt-1">Referred members join your downline</p>
        </Card>
        <Card className="p-5 text-center">
          <TrendingUp className="h-8 w-8 text-teal-600 mx-auto mb-2" />
          <p className="font-bold">Ongoing commissions</p>
          <p className="text-xs text-muted-foreground mt-1">Earn from their Eco-System activity</p>
        </Card>
      </div>

      {/* Refer dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" /> Refer a new Enabler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sipho Dlamini" className="mt-1.5" />
            </div>
            <div>
              <Label>Email address</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sipho@example.co.za" className="mt-1.5" />
            </div>
            <div>
              <Label>WhatsApp mobile number</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+27 84 123 4567" className="mt-1.5" />
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <MessageCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>A WhatsApp invitation will be sent to this number via WABlast, including your referral link and a welcome message.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
              {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1.5" />Send invitation</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
