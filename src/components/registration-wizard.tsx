"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, X, Building2, User, UserCheck,
  CreditCard, ShieldCheck, Sparkles, PartyPopper, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useKasiStore } from "@/lib/store";
import type { MembershipType } from "@/lib/types";

type Step = "type" | "details" | "subscription" | "kyc" | "profile" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "type", label: "Membership" },
  { key: "details", label: "Details" },
  { key: "subscription", label: "Subscription" },
  { key: "kyc", label: "KYC" },
  { key: "profile", label: "Profile" },
];

interface FormData {
  membershipType: MembershipType;
  // Individual
  firstName: string;
  lastName: string;
  idPassport: string;
  sarsNumber: string;
  guardianName: string;
  // Company
  companyName: string;
  companyRegNo: string;
  // Common
  email: string;
  country: string;
  mobile: string;
  addressLine: string;
  city: string;
  postalCode: string;
  beneficiaryName: string;
  beneficiaryId: string;
  paymentMethod: string;
  profilePicture: string;
  kycStatus: "PENDING" | "VERIFIED";
  sponsorProfileNumber: string;
}

const INITIAL: FormData = {
  membershipType: "INDIVIDUAL_ADULT",
  firstName: "",
  lastName: "",
  idPassport: "",
  sarsNumber: "",
  guardianName: "",
  companyName: "",
  companyRegNo: "",
  email: "",
  country: "South Africa",
  mobile: "",
  addressLine: "",
  city: "",
  postalCode: "",
  beneficiaryName: "",
  beneficiaryId: "",
  paymentMethod: "BANK",
  profilePicture: "",
  kycStatus: "PENDING",
  sponsorProfileNumber: "",
};

