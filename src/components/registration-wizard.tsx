"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, X, Building2, User, Briefcase,
  Heart, Plane, Globe, Landmark, Smartphone, Sparkles, PartyPopper,
  Loader2, ShieldCheck, ExternalLink, Info, Download, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { useKasiStore } from "@/lib/store";
import type { CitizenshipType, MembershipType } from "@/lib/types";

type Step = "type" | "kasipay" | "subscription" | "details" | "review" | "done";

type KaSiPayStatus = "NONE" | "PENDING" | "VERIFIED";

const KASIPAY_CITIZENSHIPS: CitizenshipType[] = ["SA_CITIZEN_SA", "SA_NPO_NGO"];
const INTL_CITIZENSHIPS: CitizenshipType[] = [
  "SA_CITIZEN_ABROAD",
  "FOREIGN_CITIZEN_ABROAD",
  "INTL_COMPANY",
];

interface FormData {
  citizenshipType: CitizenshipType | null;
  membershipType: MembershipType | null;
  uplineProfileNumber: string;
  uplineConfirmed: boolean;
  uplineName: string | null;
  kasiPayStatus: KaSiPayStatus;
  kasiPayAccountRef: string | null;
  kasiPayVerifiedAt: string | null;
  kasiPayOption: "setup" | "have" | null;
  // Author: Klaasvaakie ( |╲ )
  // KaSiPay verification fields
  idNumber: string;
  passportNumber: string;
  asylumNumber: string;
  companyRegNo: string;
  npoNgoNumber: string;
  // Individual details
  firstName: string;
  lastName: string;
  idPassport: string;
  sarsNumber: string;
  guardianName: string;
  // Company / Org details
  companyName: string;
  organizationName: string;
  // Common
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
  mobile: string;
  addressLine: string;
  city: string;
  postalCode: string;
  beneficiaryName: string;
  beneficiaryId: string;
}

const INITIAL: FormData = {
  citizenshipType: null,
  membershipType: null,
  uplineProfileNumber: "",
  uplineConfirmed: false,
  uplineName: null,
  kasiPayStatus: "NONE",
  kasiPayAccountRef: null,
  kasiPayVerifiedAt: null,
  kasiPayOption: null,
  idNumber: "",
  passportNumber: "",
  asylumNumber: "",
  companyRegNo: "",
  npoNgoNumber: "",
  firstName: "",
  lastName: "",
  idPassport: "",
  sarsNumber: "",
  guardianName: "",
  companyName: "",
  organizationName: "",
  email: "",
  password: "",
  confirmPassword: "",
  country: "South Africa",
  mobile: "",
  addressLine: "",
  city: "",
  postalCode: "",
  beneficiaryName: "",
  beneficiaryId: "",
};

const CITIZENSHIP_OPTIONS: {
  value: CitizenshipType;
  label: string;
  desc: string;
  icon: typeof User;
}[] = [
  { value: "SA_CITIZEN_SA", label: "SA Citizen in SA", desc: "South African citizen residing in South Africa.", icon: User },
  { value: "FOREIGN_CITIZEN_SA", label: "Foreign Citizen in SA", desc: "Non-SA citizen currently living in South Africa.", icon: Globe },
  { value: "SA_CIPC_COMPANY", label: "SA CIPC Company", desc: "South African company registered with CIPC.", icon: Building2 },
  { value: "SA_SOLE_PROPRIETOR", label: "SA Sole Proprietor", desc: "South African sole proprietorship business.", icon: Briefcase },
  { value: "SA_NPO_NGO", label: "SA NPO / NGO", desc: "South African non-profit or non-governmental organisation.", icon: Heart },
  { value: "SA_CITIZEN_ABROAD", label: "SA Citizen Abroad", desc: "South African citizen living outside South Africa.", icon: Plane },
  { value: "FOREIGN_CITIZEN_ABROAD", label: "Foreign Citizen Abroad", desc: "Non-SA citizen living outside South Africa.", icon: Plane },
  { value: "INTL_COMPANY", label: "International Company", desc: "Company registered outside South Africa.", icon: Landmark },
];

