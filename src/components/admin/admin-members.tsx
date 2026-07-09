"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Search, ShieldCheck, ShieldAlert, Loader2, Check, X,
  Building2, User, UserCheck, Mail, Phone, MapPin, Coins,
  CreditCard, Calendar, Filter, ChevronRight,
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
  id: string; profileNumber: string; membershipType: string;
  firstName: string | null; lastName: string | null; companyName: string | null;
  email: string; country: string; mobile: string;
  kycStatus: string; kycVerifiedAt: string | null;
  subscriptionStatus: string; subscriptionAmount: number; subscriptionCurrency: string;
  monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string | null;
  createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
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
            <Input placeholder="Search by name, email, profile number, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                  const name = m.companyName || `${m.firstName || ""} ${m.lastName || ""}`.trim();
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
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" onClick={() => handleKyc(m, "APPROVE")}><Check className="h-3 w-3 mr-0.5" />Approve</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" onClick={() => handleKyc(m, "REJECT")}><X className="h-3 w-3" /></Button>
                          </div>
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
                      {(selected.companyName || `${selected.firstName} ${selected.lastName}`)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selected.companyName || `${selected.firstName} ${selected.lastName}`}</p>
                    <p className="text-xs text-muted-foreground font-mono font-normal">{selected.profileNumber}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status row */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-muted/50">{selected.membershipType.replace(/_/g, " ")}</Badge>
                  {selected.kycStatus === "VERIFIED" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="h-3 w-3 mr-1" />KYC Verified</Badge>}
                  {selected.kycStatus === "PENDING" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><ShieldAlert className="h-3 w-3 mr-1" />KYC Pending</Badge>}
                  {selected.kycStatus === "REJECTED" && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">KYC Rejected</Badge>}
                  <Badge variant="outline" className={selected.subscriptionStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>Subscription: {selected.subscriptionStatus}</Badge>
                  {selected.taxThreshold && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Tax eligible ({">"}R7k/mo)</Badge>}
                </div>

                {/* KYC action buttons */}
                {selected.kycStatus === "PENDING" && (
                  <div className="flex gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">KYC verification required</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Review the member's documents and approve or reject their KYC.</p>
                    </div>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleKyc(selected, "APPROVE")}><Check className="h-4 w-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100" onClick={() => handleKyc(selected, "REJECT")}><X className="h-4 w-4 mr-1" />Reject</Button>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Detail icon={Mail} label="Email" value={selected.email} />
                  <Detail icon={Phone} label="Mobile" value={selected.mobile} />
                  <Detail icon={MapPin} label="Country" value={selected.country} />
                  <Detail icon={CreditCard} label="NFC Tag" value={selected.nfcTagId || "—"} mono />
                  <Detail icon={Coins} label="Shares owned" value={`${selected.shareCount} shares`} />
                  <Detail icon={Calendar} label="Member since" value={new Date(selected.createdAt).toLocaleDateString("en-ZA")} />
                  <Detail icon={Coins} label="Monthly earnings" value={fmt(selected.monthlyEarnings)} />
                  <Detail icon={CreditCard} label="Subscription" value={`${selected.subscriptionCurrency} ${selected.subscriptionAmount}/mo`} />
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
    </div>
  );
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