export function RegistrationWizard() {
  const { closeRegistration, login } = useKasiStore();
  const [step, setStep] = useState<Step>("type");
  const [data, setData] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [newProfileNumber, setNewProfileNumber] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function next() {
    const order: Step[] = ["type", "details", "subscription", "kyc", "profile", "done"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  }
  function prev() {
    const order: Step[] = ["type", "details", "subscription", "kyc", "profile"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  }

  const [newMember, setNewMember] = useState<{ id: string; profileNumber: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string; membershipType: string } | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Registration failed");
        setSubmitting(false);
        return;
      }
      setNewProfileNumber(result.profileNumber);
      setNewMember(result.member);
      setStep("done");
      toast.success("Welcome to KaSiHUB!");
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  function finish() {
    if (newMember) {
      // Log in as the newly registered member (re-fetch full record for all fields)
      fetch(`/api/members?memberId=${newMember.id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.member) {
            login(d.member.id, d.member);
          }
        })
        .catch(() => {})
        .finally(() => {
          closeRegistration();
        });
    } else {
      closeRegistration();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && closeRegistration()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 scrollbar-kasi">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500" />
                <div className="absolute inset-0.5 rounded-[10px] bg-background flex items-center justify-center">
                  <span className="text-lg font-black bg-gradient-to-br from-emerald-600 to-amber-500 bg-clip-text text-transparent">K</span>
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl">Join KaSiHUB</DialogTitle>
                <p className="text-xs text-muted-foreground">Become a member of the hybrid ecosystem</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={closeRegistration} disabled={submitting}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stepper */}
          {step !== "done" && (
            <div className="mt-6 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.key} className="flex-1 flex items-center gap-2">
                    <div className={`flex items-center gap-2 ${active ? "text-emerald-600" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        active ? "border-emerald-600 bg-emerald-600 text-white" :
                        done ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-600" :
                        "border-border bg-background"
                      }`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${active ? "" : "text-muted-foreground"}`}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-px ${done ? "bg-emerald-600" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === "type" && <TypeStep data={data} update={update} />}
              {step === "details" && <DetailsStep data={data} update={update} />}
              {step === "subscription" && <SubscriptionStep data={data} update={update} />}
              {step === "kyc" && <KycStep data={data} update={update} />}
              {step === "profile" && <ProfileStep data={data} update={update} />}
              {step === "done" && (
                <DoneStep profileNumber={newProfileNumber} membershipType={data.membershipType} onFinish={finish} />
              )}
            </motion.div>
          </AnimatePresence>

          {step !== "done" && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={prev} disabled={stepIndex === 0 || submitting}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              {step === "profile" ? (
                <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating profile...</> : <>Complete registration <Sparkles className="h-4 w-4 ml-2" /></>}
                </Button>
              ) : (
                <Button onClick={next} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ STEP COMPONENTS ============

function TypeStep({ data, update }: { data: FormData; update: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const types: { key: MembershipType; label: string; icon: typeof User; desc: string; price: string; features: string[] }[] = [
    {
      key: "INDIVIDUAL_ADULT",
      label: "Individual — Adult",
      icon: User,
      desc: "Ages 18-65. Full access to the ecosystem, matrix, shares and mall.",
      price: "R140 / month",
      features: ["5×6 matrix placement", "KasiPool nightly share", "NFC tag + VISA card", "Buy KasiShares"],
    },
    {
      key: "INDIVIDUAL_KIDS",
      label: "Individual — Kids",
      icon: UserCheck,
      desc: "Under 18, with adult supervision. A guardian must be appointed.",
      price: "R140 / month",
      features: ["Guardian required", "5×6 matrix placement", "KasiPool nightly share", "Restricted withdrawals"],
    },
    {
      key: "COMPANY",
      label: "Company",
      icon: Building2,
      desc: "For registered businesses. Higher subscription, broader entitlements.",
      price: "R300 / month",
      features: ["Company registration no.", "5×6 matrix placement", "Beneficiary details", "Bulk eligibility"],
    },
  ];
  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Choose your membership type</h3>
      <p className="text-sm text-muted-foreground mb-6">You can change details later, but membership type is fixed per profile.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {types.map((t) => {
          const active = data.membershipType === t.key;
          return (
            <button key={t.key} onClick={() => update("membershipType", t.key)} className={`text-left`}>
              <Card className={`h-full p-5 cursor-pointer transition-all hover:-translate-y-1 ${
                active ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:border-border"
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${active ? "bg-emerald-600 text-white" : "bg-muted"}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <p className="font-bold mb-1">{t.label}</p>
                <p className="text-xs text-muted-foreground mb-3">{t.desc}</p>
                <p className="text-sm font-bold text-emerald-600 mb-3">{t.price}</p>
                <ul className="space-y-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <Label htmlFor="sponsor">Sponsor / Upline profile number (optional)</Label>
        <Input
          id="sponsor"
          placeholder="e.g. KSH-000001"
          value={data.sponsorProfileNumber}
          onChange={(e) => update("sponsorProfileNumber", e.target.value)}
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5">Leave blank if you joined via bulk registration. You&apos;ll be placed in the next open spot regardless.</p>
      </div>
    </div>
  );
}

function DetailsStep({ data, update }: { data: FormData; update: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const isCompany = data.membershipType === "COMPANY";
  const isKids = data.membershipType === "INDIVIDUAL_KIDS";
  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{isCompany ? "Company details" : "Personal details"}</h3>
      <p className="text-sm text-muted-foreground mb-6">This information is used for KYC verification and your unique profile number.</p>

      {isCompany ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required value={data.companyName} onChange={(v) => update("companyName", v)} placeholder="Acme Trading (Pty) Ltd" />
          <Field label="Company registration no." required value={data.companyRegNo} onChange={(v) => update("companyRegNo", v)} placeholder="2018/123456/07" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required value={data.firstName} onChange={(v) => update("firstName", v)} placeholder="Thabo" />
          <Field label="Last name" required value={data.lastName} onChange={(v) => update("lastName", v)} placeholder="Mokoena" />
          <Field label="ID / Passport number" required value={data.idPassport} onChange={(v) => update("idPassport", v)} placeholder="8501015800087" />
          <Field label="Personal SARS number" value={data.sarsNumber} onChange={(v) => update("sarsNumber", v)} placeholder="9123456789" />
          {isKids && (
            <div className="sm:col-span-2">
              <Field label="Guardian name (required for kids)" required value={data.guardianName} onChange={(v) => update("guardianName", v)} placeholder="Nomsa Mokoena" />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mt-4">
        <Field label="Email address" required type="email" value={data.email} onChange={(v) => update("email", v)} placeholder="you@example.com" />
        <Field label="Mobile number" required value={data.mobile} onChange={(v) => update("mobile", v)} placeholder="+27 82 123 4567" />
        <div>
          <Label>Country</Label>
          <select
            value={data.country}
            onChange={(e) => update("country", e.target.value)}
            className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option>South Africa</option>
            <option>Lesotho</option>
            <option>Eswatini</option>
            <option>Botswana</option>
            <option>Zimbabwe</option>
            <option>Namibia</option>
            <option>Mozambique</option>
            <option>Other</option>
          </select>
        </div>
        <Field label="Postal code" value={data.postalCode} onChange={(v) => update("postalCode", v)} placeholder="1804" />
      </div>

      <div className="mt-4">
        <Label htmlFor="address">Residential / Business address</Label>
        <Textarea
          id="address"
          value={data.addressLine}
          onChange={(e) => update("addressLine", e.target.value)}
          placeholder="1234 Pela Street, Soweto"
          className="mt-1.5"
          rows={2}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Beneficiary name" value={data.beneficiaryName} onChange={(v) => update("beneficiaryName", v)} placeholder="Nomsa Mokoena" />
        <Field label="Beneficiary ID number" value={data.beneficiaryId} onChange={(v) => update("beneficiaryId", v)} placeholder="8902150120089" />
      </div>
    </div>
  );
}

function SubscriptionStep({ data, update }: { data: FormData; update: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const isCompany = data.membershipType === "COMPANY";
  const isInternational = data.country !== "South Africa";
  const localAmount = isCompany ? 300 : 140;
  const intlAmount = isCompany ? 50 : 20;
  const currency = isInternational ? "USD" : "ZAR";
  const amount = isInternational ? intlAmount : localAmount;

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Subscription & payment</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Your subscription is paid monthly. R47 of each payment goes up 6 levels in the matrix; the remainder supports the KasiPool.
      </p>

      <Card className="p-5 mb-6 bg-muted/30 border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your plan</p>
            <p className="text-2xl font-black mt-1">{currency} {amount}<span className="text-base font-normal text-muted-foreground">/month</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {isCompany ? "Company membership" : "Individual membership"} · {isInternational ? "International" : "Local (SADC)"}
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {isInternational ? `$${intlAmount}` : `R${localAmount}`}
          </Badge>
        </div>
      </Card>

      <Label>Choose payment method</Label>
      <div className="grid sm:grid-cols-3 gap-3 mt-2">
        {[
          { key: "BANK", label: "Bank Transfer (EFT)", desc: "FNB · Solidus Holdings" },
          { key: "CARD", label: "Card Payment", desc: "Visa / Mastercard" },
          { key: "CASH", label: "Cash Deposit", desc: "At any FNB branch" },
        ].map((m) => {
          const active = data.paymentMethod === m.key;
          return (
            <button key={m.key} onClick={() => update("paymentMethod", m.key)} className="text-left">
              <Card className={`p-4 cursor-pointer transition-all ${active ? "border-emerald-500 ring-2 ring-emerald-500/30" : "hover:border-border"}`}>
                <CreditCard className={`h-5 w-5 mb-2 ${active ? "text-emerald-600" : "text-muted-foreground"}`} />
                <p className="font-semibold text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="mt-6 p-5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">Banking details</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Solidus Holdings (Pty) Ltd · FNB Gold Business Account<br />
              Account: <span className="font-mono font-semibold">63212306319</span> · Branch: <span className="font-mono font-semibold">210835</span><br />
              <span className="text-xs">External payment is a temporary solution until Roots CO-OP Bank is operational.</span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KycStep({ data, update }: { data: FormData; update: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-1">KYC verification</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Complete external KYC verification. You&apos;ll receive a confirmation email once approved. Only one profile per ID/Passport is allowed.
      </p>

      <div className="space-y-4">
        <Card className="p-5 border-dashed">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Upload profile picture</p>
              <p className="text-xs text-muted-foreground">A real, clear photo of yourself. Required for KYC.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => update("profilePicture", "uploaded")}>
              {data.profilePicture ? <><Check className="h-4 w-4 mr-1" /> Uploaded</> : "Upload"}
            </Button>
          </div>
        </Card>

        <Card className="p-5 border-dashed">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">ID / Passport verification</p>
              <p className="text-xs text-muted-foreground">External KYC partner will verify your identity document.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => update("kycStatus", "VERIFIED")}>
              {data.kycStatus === "VERIFIED" ? <><Check className="h-4 w-4 mr-1" /> Verified</> : "Start verification"}
            </Button>
          </div>
        </Card>

        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Duplicate prevention</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your ID/Passport number is unique to your profile. The only exception is profile inheritance,
                which requires special handling by the KaSiHUB Exco.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileStep({ data, update }: { data: FormData; update: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const isCompany = data.membershipType === "COMPANY";
  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Review & confirm</h3>
      <p className="text-sm text-muted-foreground mb-6">Please review your details before we generate your unique profile number.</p>

      <Card className="p-5 bg-muted/30">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Membership type" value={isCompany ? "Company" : data.membershipType === "INDIVIDUAL_KIDS" ? "Individual - Kids" : "Individual - Adult"} />
          {isCompany ? (
            <>
              <Row label="Company" value={data.companyName || "—"} />
              <Row label="Reg. no." value={data.companyRegNo || "—"} />
            </>
          ) : (
            <>
              <Row label="Name" value={`${data.firstName} ${data.lastName}`} />
              <Row label="ID/Passport" value={data.idPassport || "—"} />
            </>
          )}
          <Row label="Email" value={data.email} />
          <Row label="Mobile" value={data.mobile} />
          <Row label="Country" value={data.country} />
          <Row label="Payment method" value={data.paymentMethod} />
          <Row label="KYC status" value={data.kycStatus} />
          <Row label="Beneficiary" value={data.beneficiaryName || "—"} />
        </dl>
      </Card>

      <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 text-xs text-amber-800 dark:text-amber-300">
        <p className="font-semibold mb-1">Once you complete registration:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>You&apos;ll receive a unique profile number (e.g. KSH-000123)</li>
          <li>An NFC Tag and VISA card will be issued by Roots Bank</li>
          <li>You&apos;ll be placed in the next open spot in the 5×6 matrix</li>
          <li>You&apos;ll get full access to the KaSiHUB UI</li>
        </ul>
      </div>
    </div>
  );
}

function DoneStep({ profileNumber, membershipType, onFinish }: { profileNumber: string | null; membershipType: MembershipType; onFinish: () => void }) {
  return (
    <div className="text-center py-6">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="relative inline-flex"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <PartyPopper className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      </motion.div>

      <h3 className="text-2xl font-black mt-6">Welcome to KaSiHUB!</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
        Your membership has been created. You&apos;re now part of the hybrid ecosystem.
      </p>

      <Card className="mt-6 p-5 max-w-sm mx-auto bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/30 border-emerald-200 dark:border-emerald-900">
        <p className="text-xs text-muted-foreground mb-1">Your unique profile number</p>
        <p className="text-2xl font-black font-mono bg-gradient-to-r from-emerald-600 to-amber-500 bg-clip-text text-transparent">
          {profileNumber || "KSH-000000"}
        </p>
        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-900 grid grid-cols-2 gap-2 text-left">
          <div>
            <p className="text-[10px] text-muted-foreground">Membership</p>
            <p className="text-xs font-semibold">{membershipType === "COMPANY" ? "Company" : "Individual"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Status</p>
            <p className="text-xs font-semibold text-emerald-600">Active</p>
          </div>
        </div>
      </Card>

      <Button onClick={onFinish} className="mt-6 bg-gradient-to-r from-emerald-600 to-emerald-500">
        Enter the ecosystem <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
