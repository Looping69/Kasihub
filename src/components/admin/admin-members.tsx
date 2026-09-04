"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Search, ShieldCheck, ShieldAlert, Loader2, Check, X,
  Building2, User, UserCheck, Mail, Phone, MapPin, Coins,
  CreditCard, Calendar, Filter, ChevronRight, Eye, FileCheck2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AdminMember {
  id: string; profileNumber: string; membershipType: string; citizenshipType: string | null;
  firstName: string | null; lastName: string | null; companyName: string | null;
  email: string; country: string; mobile: string;
  kycStatus: string; kycVerifiedAt: string | null;
  subscriptionStatus: string; subscriptionAmount: number; subscriptionCurrency: string;
  monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string | null;
  instapayStatus: string; instapayVerifiedAt: string | null; instapayAccountRef: string | null;
  uplineProfileNumber: string | null; uplineConfirmed: boolean;
  createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
  presaleApplicationStatus: string | null; presalePhaseCompleted: number | null;
  presaleCompletionPercent: number | null; presaleApplicationNumber: string | null;
  presaleReservationStatus: string | null; presaleOrderReference: string | null;
  presaleReservationQuantity: number | null; presaleIncorporationStatus: string | null;
  presalePaymentRail: string | null; presalePaymentAmountZar: number | null;
  presaleWebPayReference: string | null; presaleWebPayTransactionId: string | null;
  presaleWebPaySystemReference: string | null; presaleWebPayPaymentMethod: string | null;
  presalePaymentSettledAt: string | null;
  presalePaymentReconciliations: {
    orderReference: string; status: string; quantity: number; amountZar: number | null;
    webPayReference: string | null; transactionId: string | null; systemReference: string | null;
    paymentMethod: string | null; settledAt: string | null;
  }[];
}

interface KycDocument {
  id: string; documentType: string; filename: string; contentType: string;
  sizeBytes: number; status: string; uploadedAt: string; rejectionReason: string | null;
}

function paymentMethodLabel(member: AdminMember): string {
  // Presale reservations are processed through the InstaPay/WebPay rail.
  // Do not present the legacy international membership provider for these records.
  if (member.citizenshipType === "PRESALE_INVESTOR" || member.presaleApplicationStatus || member.presaleReservationStatus) {
    return "InstaPay";
  }
  if (member.instapayStatus === "VERIFIED") return "KaSiPay Gini";
  if (member.instapayStatus === "PENDING") return "KaSiPay (pending)";
  return "Bankus";
}

