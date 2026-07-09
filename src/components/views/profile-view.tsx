"use client";

import { useEffect, useState } from "react";
import {
  User, ShieldCheck, CreditCard, Phone, Mail, MapPin, Calendar,
  FileText, Wallet, QrCode, Building2, Loader2, Download, ChevronRight,
  Banknote, Hash,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKasiStore } from "@/lib/store";
import type { Transaction, Subscription } from "@/lib/types";
import { toast } from "sonner";

export function ProfileView() {
  const { currentMember } = useKasiStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) return;
    async function load() {
      try {
        const res = await fetch(`/api/transactions?memberId=${currentMember!.id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data.transactions);
          setSubscriptions(data.subscriptions);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentMember]);

  if (!currentMember) return null;
  const m = currentMember;
  const isCompany = m.membershipType === "COMPANY";
  const displayName = isCompany ? m.companyName : `${m.firstName} ${m.lastName}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header card */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-amber-500 text-white text-2xl font-black">
              {isCompany ? (m.companyName?.[0] || "C") : `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-black tracking-tight">{displayName}</h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <ShieldCheck className="h-3 w-3 mr-1" /> {m.kycStatus}
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {m.subscriptionStatus}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{m.email} · {m.mobile}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="font-mono">
                <Hash className="h-3 w-3 mr-1" /> {m.profileNumber}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                <QrCode className="h-3 w-3 mr-1" /> {m.nfcTagId}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" /> {isCompany ? "Company information" : "Personal information"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {isCompany ? (
                <>
                  <InfoRow label="Company name" value={m.companyName} />
                  <InfoRow label="Registration number" value={m.companyRegNo} />
                </>
              ) : (
                <>
                  <InfoRow label="First name" value={m.firstName} />
                  <InfoRow label="Last name" value={m.lastName} />
                  <InfoRow label="ID / Passport" value={m.idPassport} mono />
                  <InfoRow label="SARS number" value={m.sarsNumber} mono />
                  {m.guardianName && <InfoRow label="Guardian" value={m.guardianName} />}
                </>
              )}
              <InfoRow label="Membership type" value={m.membershipType.replace(/_/g, " ")} />
              <InfoRow label="Country" value={m.country} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" /> Address
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Address" value={m.addressLine} />
              <InfoRow label="City" value={m.city} />
              <InfoRow label="Postal code" value={m.postalCode} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Beneficiary
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Beneficiary name" value={m.beneficiaryName} />
              <InfoRow label="Beneficiary ID" value={m.beneficiaryId} mono />
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Inheritance note</p>
              <p>Only one profile per ID/Passport is allowed. The only exception is profile inheritance, which requires Exco approval.</p>
            </div>
          </Card>
        </TabsContent>

        {/* Banking tab */}
        <TabsContent value="banking" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" /> Roots Bank account
            </h3>
            <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
              <div className="relative">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs text-emerald-100">Roots CO-OP Bank</p>
                    <p className="text-sm font-semibold">{displayName}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-emerald-200" />
                </div>
                <p className="text-xs text-emerald-100 mb-1">Account number</p>
                <p className="text-lg font-mono font-bold tracking-wider mb-4">{m.rootsBankAccount}</p>
                <div className="flex justify-between text-xs">
                  <div>
                    <p className="text-emerald-100">NFC Tag</p>
                    <p className="font-mono font-semibold">{m.nfcTagId}</p>
                  </div>
                  <div>
                    <p className="text-emerald-100">VISA Card</p>
                    <p className="font-mono font-semibold">**** {m.visaCardLast4}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" /> Subscription
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoRow label="Amount" value={`${m.subscriptionCurrency} ${m.subscriptionAmount}/mo`} />
              <InfoRow label="Payment method" value={m.paymentMethod} />
              <InfoRow label="Status" value={m.subscriptionStatus} />
            </div>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Monthly earnings" value={`R ${m.monthlyEarnings.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`} />
              <InfoRow label="Tax threshold" value={m.taxThreshold ? "Active (25% applies over R7,000/mo)" : "Below threshold"} />
            </div>
          </Card>

          <Card className="p-5 bg-muted/30 border-dashed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-sm">
                <p className="font-semibold mb-1">NFC Tag & VISA Card</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each member receives an NFC Tag for exclusive use at KasiMall stores, and a VISA card
                  usable at any VISA paypoint. Both are linked to your Roots Bank account for instant
                  commission, KasiPool and dividend payouts.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Transactions tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" /> Transaction history
              </h3>
              <Button variant="outline" size="sm" onClick={() => toast.info("Statement download coming soon")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Statement
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto scrollbar-kasi -mx-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50">
                    <div className={`w-2 h-2 rounded-full ${tx.amount > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })} · {tx.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <p className={`text-sm font-bold font-mono ${tx.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.amount > 0 ? "+" : ""}R {Math.abs(tx.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Subscriptions tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" /> Subscription history
            </h3>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No subscriptions yet.</p>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                    <div>
                      <p className="font-semibold text-sm">{s.period}</p>
                      <p className="text-xs text-muted-foreground">{s.method} · {new Date(s.createdAt).toLocaleDateString("en-ZA")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{s.status}</Badge>
                      <p className="font-bold font-mono">{s.currency} {s.amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
