"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Landmark, Loader2, Sparkles, Award, Users, Banknote, Copy,
  Check, ShieldCheck, TrendingUp, FileText, Info, Crown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useKasiStore } from "@/lib/store";
import { toast } from "sonner";

interface RootsData {
  bankDetails: {
    bankName: string;
    bank: string;
    accountType: string;
    accountNumber: string;
    branchCode: string;
    reference: string;
  };
  pioneerCount: number;
  pioneerTarget: number;
  pioneerProgress: number;
  categories: {
    key: string;
    label: string;
    sharePrice: number;
    membershipFee: number;
    total: number;
    description: string;
    documents: string[];
  }[];
  myShare: {
    id: string;
    category: string;
    sharePrice: number;
    membershipFee: number;
    totalAmount: number;
    paymentRef: string | null;
    pioneerPool: boolean;
    status: string;
    createdAt: string;
  } | null;
}

export function RootsBankView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<RootsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState("ADULT");
  const [buying, setBuying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    if (!currentMember) return;
    try {
      const res = await fetch(`/api/rootsbank?memberId=${currentMember.id}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentMember]);

  async function handleBuy() {
    if (!currentMember) return;
    setBuying(true);
    try {
      const res = await fetch("/api/rootsbank/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id, category: selectedCat }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Purchase failed");
      } else {
        toast.success(`Pioneer share secured! ${result.pioneerRemaining} spots remaining.`);
        setBuyOpen(false);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBuying(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
    toast.success(`${label} copied`);
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const remaining = data.pioneerTarget - data.pioneerCount;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="h-5 w-5 text-amber-600" />
          <h2 className="text-2xl font-black tracking-tight">Roots CO-OP Bank</h2>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Sparkles className="h-3 w-3 mr-1" /> Pioneer Pool
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          200 pioneers purchase 1 share @ R500 to constitute the Roots CO-OP Bank. Pioneers share in 1% of all Kasi profits for life.
        </p>
      </div>

      {/* Pioneer status banner */}
      {data.myShare ? (
        <Card className="p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <Badge className="bg-white/20 text-white hover:bg-white/20 mb-1">
                  <Award className="h-3 w-3 mr-1" /> Pioneer #{data.pioneerCount}
                </Badge>
                <p className="font-black text-lg">You&apos;re a Roots Bank Pioneer!</p>
                <p className="text-sm text-amber-50">You share in 1% of all Kasi Mall & Marketplace profits — for life.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-amber-100 uppercase tracking-wider">Payment ref</p>
              <p className="font-mono font-bold">{data.myShare.paymentRef}</p>
              <p className="text-[10px] text-amber-100 mt-1">Category: {data.myShare.category.replace(/_/g, " ")}</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <p className="font-bold">Claim your pioneer spot</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Only <span className="font-bold text-amber-600">{remaining} of {data.pioneerTarget}</span> spots remaining.
                Secure your share of 1% of all Kasi profits — for life.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pioneers registered</span>
                  <span className="font-bold">{data.pioneerCount} / {data.pioneerTarget}</span>
                </div>
                <Progress value={data.pioneerProgress} className="h-2.5" />
              </div>
            </div>
            <Button size="lg" onClick={() => setBuyOpen(true)} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
              <Crown className="h-4 w-4 mr-1.5" /> Become a pioneer
            </Button>
          </div>
        </Card>
      )}

      {/* Cost breakdown */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-amber-600" /> Cost breakdown
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.categories.map((c) => (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                data.myShare?.category === c.key ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{c.label}</p>
                {data.myShare?.category === c.key && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">
                    <Check className="h-2.5 w-2.5 mr-0.5" /> Yours
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-black text-amber-600 mb-1">{fmt(c.total)}</p>
              <p className="text-xs text-muted-foreground mb-3">R{c.sharePrice} share + R{c.membershipFee} bank fee</p>
              <Separator className="my-2" />
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{c.description}</p>
              <div className="text-[10px]">
                <p className="text-muted-foreground font-semibold mb-1">Required docs:</p>
                <ul className="space-y-0.5">
                  {c.documents.map((d) => (
                    <li key={d} className="flex items-start gap-1 text-muted-foreground">
                      <FileText className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Bank details */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-emerald-600" /> Banking details
          </h3>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShieldCheck className="h-3 w-3 mr-1" /> Verified
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Account holder" value={data.bankDetails.bankName} onCopy={() => copy(data.bankDetails.bankName, "Account holder")} copied={copied === "Account holder"} />
          <DetailRow label="Bank" value={data.bankDetails.bank} onCopy={() => copy(data.bankDetails.bank, "Bank")} copied={copied === "Bank"} />
          <DetailRow label="Account type" value={data.bankDetails.accountType} onCopy={() => copy(data.bankDetails.accountType, "Account type")} copied={copied === "Account type"} />
          <DetailRow label="Branch code" value={data.bankDetails.branchCode} onCopy={() => copy(data.bankDetails.branchCode, "Branch code")} copied={copied === "Branch code"} />
          <DetailRow label="Account number" value={data.bankDetails.accountNumber} mono onCopy={() => copy(data.bankDetails.accountNumber, "Account number")} copied={copied === "Account number"} />
          <DetailRow label="Reference" value={data.bankDetails.reference} mono onCopy={() => copy(data.bankDetails.reference, "Reference")} copied={copied === "Reference"} />
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Note</p>
          <p>External payment is a temporary solution until Roots CO-OP Bank is fully registered and operational as the primary banking service provider. Roots Bank is a separate entity from Kasi.</p>
        </div>
      </Card>

      {/* Pioneer benefits */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
            <Award className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-2">Pioneer Pool benefits</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><TrendingUp className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Share in <strong>1% of all Kasi Mall and Kasi Marketplace profits</strong> — over and above ordinary dividends.</li>
              <li className="flex items-start gap-2"><Users className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Closed group of only 200 pioneers — your share grows as the ecosystem grows.</li>
              <li className="flex items-start gap-2"><Crown className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Founding member status of the Roots CO-OP Bank.</li>
              <li className="flex items-start gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> Paid into your Roots Bank account nightly at 12:00 SAST.</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Buy dialog */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" /> Become a Roots Bank Pioneer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Select your category</Label>
              <RadioGroup value={selectedCat} onValueChange={setSelectedCat} className="mt-2 space-y-2">
                {data.categories.map((c) => (
                  <Label
                    key={c.key}
                    htmlFor={c.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedCat === c.key ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"
                    }`}
                  >
                    <RadioGroupItem value={c.key} id={c.key} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{c.label}</p>
                        <p className="font-black text-amber-600">{fmt(c.total)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">R{c.sharePrice} share + R{c.membershipFee} fee</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {(() => {
              const c = data.categories.find((x) => x.key === selectedCat);
              if (!c) return null;
              return (
                <Card className="p-4 bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Share price</span><span className="font-semibold">{fmt(c.sharePrice)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank membership fee</span><span className="font-semibold">{fmt(c.membershipFee)}</span></div>
                  <Separator />
                  <div className="flex justify-between"><span className="font-semibold">Total payable</span><span className="font-bold text-amber-600">{fmt(c.total)}</span></div>
                </Card>
              );
            })()}
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>By completing this purchase, you&apos;ll be registered as a Roots Bank pioneer and added to the closed PioneerPool group. You&apos;ll receive a payment reference and confirmation via email.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={buying} className="bg-gradient-to-r from-amber-500 to-amber-600">
              {buying ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing...</> : <>Confirm pioneer purchase</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono, onCopy, copied }: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