function isInternational(c: CitizenshipType | null): boolean {
  return !!c && INTL_CITIZENSHIPS.includes(c);
}
function isCompanyType(c: CitizenshipType | null): boolean {
  return c === "SA_CIPC_COMPANY" || c === "INTL_COMPANY";
}
function isSoleProprietorType(c: CitizenshipType | null): boolean {
  return c === "SA_SOLE_PROPRIETOR";
}
function isNpoNgoType(c: CitizenshipType | null): boolean {
  return c === "SA_NPO_NGO";
}
function isIndividualType(c: CitizenshipType | null): boolean {
  return (
    c === "SA_CITIZEN_SA" ||
    c === "FOREIGN_CITIZEN_SA" ||
    c === "SA_CITIZEN_ABROAD" ||
    c === "FOREIGN_CITIZEN_ABROAD"
  );
}

function membershipLabel(c: CitizenshipType | null, m: MembershipType | null): string {
  if (!c || !m) return "—";
  if (isInternational(c)) {
    if (m === "COMPANY") return "International Company";
    if (m === "INDIVIDUAL_KIDS") return "International Individual Kid";
    if (m === "FREE") return "Free Member";
    return "International Individual Adult";
  }
  if (m === "COMPANY") return "SA Company / Sole Proprietor";
  if (m === "SOLE_PROPRIETOR") return "SA Company / Sole Proprietor";
  if (m === "NPO_NGO") return "SA NPO / NGO";
  if (m === "FREE") return "Free Member";
  return "SA Individual";
}

function citizenshipLabel(c: CitizenshipType | null): string {
  return CITIZENSHIP_OPTIONS.find((o) => o.value === c)?.label || "—";
}

function getSteps(c: CitizenshipType | null): { key: Step; label: string }[] {
  const steps: { key: Step; label: string }[] = [
    { key: "type", label: "Citizenship" },
  ];
  if (c && KASIPAY_CITIZENSHIPS.includes(c)) {
    steps.push({ key: "kasipay", label: "KaSiPay" });
  }
  steps.push({ key: "subscription", label: "Membership" });
  steps.push({ key: "details", label: "Details" });
  steps.push({ key: "review", label: "Review" });
  return steps;
}