export function AdminMembers() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const [kycDocuments, setKycDocuments] = useState<KycDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [resolvingPresaleOrder, setResolvingPresaleOrder] = useState(false);
  const [presaleResolutionReason, setPresaleResolutionReason] = useState("");
  const [preview, setPreview] = useState<{ url: string; type: string; title: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (kycFilter !== "ALL") params.set("kyc", kycFilter);
      if (subFilter !== "ALL") params.set("subscription", subFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/admin/members?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, kycFilter, subFilter, typeFilter]);

  useEffect(() => {
    if (!selected) { setKycDocuments([]); return; }
    let cancelled = false;
    setDocumentsLoading(true);
    void fetch(`/api/admin/kyc/documents?memberId=${encodeURIComponent(selected.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Unable to load KYC evidence");
        if (!cancelled) setKycDocuments(payload.documents ?? []);
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Unable to load KYC evidence"); })
      .finally(() => { if (!cancelled) setDocumentsLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function viewDocument(document: KycDocument) {
    try {
      const res = await fetch(`/api/admin/kyc/documents/${encodeURIComponent(document.id)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to open KYC evidence");
      const url = URL.createObjectURL(await res.blob());
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url, type: document.contentType, title: document.documentType === "identity_selfie" ? "Identity selfie" : "ID document or passport" };
      });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to open KYC evidence");
    }
  }

  async function reviewDocument(document: KycDocument, action: "APPROVE" | "REJECT") {
    const reason = action === "REJECT" ? window.prompt("Reason for rejecting this document")?.trim() : undefined;
    if (action === "REJECT" && !reason) return;
    const res = await fetch("/api/admin/kyc/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: document.id, action, reason }),
    });
    const payload = await res.json();
    if (!res.ok) { toast.error(payload.error ?? "Unable to review KYC evidence"); return; }
    setKycDocuments((current) => current.map((item) => item.id === document.id ? { ...item, status: payload.status, rejectionReason: reason ?? null } : item));
    toast.success(action === "APPROVE" ? "Document approved" : "Document rejected");
  }

  async function handleKyc(member: AdminMember, action: "APPROVE" | "REJECT") {
    try {
      const res = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, action }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Action failed");
      } else {
        toast.success(`${member.firstName || member.companyName}'s KYC ${action === "APPROVE" ? "approved" : "rejected"}`);
        setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, kycStatus: result.kycStatus, kycVerifiedAt: result.member.kycVerifiedAt } : m));
        if (selected?.id === member.id) setSelected({ ...selected, kycStatus: result.kycStatus, kycVerifiedAt: result.member.kycVerifiedAt });
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function resolvePresaleManualReview(member: AdminMember, action: "approve_settlement" | "reject_and_cancel") {
    const orderReference = member.presaleOrderReference;
    if (!orderReference || member.presaleReservationStatus !== "manual_review") return;
    const reason = presaleResolutionReason.trim();
    if (!reason) return;

    setResolvingPresaleOrder(true);
    try {
      const res = await fetch(`/api/admin/presale/orders/${encodeURIComponent(orderReference)}/resolve-manual-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Unable to resolve presale manual review");
      const status = payload.status ?? (action === "approve_settlement" ? "confirmed" : "cancelled");
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, presaleReservationStatus: status } : item));
      setSelected((current) => current?.id === member.id ? { ...current, presaleReservationStatus: status } : current);
      setPresaleResolutionReason("");
      toast.success(action === "approve_settlement" ? "Settlement approved; share issuance started" : "Presale order cancelled");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to resolve presale manual review");
    } finally {
      setResolvingPresaleOrder(false);
    }
  }

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pendingKyc = members.filter((m) => m.kycStatus === "PENDING").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Members & KYC</h2>
          <p className="text-sm text-muted-foreground">{total} total members · {pendingKyc} pending KYC</p>
        </div>
      </div>

      {/* KYC queue banner */}
      {pendingKyc > 0 && (
        <Card className="p-5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-amber-800 dark:text-amber-300">KYC approval queue</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">{pendingKyc} member{pendingKyc > 1 ? "s" : ""} awaiting verification</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setKycFilter("PENDING")} className="border-amber-300 text-amber-700 hover:bg-amber-100">
              Filter pending <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, profile, KSH InstaPay or KSP order reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Select value={kycFilter} onValueChange={setKycFilter}>
              <SelectTrigger className="w-36"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All KYC</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All subs</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LAPSED">Lapsed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="INDIVIDUAL_ADULT">Adult</SelectItem>
                <SelectItem value="INDIVIDUAL_KIDS">Kids</SelectItem>
                <SelectItem value="COMPANY">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Members table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">No members found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-kasi">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">KYC</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Subscription</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Earnings</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const name = memberName(m);
                  const Icon = m.membershipType === "COMPANY" ? Building2 : m.membershipType === "INDIVIDUAL_KIDS" ? UserCheck : User;
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelected(m)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`text-xs font-bold ${m.membershipType === "COMPANY" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"}`}>
                              {name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{m.profileNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]"><Icon className="h-2.5 w-2.5 mr-1" />{m.membershipType.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {m.kycStatus === "VERIFIED" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"><ShieldCheck className="h-2.5 w-2.5 mr-0.5" />Verified</Badge>}
                        {m.kycStatus === "PENDING" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>}
                        {m.kycStatus === "REJECTED" && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]"><X className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {m.subscriptionStatus === "ACTIVE" ? (
                          <span className="text-xs font-semibold text-emerald-600">{m.subscriptionCurrency} {m.subscriptionAmount}/mo</span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-200">{m.subscriptionStatus}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className={`text-xs font-mono font-semibold ${m.taxThreshold ? "text-rose-600" : ""}`}>{fmt(m.monthlyEarnings)}</span>
                        {m.taxThreshold && <p className="text-[9px] text-rose-500">tax eligible</p>}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString("en-ZA")}</td>
                      <td className="px-4 py-3 text-right">
                        {m.kycStatus === "PENDING" ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100" onClick={(e) => { e.stopPropagation(); setSelected(m); }}><Eye className="h-3 w-3 mr-1" />Review evidence</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); setSelected(m); }}>View <ChevronRight className="h-3 w-3" /></Button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Member detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-kasi">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`text-sm font-bold ${selected.membershipType === "COMPANY" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"}`}>
                      {memberName(selected)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{memberName(selected)}</p>
                    <p className="text-xs text-muted-foreground font-mono font-normal">{selected.profileNumber}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status row */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-muted/50">{selected.membershipType.replace(/_/g, " ")}</Badge>
                  {selected.citizenshipType && <Badge variant="outline" className="bg-muted/50">{selected.citizenshipType.replace(/_/g, " ")}</Badge>}
                  {selected.kycStatus === "VERIFIED" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="h-3 w-3 mr-1" />KYC Verified</Badge>}
                  {selected.kycStatus === "PENDING" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><ShieldAlert className="h-3 w-3 mr-1" />KYC Pending</Badge>}
                  {selected.kycStatus === "REJECTED" && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">KYC Rejected</Badge>}
                  {selected.instapayStatus === "VERIFIED" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="h-3 w-3 mr-1" />KaSiPay Verified</Badge>}
                  {selected.instapayStatus === "PENDING" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">KaSiPay Pending</Badge>}
                  <Badge variant="outline" className={selected.subscriptionStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>Subscription: {selected.subscriptionStatus}</Badge>
                  {selected.taxThreshold && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Tax eligible ({">"}R7k/mo)</Badge>}
                </div>

                {(selected.presaleApplicationStatus || selected.presaleReservationStatus) && (
                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">KaSiShares application &amp; reservation</p>
                        <p className="text-xs text-sky-700 dark:text-sky-400">Presale state from the authoritative application and order records.</p>
                      </div>
                      {selected.presalePhaseCompleted !== null && (
                        <Badge variant="outline" className="border-sky-300 bg-white text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          Stage {Math.min(selected.presalePhaseCompleted + 1, 5)} of 5
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Detail icon={FileCheck2} label="Application" value={formatStatus(selected.presaleApplicationStatus)} />
                      <Detail icon={FileCheck2} label="Application number" value={selected.presaleApplicationNumber || "—"} mono />
                      <Detail icon={CreditCard} label="Reservation" value={formatStatus(selected.presaleReservationStatus)} />
                      <Detail icon={Coins} label="Reserved allocation" value={selected.presaleReservationQuantity === null ? "—" : `${selected.presaleReservationQuantity} shares`} />
                      <Detail icon={CreditCard} label="Order reference" value={selected.presaleOrderReference || "—"} mono />
                      <Detail icon={ShieldCheck} label="Incorporation" value={formatStatus(selected.presaleIncorporationStatus)} />
                    </div>
                    {selected.presaleReservationStatus === "manual_review" && selected.presaleOrderReference && (
                      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                        <div>
                          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Payment requires a controlled resolution</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">Verify the provider or chain evidence before approving settlement. Every decision records the administrator and reason.</p>
                        </div>
                        <Input aria-label="Presale resolution audit reason" placeholder="Required audit reason" value={presaleResolutionReason} onChange={(event) => setPresaleResolutionReason(event.target.value)} />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-rose-300 text-rose-700" disabled={resolvingPresaleOrder || !presaleResolutionReason.trim()} onClick={() => resolvePresaleManualReview(selected, "reject_and_cancel")}>
                            <X className="mr-1 h-3.5 w-3.5" />Reject and cancel
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={resolvingPresaleOrder || !presaleResolutionReason.trim()} onClick={() => resolvePresaleManualReview(selected, "approve_settlement")}>
                            {resolvingPresaleOrder ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Approve settlement
                          </Button>
                        </div>
                      </div>
                    )}
                    {selected.presalePaymentReconciliations.map((payment) => (
                      <div key={payment.orderReference} className="space-y-3 rounded-lg border border-sky-300 bg-white p-3 dark:border-sky-800 dark:bg-sky-950/70">
                        <div>
                          <p className="text-xs font-semibold text-sky-950 dark:text-sky-100">InstaPay payment reconciliation</p>
                          <p className="text-[11px] text-sky-700 dark:text-sky-300">
                            Match the exact KSH reference below to the “My reference” column in InstaPay.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Detail icon={CreditCard} label="InstaPay My reference" value={payment.webPayReference || "Not assigned yet"} mono />
                          <Detail icon={CreditCard} label="KaSiHub order" value={payment.orderReference} mono />
                          <Detail icon={Coins} label="Shares and amount" value={`${payment.quantity} shares · ${payment.amountZar === null ? "—" : fmt(payment.amountZar)}`} />
                          <Detail icon={CreditCard} label="Payment status" value={formatStatus(payment.status)} />
                          <Detail icon={ShieldCheck} label="Provider system reference" value={payment.systemReference || "Pending settlement"} mono />
                          <Detail icon={Calendar} label="Settled at" value={payment.settledAt ? new Date(payment.settledAt).toLocaleString("en-ZA") : "Not settled"} />
                        </div>
                      </div>
                    ))}
                    {selected.presaleCompletionPercent !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] text-sky-700 dark:text-sky-400"><span>Application progress</span><span>{selected.presaleCompletionPercent}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900"><div className="h-full bg-sky-500" style={{ width: `${selected.presaleCompletionPercent}%` }} /></div>
                      </div>
                    )}
                  </div>
                )}

                {/* KYC action buttons */}
                {selected.kycStatus === "PENDING" && (
                  <div className="space-y-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">KYC evidence review</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Open and approve both pieces of identity evidence before verifying this member.</p>
                    </div>
                    {documentsLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading private evidence…</div> : kycDocuments.length === 0 ? <p className="text-xs font-medium text-rose-700">No identity evidence has been uploaded.</p> : (
                      <div className="space-y-2">{kycDocuments.map((document) => <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3">
                        <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{document.documentType === "identity_selfie" ? "Identity selfie" : "ID document or passport"}</p><p className="truncate text-[10px] text-muted-foreground">{document.filename} · {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB</p></div>
                        <Badge variant="outline" className={document.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : document.status === "rejected" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{document.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => viewDocument(document)}><Eye className="mr-1 h-3.5 w-3.5" />View</Button>
                        {document.status !== "approved" && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => reviewDocument(document, "APPROVE")}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>}
                        {document.status !== "rejected" && <Button size="sm" variant="outline" className="border-rose-300 text-rose-700" onClick={() => reviewDocument(document, "REJECT")}><X className="h-3.5 w-3.5" /></Button>}
                      </div>)}</div>
                    )}
                    <div className="flex justify-end gap-2 border-t border-amber-200 pt-3 dark:border-amber-900">
                      <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100" onClick={() => handleKyc(selected, "REJECT")}><X className="h-4 w-4 mr-1" />Reject member</Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!hasApprovedIdentityEvidence(kycDocuments)} onClick={() => handleKyc(selected, "APPROVE")}><Check className="h-4 w-4 mr-1" />Verify member</Button>
                    </div>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Detail icon={Mail} label="Email" value={selected.email} />
                  <Detail icon={Phone} label="Mobile" value={selected.mobile} />
                  <Detail icon={MapPin} label="Country" value={selected.country} />
                  <Detail icon={User} label="Citizenship type" value={selected.citizenshipType ? selected.citizenshipType.replace(/_/g, " ") : "—"} />
                  <Detail icon={Coins} label="Shares owned" value={`${selected.shareCount} shares`} />
                  <Detail icon={Calendar} label="Member since" value={new Date(selected.createdAt).toLocaleDateString("en-ZA")} />
                  <Detail icon={Coins} label="Monthly earnings" value={fmt(selected.monthlyEarnings)} />
                  <Detail icon={CreditCard} label="Subscription" value={`${selected.subscriptionCurrency} ${selected.subscriptionAmount}/mo`} />
                  <Detail icon={CreditCard} label="Payment method" value={paymentMethodLabel(selected)} />
                  <Detail icon={ShieldCheck} label="KaSiPay status" value={selected.instapayStatus === "VERIFIED" ? `Verified (${selected.instapayAccountRef || "—"})` : selected.instapayStatus === "PENDING" ? "Pending" : "Not connected"} />
                  <Detail icon={User} label="Upline" value={selected.uplineProfileNumber ? `${selected.uplineProfileNumber} ${selected.uplineConfirmed ? "✓" : "(unconfirmed)"}` : "Bulk registration"} />
                  <Detail icon={CreditCard} label="NFC Tag" value={selected.nfcTagId || "—"} mono />
                </div>

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Transactions" value={selected.transactionCount} />
                  <StatBox label="Orders" value={selected.orderCount} />
                  <StatBox label="Shares" value={selected.shareCount} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          {preview?.type === "application/pdf" ? <iframe title={preview.title} src={preview.url} className="h-[70vh] w-full rounded-lg border" /> : preview ? <img src={preview.url} alt={preview.title} className="max-h-[70vh] w-full rounded-lg bg-black/5 object-contain" /> : null}
          <p className="text-xs text-muted-foreground">Private evidence is loaded for this review session only and is not cached by the browser route.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function hasApprovedIdentityEvidence(documents: KycDocument[]) {
  return ["identity_document", "identity_selfie"].every((type) => documents.some((document) => document.documentType === type && document.status === "approved"));
}

function memberName(member: AdminMember) {
  return member.companyName || [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || member.profileNumber;
}

function formatStatus(status: string | null) {
  return status ? status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
}

function Detail({ icon: Icon, label, value, mono }: { icon: typeof Mail; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${mono ? "font-mono" : ""} truncate`}>{value}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/40">
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