export function RegistrationWizard() {
  const { closeRegistration, login } = useKasiStore();
  const [step, setStep] = useState<Step>("type");
  const [data, setData] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [newProfileNumber, setNewProfileNumber] = useState<string | null>(null);
  const [newMember, setNewMember] = useState<{
    id: string;
    profileNumber: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    email: string;
    membershipType: string;
  } | null>(null);

  const steps = getSteps(data.citizenshipType);
  const stepIndex = steps.findIndex((s) => s.key === step);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function setCitizenship(c: CitizenshipType) {
    setData((d) => ({
      ...d,
      citizenshipType: c,
      membershipType: null,
      // Author: Klaasvaakie ( |╲ )
      // Reset KaSiPay state when changing citizenship.
      kasiPayStatus: KASIPAY_CITIZENSHIPS.includes(c) ? "PENDING" : "NONE",
      kasiPayAccountRef: null,
      kasiPayVerifiedAt: null,
      kasiPayOption: null,
      // Adjust default country for international types
      country: isInternational(c) && d.country === "South Africa" ? "" : d.country,
    }));
  }

  function next() {
    const idx = steps.findIndex((s) => s.key === step);
    if (idx < steps.length - 1) setStep(steps[idx + 1].key);
  }
  function prev() {
    const idx = steps.findIndex((s) => s.key === step);
    if (idx > 0) setStep(steps[idx - 1].key);
  }

  async function submit() {
    if (!data.citizenshipType || !data.membershipType) {
      toast.error("Please complete all required fields.");
      return;
    }
    if (!data.email || !data.mobile) {
      toast.error("Email and mobile are required.");
      return;
    }
    if (data.password.length < 12) {
      toast.error("Password must contain at least 12 characters.");
      return;
    }
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        citizenshipType: data.citizenshipType,
        membershipType: data.membershipType,
        uplineProfileNumber: data.uplineProfileNumber || null,
        uplineConfirmed: data.uplineConfirmed,
        // Author: Klaasvaakie ( |╲ )
        // These payload keys preserve the existing backend contract; KaSiPay is the product shown to members.
        instapayStatus: data.kasiPayStatus,
        instapayAccountRef: data.kasiPayAccountRef,
        instapayVerifiedAt: data.kasiPayVerifiedAt,
        email: data.email,
        password: data.password,
        country: data.country,
        mobile: data.mobile,
        addressLine: data.addressLine || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        beneficiaryName: data.beneficiaryName || null,
        beneficiaryId: data.beneficiaryId || null,
      };
      if (isCompanyType(data.citizenshipType)) {
        payload.companyName = data.companyName;
        payload.companyRegNo = data.companyRegNo;
      } else if (isNpoNgoType(data.citizenshipType)) {
        payload.companyName = data.organizationName;
        payload.companyRegNo = data.npoNgoNumber || data.companyRegNo;
      } else if (isSoleProprietorType(data.citizenshipType)) {
        payload.companyName = data.companyName;
        payload.idPassport = data.idPassport;
      } else {
        payload.firstName = data.firstName;
        payload.lastName = data.lastName;
        payload.idPassport = data.idPassport;
        payload.sarsNumber = data.sarsNumber || null;
        payload.guardianName = data.guardianName || null;
      }

      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      fetch(`/api/members?memberId=${newMember.id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.member) login(d.member.id, d.member);
        })
        .catch(() => {})
        .finally(() => closeRegistration());
    } else {
      closeRegistration();
    }
  }

  // Stepper rendering only for non-done steps
  const showStepper = step !== "done";

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && closeRegistration()}>
      <DialogContent
        showCloseButton={false}
        className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] max-h-[92vh] overflow-y-auto p-0 gap-0 scrollbar-kasi"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-14 w-24" />
              <div>
                <DialogTitle className="text-xl">Join KaSiHUB</DialogTitle>
                <p className="text-xs text-muted-foreground">Become a member of the Eco-System</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close registration"
              onClick={closeRegistration}
              disabled={submitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showStepper && (
            <div className="mt-6 flex items-center gap-2">
              {steps.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.key} className="flex-1 flex items-center gap-2">
                    <div className={`flex items-center gap-2 ${active || done ? "text-emerald-600" : "text-muted-foreground"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        active ? "border-emerald-600 bg-emerald-600 text-white" :
                        done ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-600" :
                        "border-border bg-background"
                      }`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${active ? "" : "text-muted-foreground"}`}>{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
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
              {step === "type" && (
                <TypeStep
                  data={data}
                  setCitizenship={setCitizenship}
                  update={update}
                />
              )}
              {step === "kasipay" && (
                <KaSiPayStep data={data} update={update} />
              )}
              {step === "subscription" && (
                <SubscriptionStep data={data} update={update} />
              )}
              {step === "details" && (
                <DetailsStep data={data} update={update} />
              )}
              {step === "review" && (
                <ReviewStep data={data} />
              )}
              {step === "done" && (
                <DoneStep
                  profileNumber={newProfileNumber}
                  membershipLabel={membershipLabel(data.citizenshipType, data.membershipType)}
                  onFinish={finish}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {step !== "done" && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={prev} disabled={stepIndex === 0 || submitting}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              {step === "review" ? (
                <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating profile...
                    </>
                  ) : (
                    <>
                      Complete registration <Sparkles className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={next}
                  disabled={!canProceed(step, data)}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-500"
                >
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

function canProceed(step: Step, data: FormData): boolean {
  if (step === "type") {
    if (!data.citizenshipType) return false;
    if (!data.uplineConfirmed) return false;
    return true;
  }
  if (step === "kasipay") {
    // Author: Klaasvaakie ( |╲ )
    // Continue after verification or acknowledgement of the KaSiPay setup path.
    return data.kasiPayStatus === "VERIFIED" || data.kasiPayOption === "setup";
  }
  if (step === "subscription") {
    return !!data.membershipType;
  }
  if (step === "details") {
    if (!data.email || !data.mobile) return false;
    if (data.password.length < 12 || data.password !== data.confirmPassword) return false;
    if (isCompanyType(data.citizenshipType)) {
      return !!data.companyName && !!data.companyRegNo;
    }
    if (isNpoNgoType(data.citizenshipType)) {
      return !!data.organizationName;
    }
    if (isSoleProprietorType(data.citizenshipType)) {
      return !!data.companyName && !!data.idPassport;
    }
    return !!data.firstName && !!data.lastName;
  }
  return true;
}

// ============ STEP 1: CITIZENSHIP TYPE ============

function TypeStep({
  data,
  setCitizenship,
  update,
}: {
  data: FormData;
  setCitizenship: (c: CitizenshipType) => void;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const [uplineInput, setUplineInput] = useState(data.uplineProfileNumber);
  const [looking, setLooking] = useState(false);

  // Lookup upline profile when input changes (debounced)
  useEffect(() => {
    const trimmed = uplineInput.trim();
    if (!trimmed) {
      update("uplineProfileNumber", "");
      update("uplineName", null);
      update("uplineConfirmed", false);
      return;
    }
    update("uplineProfileNumber", trimmed);
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/members?search=${encodeURIComponent(trimmed)}&limit=1`
        );
        if (res.ok) {
          const json = await res.json();
          const m = json.members?.[0];
          if (m && m.profileNumber === trimmed) {
            const name =
              m.companyName ||
              `${m.firstName || ""} ${m.lastName || ""}`.trim() ||
              m.profileNumber;
            update("uplineName", name);
          } else {
            update("uplineName", trimmed);
          }
        } else {
          update("uplineName", trimmed);
        }
      } catch {
        update("uplineName", trimmed);
      } finally {
        setLooking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [uplineInput]);

  const confirmText = data.uplineProfileNumber.trim()
    ? `I confirm that ${data.uplineName || data.uplineProfileNumber} is my upline`
    : "I confirm that I am joining via bulk registration";

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Citizenship / Entity type</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Tell us who you are. This determines your pricing and which payment platform you&apos;ll use.
      </p>

      <RadioGroup
        value={data.citizenshipType || ""}
        onValueChange={(v) => setCitizenship(v as CitizenshipType)}
        className="grid sm:grid-cols-2 gap-3"
      >
        {CITIZENSHIP_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = data.citizenshipType === opt.value;
          return (
            <div key={opt.value} className="relative">
              <RadioGroupItem
                value={opt.value}
                id={`cit-${opt.value}`}
                className="absolute top-4 right-4 z-10 data-[state=checked]:border-emerald-600 data-[state=checked]:text-emerald-600"
              />
              <label htmlFor={`cit-${opt.value}`} className="block cursor-pointer">
                <Card
                  className={`p-5 h-full transition-all ${
                    active
                      ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "hover:border-border hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start gap-3 pr-8">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </div>
                </Card>
              </label>
            </div>
          );
        })}
      </RadioGroup>

      <Separator className="my-6" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="upline">Sponsor / Upline profile number (optional)</Label>
          <Input
            id="upline"
            placeholder="e.g. KSH-000001"
            value={uplineInput}
            onChange={(e) => setUplineInput(e.target.value)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Leave blank if you joined via bulk registration.
          </p>
        </div>
        <div className="flex items-end">
          <div className="rounded-lg border border-border bg-muted/30 p-3 w-full">
            {looking ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Looking up upline...
              </p>
            ) : data.uplineProfileNumber.trim() ? (
              <p className="text-xs">
                <span className="text-muted-foreground">Upline: </span>
                <span className="font-semibold">{data.uplineName || data.uplineProfileNumber}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No upline provided — joining via bulk registration.
              </p>
            )}
          </div>
        </div>
      </div>

      <label
        htmlFor="upline-confirm"
        className="mt-4 flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer"
      >
        <Checkbox
          id="upline-confirm"
          checked={data.uplineConfirmed}
          onCheckedChange={(c) => update("uplineConfirmed", c === true)}
          className="mt-0.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
        />
        <span className="text-sm font-medium">{confirmText}</span>
      </label>
    </div>
  );
}

// ============ STEP 2: KASIPAY ============

function KaSiPayStep({
  data,
  update,
}: {
  data: FormData;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const [verifying, setVerifying] = useState(false);

  const isNpo = isNpoNgoType(data.citizenshipType);

  async function handleVerify() {
    const identifier =
      data.idNumber ||
      data.passportNumber ||
      data.asylumNumber ||
      data.companyRegNo ||
      data.npoNgoNumber;
    if (!identifier || identifier.length < 6) {
      toast.error("Please enter a valid identifier (at least 6 characters).");
      return;
    }
    setVerifying(true);
    try {
      // Author: Klaasvaakie ( |╲ )
      // Provider verification is submitted only after Encore creates the member identity.
      update("kasiPayStatus", "PENDING");
      update("kasiPayAccountRef", null);
      update("kasiPayVerifiedAt", null);
      update("kasiPayOption", "setup");
      toast.success("Details captured. Verification will continue after registration.");
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const verified = data.kasiPayStatus === "VERIFIED";

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">KaSiPay Gini setup</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Your SA membership subscription is processed via KaSiPay Gini. Choose an option below.
      </p>

      {verified ? (
        <Card className="p-6 border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-700 dark:text-emerald-400">KaSiPay account verified</p>
              <p className="text-sm text-muted-foreground mt-1">
                Account reference: <span className="font-mono font-semibold">{data.kasiPayAccountRef}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Verified at {data.kasiPayVerifiedAt ? new Date(data.kasiPayVerifiedAt).toLocaleString() : "—"}
              </p>
            </div>
            <Badge className="bg-emerald-600 text-white">Verified</Badge>
          </div>
        </Card>
      ) : (
        <RadioGroup
          value={data.kasiPayOption || ""}
          onValueChange={(v) => update("kasiPayOption", v as "setup" | "have")}
          className="grid gap-4"
        >
          {/* Author: Klaasvaakie ( |╲ ) — KaSiPay setup option */}
          <div className="relative">
            <RadioGroupItem
              value="setup"
              id="kasipay-setup"
              className="absolute top-5 right-5 z-10 data-[state=checked]:border-emerald-600 data-[state=checked]:text-emerald-600"
            />
            <label htmlFor="kasipay-setup" className="block cursor-pointer">
              <Card
                className={`p-5 transition-all ${
                  data.kasiPayOption === "setup"
                    ? "border-emerald-500 ring-2 ring-emerald-500/30"
                    : "hover:border-border"
                }`}
              >
                <div className="flex items-start gap-3 pr-8">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">Set up KaSiPay Gini</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Review the official KaSiPay Gini information, then return here to continue.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/kasipay/gini"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Smartphone className="h-4 w-4" />
                        KaSiPay Gini
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                      <a
                        href="/kasipay/contact"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted transition-colors"
                      >
                        Contact KaSiPay
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            </label>
          </div>

          {/* Have account option */}
          <div className="relative">
            <RadioGroupItem
              value="have"
              id="kasipay-have"
              className="absolute top-5 right-5 z-10 data-[state=checked]:border-emerald-600 data-[state=checked]:text-emerald-600"
            />
            <label htmlFor="kasipay-have" className="block cursor-pointer">
              <Card
                className={`p-5 transition-all ${
                  data.kasiPayOption === "have"
                    ? "border-emerald-500 ring-2 ring-emerald-500/30"
                    : "hover:border-border"
                }`}
              >
                <div className="flex items-start gap-3 pr-8">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">I already have a KaSiPay Gini or Merchant Account</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verify your existing account by providing one of the identifiers below.
                    </p>
                  </div>
                </div>
              </Card>
            </label>
          </div>
        </RadioGroup>
      )}

      {data.kasiPayOption === "have" && !verified && (
        <Card className="mt-4 p-5 border-dashed">
          <p className="text-sm font-semibold mb-1">Verify your KaSiPay account</p>
          <p className="text-xs text-muted-foreground mb-4">
            Provide <span className="font-semibold">one</span> of the following identifiers that matches your KaSiPay account.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isNpo && (
              <>
                <Field
                  label="ID Number"
                  value={data.idNumber}
                  onChange={(v) => update("idNumber", v)}
                  placeholder="8501015800087"
                />
                <Field
                  label="Passport Number"
                  value={data.passportNumber}
                  onChange={(v) => update("passportNumber", v)}
                  placeholder="A12345678"
                />
                <Field
                  label="Asylum Number"
                  value={data.asylumNumber}
                  onChange={(v) => update("asylumNumber", v)}
                  placeholder="AS-2024-001234"
                />
              </>
            )}
            {isNpo && (
              <>
                <Field
                  label="Company Registration Number"
                  value={data.companyRegNo}
                  onChange={(v) => update("companyRegNo", v)}
                  placeholder="2018/123456/07"
                />
                <Field
                  label="NPO / NGO Number"
                  value={data.npoNgoNumber}
                  onChange={(v) => update("npoNgoNumber", v)}
                  placeholder="123-456-NPO"
                />
              </>
            )}
          </div>
          <Button
            onClick={handleVerify}
            disabled={verifying}
            className="mt-4 bg-gradient-to-r from-emerald-600 to-emerald-500"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Verify Account
              </>
            )}
          </Button>
        </Card>
      )}

      <div className="mt-6 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Subscription is processed via KaSiPay Gini with Adamo subscription integration.
            {data.kasiPayOption === "setup" && " You can complete this step later — KaSiPay setup is required before your first subscription payment."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ STEP 3: MEMBERSHIP & SUBSCRIPTION ============

function SubscriptionStep({
  data,
  update,
}: {
  data: FormData;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const intl = isInternational(data.citizenshipType);
  const currency = intl ? "USD" : "ZAR";
  const symbol = intl ? "$" : "R";

  const saOptions: { key: MembershipType; label: string; price: number; desc: string }[] = [
    { key: "INDIVIDUAL_ADULT", label: "SA Individual", price: 140, desc: "Individual SA member, full Eco-System access." },
    { key: "COMPANY", label: "SA Company / Sole Proprietor", price: 300, desc: "Registered SA business or sole proprietor." },
    { key: "NPO_NGO", label: "SA NPO / NGO", price: 250, desc: "Non-profit organisation registered in SA." },
    { key: "FREE", label: "Free Member", price: 0, desc: "Limited access — upgrade anytime later." },
  ];

  const intlOptions: { key: MembershipType; label: string; price: number; desc: string }[] = [
    { key: "INDIVIDUAL_ADULT", label: "International Individual Adult", price: 30, desc: "Adult member outside South Africa." },
    { key: "INDIVIDUAL_KIDS", label: "International Individual Kid", price: 30, desc: "Under 18, requires a guardian." },
    { key: "COMPANY", label: "International Company", price: 50, desc: "Company registered outside South Africa." },
    { key: "FREE", label: "Free Member", price: 0, desc: "Limited access — upgrade anytime later." },
  ];

  const options = intl ? intlOptions : saOptions;

  // Pre-select a sensible default for the citizenship type
  useEffect(() => {
    if (!data.membershipType) {
      let def: MembershipType = "INDIVIDUAL_ADULT";
      if (isCompanyType(data.citizenshipType)) def = "COMPANY";
      else if (isSoleProprietorType(data.citizenshipType)) def = "SOLE_PROPRIETOR";
      else if (isNpoNgoType(data.citizenshipType)) def = "NPO_NGO";
      // SOLE_PROPRIETOR isn't in the visible options list, fall back to COMPANY for SA sole prop
      if (def === "SOLE_PROPRIETOR" && !intl) def = "COMPANY";
      update("membershipType", def);
    }
  }, [data.citizenshipType]);

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Membership &amp; subscription</h3>
      <p className="text-sm text-muted-foreground mb-6">
        {intl
          ? "International members pay via the Bankus platform in USD."
          : "SA members pay via KaSiPay Gini in ZAR."}
      </p>

      <RadioGroup
        value={data.membershipType || ""}
        onValueChange={(v) => update("membershipType", v as MembershipType)}
        className="grid sm:grid-cols-2 gap-3"
      >
        {options.map((opt) => {
          const active = data.membershipType === opt.key;
          return (
            <div key={opt.key} className="relative">
              <RadioGroupItem
                value={opt.key}
                id={`mem-${opt.key}`}
                className="absolute top-4 right-4 z-10 data-[state=checked]:border-emerald-600 data-[state=checked]:text-emerald-600"
              />
              <label htmlFor={`mem-${opt.key}`} className="block cursor-pointer">
                <Card
                  className={`p-5 h-full transition-all ${
                    active
                      ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "hover:border-border hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="flex-1">
                      <p className="font-bold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-2xl font-black">
                    {symbol}{opt.price}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                </Card>
              </label>
            </div>
          );
        })}
      </RadioGroup>

      <Card className="mt-6 p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              intl ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
            }`}
          >
            <Wallet className="h-5 w-5" />
          </div>
          <div className="text-sm">
            <p className="font-semibold">
              Payment method: {intl ? "Bankus Platform" : "KaSiPay Gini"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {intl
                ? "You will be redirected to Bankus to complete your payment."
                : "Subscription is processed via KaSiPay Gini with Adamo subscription integration."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============ STEP 4: DETAILS ============

function DetailsStep({
  data,
  update,
}: {
  data: FormData;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const c = data.citizenshipType;
  const isCompany = isCompanyType(c);
  const isSoleProp = isSoleProprietorType(c);
  const isNpo = isNpoNgoType(c);
  const isIndividual = isIndividualType(c);
  const intl = isInternational(c);

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">
        {isCompany || isSoleProp
          ? "Business details"
          : isNpo
            ? "Organisation details"
            : "Personal details"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        This information is used to generate your unique profile number.
      </p>

      {isCompany && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required value={data.companyName} onChange={(v) => update("companyName", v)} placeholder="Acme Trading (Pty) Ltd" />
          <Field label="Company registration no." required value={data.companyRegNo} onChange={(v) => update("companyRegNo", v)} placeholder="2018/123456/07" />
        </div>
      )}

      {isSoleProp && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required value={data.companyName} onChange={(v) => update("companyName", v)} placeholder="Thabo Plumbing" />
          <Field label="Personal ID number" required value={data.idPassport} onChange={(v) => update("idPassport", v)} placeholder="8501015800087" />
        </div>
      )}

      {isNpo && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organisation name" required value={data.organizationName} onChange={(v) => update("organizationName", v)} placeholder="Helping Hands NPO" />
          <Field label="NPO / NGO number" value={data.npoNgoNumber} onChange={(v) => update("npoNgoNumber", v)} placeholder="123-456-NPO" />
        </div>
      )}

      {isIndividual && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required value={data.firstName} onChange={(v) => update("firstName", v)} placeholder="Thabo" />
          <Field label="Last name" required value={data.lastName} onChange={(v) => update("lastName", v)} placeholder="Mokoena" />
          <Field
            label={intl ? "Passport number" : "ID / Passport number"}
            required
            value={data.idPassport}
            onChange={(v) => update("idPassport", v)}
            placeholder={intl ? "A12345678" : "8501015800087"}
          />
          {!intl && (
            <Field label="Personal SARS number" value={data.sarsNumber} onChange={(v) => update("sarsNumber", v)} placeholder="9123456789" />
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mt-4">
        <Field label="Email address" required type="email" value={data.email} onChange={(v) => update("email", v)} placeholder="you@example.com" />
        <Field label="Mobile number" required value={data.mobile} onChange={(v) => update("mobile", v)} placeholder="+27 82 123 4567" />
        <Field label="Password" required type="password" value={data.password} onChange={(v) => update("password", v)} placeholder="At least 12 characters" />
        <Field label="Confirm password" required type="password" value={data.confirmPassword} onChange={(v) => update("confirmPassword", v)} placeholder="Repeat your password" />
        <div>
          <Label>Country</Label>
          <select
            value={data.country}
            onChange={(e) => update("country", e.target.value)}
            className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Select country...</option>
            <option>South Africa</option>
            <option>Lesotho</option>
            <option>Eswatini</option>
            <option>Botswana</option>
            <option>Zimbabwe</option>
            <option>Namibia</option>
            <option>Mozambique</option>
            <option>United Kingdom</option>
            <option>United States</option>
            <option>United Arab Emirates</option>
            <option>Other</option>
          </select>
        </div>
        <Field label="City" value={data.city} onChange={(v) => update("city", v)} placeholder="Johannesburg" />
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

// ============ STEP 5: REVIEW ============

function ReviewStep({ data }: { data: FormData }) {
  const c = data.citizenshipType;
  const isCompany = isCompanyType(c);
  const isSoleProp = isSoleProprietorType(c);
  const isNpo = isNpoNgoType(c);
  const intl = isInternational(c);

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">Review &amp; confirm</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Please review your details before we generate your unique profile number.
      </p>

      <Card className="p-5 bg-muted/30">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Citizenship / Entity" value={citizenshipLabel(c)} />
          <Row label="Membership" value={membershipLabel(c, data.membershipType)} />
          <Row
            label="Upline"
            value={data.uplineProfileNumber ? (data.uplineName || data.uplineProfileNumber) : "Bulk registration"}
          />
          <Row
            label="KaSiPay status"
            value={
              KASIPAY_CITIZENSHIPS.includes(c as CitizenshipType)
                ? data.kasiPayStatus === "VERIFIED"
                  ? `Verified (${data.kasiPayAccountRef})`
                  : "Pending / setup required"
                : "N/A"
            }
          />
          <Row
            label="Payment method"
            value={intl ? "Bankus Platform" : "KaSiPay Gini"}
          />
          {isCompany && (
            <>
              <Row label="Company" value={data.companyName || "—"} />
              <Row label="Reg. no." value={data.companyRegNo || "—"} />
            </>
          )}
          {isSoleProp && (
            <>
              <Row label="Business" value={data.companyName || "—"} />
              <Row label="Personal ID" value={data.idPassport || "—"} />
            </>
          )}
          {isNpo && (
            <>
              <Row label="Organisation" value={data.organizationName || "—"} />
              <Row label="NPO/NGO no." value={data.npoNgoNumber || "—"} />
            </>
          )}
          {!isCompany && !isSoleProp && !isNpo && (
            <>
              <Row label="Name" value={`${data.firstName} ${data.lastName}`.trim() || "—"} />
              <Row label="ID / Passport" value={data.idPassport || "—"} />
            </>
          )}
          <Row label="Email" value={data.email || "—"} />
          <Row label="Mobile" value={data.mobile || "—"} />
          <Row label="Country" value={data.country || "—"} />
          <Row label="City" value={data.city || "—"} />
          <Row label="Beneficiary" value={data.beneficiaryName || "—"} />
        </dl>
      </Card>

      <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 text-xs text-amber-800 dark:text-amber-300">
        <p className="font-semibold mb-1">Once you complete registration:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>You&apos;ll receive a unique profile number (e.g. KSH-000123)</li>
          <li>You&apos;ll be placed in the Eco-System</li>
          <li>Your profile will be created and you&apos;ll get access to the KaSiHUB UI.</li>
        </ul>
      </div>

      {data.uplineProfileNumber && (
        <label
          htmlFor="review-confirm"
          className="mt-4 flex items-start gap-3 p-4 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer"
        >
          <Checkbox
            id="review-confirm"
            checked={data.uplineConfirmed}
            disabled
            className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
          />
          <span className="text-sm font-medium">
            I confirm that {data.uplineName || data.uplineProfileNumber} is my upline
          </span>
        </label>
      )}
    </div>
  );
}

// ============ DONE STEP ============

function DoneStep({
  profileNumber,
  membershipLabel,
  onFinish,
}: {
  profileNumber: string | null;
  membershipLabel: string;
  onFinish: () => void;
}) {
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
        Your membership has been created. You&apos;re now part of the Eco-System.
      </p>

      <Card className="mt-6 p-5 max-w-sm mx-auto bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/30 border-emerald-200 dark:border-emerald-900">
        <p className="text-xs text-muted-foreground mb-1">Your unique profile number</p>
        <p className="text-2xl font-black font-mono bg-gradient-to-r from-emerald-600 to-amber-500 bg-clip-text text-transparent">
          {profileNumber || "KSH-000000"}
        </p>
        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-900 grid grid-cols-2 gap-2 text-left">
          <div>
            <p className="text-[10px] text-muted-foreground">Membership</p>
            <p className="text-xs font-semibold">{membershipLabel}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Status</p>
            <p className="text-xs font-semibold text-emerald-600">Active</p>
          </div>
        </div>
      </Card>

      <Button onClick={onFinish} className="mt-6 bg-gradient-to-r from-emerald-600 to-emerald-500">
        Enter the Eco-System <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

// ============ HELPERS ============

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
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
      <dd className="font-semibold break-words">{value}</dd>
    </div>
  );
}
