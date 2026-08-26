"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Copy, Eye, EyeOff, FileCheck2, Landmark, LockKeyhole, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRESALE_DEV_PREVIEW_OFFER, type PresaleDevPreviewOffer } from "@/lib/presale-dev-preview";
import { availablePaidShares, formatUsdt } from "@/lib/presale-display";

type Offer = PresaleDevPreviewOffer & {
  invitationEmail?: string;
  webPayUnitPriceZar?: string;
};

type Order = {
  orderReference: string;
  campaign: string;
  issuerName: string;
  shareClass: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  paymentRail: "remitano_usdt" | "webpay_card";
  unitPriceZar?: string;
  totalZar?: string;
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

type KycVerification = {
  required: boolean;
  verified: boolean;
  status: string;
  caseId: string | null;
};

type ResumePortal = {
  applicant: { profileNumber: string; email: string; legalName: string; phone: string; country: string; physicalAddress: string };
  application: null | { applicantType: "individual" | "company" | "trust"; nextStep: number; draft: Record<string, string | boolean> | null };
  kyc: { status: string; verified: boolean };
  continuation?: { nextStep: number | null; reason: string; resumeUrl: string | null };
};

const APPLICATION_PHASES = [
  { title: "Shareholder profile", description: "Create your KaSiHub shareholder profile and application identity", icon: UserRound },
  { title: "Choose your investment", description: "Allocation and current USDT price", icon: Landmark },
  { title: "Funding details", description: "Source of funds and investor banking", icon: WalletCards },
  { title: "Identity evidence", description: "Secure ID, selfie and declarations", icon: FileCheck2 },
  { title: "Terms and reserve", description: "Read and accept the terms before reservation", icon: ShieldCheck },
] as const;

const TERMS_PDF_PATH = "/legal/solidus-class-b-investor-terms-2026-08-16.pdf";
const TERMS_PAGE_PATHS = Array.from(
  { length: 10 },
  (_, index) => `/legal/solidus-class-b-investor-terms-2026-08-16/page-${String(index + 1).padStart(2, "0")}.png`,
);

const COUNTRY_CALLING_CODES = getCountries().map((country) => ({ country, code: `+${getCountryCallingCode(country)}` }));

function internationalCellphone(countryCode: string, nationalNumber: FormDataEntryValue | null): string {
  const value = String(nationalNumber ?? "").trim();
  const candidate = value.startsWith("+") ? value : `${countryCode}${value.replace(/\D/g, "")}`;
  const parsed = parsePhoneNumberFromString(candidate);
  if (!parsed?.isValid()) throw new Error("Enter a valid cellphone number for the selected country code.");
  return parsed.number;
}

function resumeNationalNumber(value?: string): string {
  return value ? parsePhoneNumberFromString(value)?.nationalNumber ?? value : "";
}

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

export function PresaleClient({ inviteToken, devPreview = false }: { inviteToken: string; devPreview?: boolean }) {
  const [offer, setOffer] = useState<Offer | null>(devPreview ? PRESALE_DEV_PREVIEW_OFFER : null);
  const [order, setOrder] = useState<Order | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!devPreview);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [applicationPhase, setApplicationPhase] = useState(1);
  const [quantity, setQuantity] = useState("1");
  const [paymentRail, setPaymentRail] = useState<"remitano_usdt" | "webpay_card">("remitano_usdt");
  const [applicantType, setApplicantType] = useState<"individual" | "company" | "trust">("individual");
  const [termsRead, setTermsRead] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [diditUrl, setDiditUrl] = useState("");
  const [kycVerification, setKycVerification] = useState<KycVerification | null>(null);
  const [memberProfileNumber, setMemberProfileNumber] = useState("");
  const [accountEmailStatus, setAccountEmailStatus] = useState<"sent" | "failed" | "existing" | "">("");
  const [accountNotice, setAccountNotice] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+27");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [resumeApplicant, setResumeApplicant] = useState<ResumePortal["applicant"] | null>(null);
  const [resumeLoading, setResumeLoading] = useState(!devPreview);
  const [resumeDraft, setResumeDraft] = useState<Record<string, string | boolean> | null>(null);
  const applicationFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    // Development preview has static display data and cannot contact the BFF.
    // Author: Klaasvaakie ( |╲ )
    if (devPreview) return;
    if (!inviteToken) { setLoading(false); return; }
    void fetch(`/api/presale/offer?invite=${encodeURIComponent(inviteToken)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Invitation unavailable");
        setOffer(payload.offer);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Invitation unavailable"))
      .finally(() => setLoading(false));
  }, [devPreview, inviteToken]);

  useEffect(() => {
    if (devPreview) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/presale/portal", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return;
        const portal = await response.json() as ResumePortal;
        setResumeApplicant(portal.applicant);
        const restoredPhone = parsePhoneNumberFromString(portal.applicant.phone);
        if (restoredPhone) setPhoneCountryCode(`+${restoredPhone.countryCallingCode}`);
        setMemberProfileNumber(portal.applicant.profileNumber);
        setKycVerification({ required: true, verified: portal.kyc.verified, status: portal.kyc.status, caseId: null });
        setVerificationStarted(portal.kyc.verified || portal.kyc.status.toLowerCase() !== "pending");
        if (!portal.application) return;
        setApplicantType(portal.application.applicantType);
        setResumeDraft(portal.application.draft);
        if (typeof portal.application.draft?.sourceOfFunds === "string") setSourceOfFunds(portal.application.draft.sourceOfFunds);
        if (typeof portal.application.draft?.quantity === "string") setQuantity(portal.application.draft.quantity);
        if (portal.application.draft?.paymentRail === "webpay_card" || portal.application.draft?.paymentRail === "remitano_usdt") {
          setPaymentRail(portal.application.draft.paymentRail);
        }
        const authoritativeNextStep = portal.continuation?.nextStep ?? portal.application.nextStep;
        setApplicationPhase(Math.max(1, Math.min(5, authoritativeNextStep)));
      }).catch(() => undefined).finally(() => setResumeLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [devPreview]);

  useEffect(() => {
    const form = applicationFormRef.current;
    if (!form || !resumeDraft) return;
    for (const [name, value] of Object.entries(resumeDraft)) {
      if (name === "accountPassword" || name === "confirmAccountPassword") continue;
      const controls = form.elements.namedItem(name);
      const elements = controls instanceof RadioNodeList ? Array.from(controls) : controls ? [controls] : [];
      for (const control of elements) {
        if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
          control.checked = typeof value === "boolean" ? value : control.value === value;
        } else if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
          control.value = String(value);
        }
      }
    }
  }, [resumeDraft, applicationPhase]);

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

  const refreshKycVerification = useCallback(async () => {
    if (devPreview) return null;
    const response = await fetch("/api/presale/kyc-status", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Identity verification status is unavailable");
    const verification = payload.verification as KycVerification;
    setKycVerification(verification);
    if (verification.verified) setApplicationPhase(5);
    return verification;
  }, [devPreview]);

  useEffect(() => {
    if (!order || !accessToken || ["confirmed", "expired", "cancelled", "incorporated"].includes(order.status)) return;
    const timer = window.setInterval(() => { void refreshOrder(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [accessToken, order, refreshOrder]);

  useEffect(() => {
    if (!verificationStarted || kycVerification?.verified || devPreview) return;
    const timer = window.setInterval(() => { void refreshKycVerification().catch(() => undefined); }, 10_000);
    return () => window.clearInterval(timer);
  }, [devPreview, verificationStarted, kycVerification?.verified, refreshKycVerification]);

  useEffect(() => {
    // A fresh applicant must accept the phase-four declarations before KYC can
    // advance them. Only resume polling after verification was explicitly started.
    if (applicationPhase !== 4 || devPreview || !memberProfileNumber || !verificationStarted || kycVerification) return;
    void refreshKycVerification().catch(() => undefined);
  }, [applicationPhase, devPreview, memberProfileNumber, verificationStarted, kycVerification, refreshKycVerification]);

  const maximumPaidShares = offer ? availablePaidShares(offer.invitationSharesRemaining, offer.sharesRemaining) : 0;
  const totalPreview = offer ? Number(offer.priceUsdt) * Number(quantity || 0) : 0;
  const webPayUnitPriceZar = Number(offer?.webPayUnitPriceZar ?? 450);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (devPreview) return;
    if (!offer) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    let cellphone: string;
    let confirmedCellphone: string;
    try {
      cellphone = internationalCellphone(String(data.get("phoneCountryCode") ?? "+27"), data.get("buyerPhone"));
      confirmedCellphone = internationalCellphone(String(data.get("phoneCountryCode") ?? "+27"), data.get("confirmMobileNumber"));
    } catch (reason) {
      setApplicationPhase(1);
      setError(reason instanceof Error ? reason.message : "Enter a valid cellphone number.");
      return;
    }
    const requiredIdentityFields = [
      "buyerName", "buyerEmail", "buyerPhone", "confirmMobileNumber", "applicantType",
      "nationality", "countryOfResidence", "occupation", "employer", "taxNumber",
      "streetAddress", "suburb", "city", "postalCode",
    ];
    const missingIdentityField = requiredIdentityFields.find((name) => !String(data.get(name) ?? "").trim());
    if (missingIdentityField || cellphone !== confirmedCellphone) {
      setApplicationPhase(1);
      setError(missingIdentityField
        ? "Review your investor identity details before creating the reservation."
        : "Cellphone numbers must match before creating the reservation.");
      return;
    }
    const declarationsAccepted = ["amlDeclarationAccepted", "suitabilityDeclarationAccepted", "informationDeclarationAccepted"]
      .every((name) => data.get(name) === "on");
    if (!declarationsAccepted) {
      setApplicationPhase(4);
      setError("Review and accept all investor declarations before creating the reservation.");
      return;
    }
    if (!Number.isInteger(Number(data.get("quantity"))) || Number(data.get("quantity")) < 1) {
      setApplicationPhase(2);
      setError("Choose a valid share quantity before creating the reservation.");
      return;
    }
    setSubmitting(true);
    setError("");
    const quantity = Number(data.get("quantity"));
    try {
      const response = await fetch("/api/presale/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          inviteToken,
          buyerName: data.get("buyerName"),
          buyerEmail: data.get("buyerEmail"),
          buyerPhone: cellphone,
          quantity,
          paymentRail: data.get("paymentRail"),
          termsAccepted: data.get("termsAccepted") === "on",
          investorApplication: {
            applicantType: data.get("applicantType"),
            dateOfBirth: data.get("dateOfBirth") || undefined,
            nationality: data.get("nationality") || undefined,
            occupation: data.get("occupation") || undefined,
            employer: data.get("employer") || undefined,
            countryOfResidence: data.get("countryOfResidence") || undefined,
            streetAddress: data.get("streetAddress"),
            suburb: data.get("suburb"),
            city: data.get("city"),
            postalCode: data.get("postalCode"),
            confirmMobileNumber: confirmedCellphone,
            taxNumber: data.get("taxNumber") || undefined,
            taxResidenceCountry: data.get("taxResidenceCountry") || undefined,
            tin: data.get("tin") || undefined,
            additionalTaxJurisdictions: data.get("additionalTaxJurisdictions") || undefined,
            entityRegistrationNumber: data.get("entityRegistrationNumber") || undefined,
            vatNumber: data.get("vatNumber") || undefined,
            authorisedRepresentativeName: data.get("authorisedRepresentativeName") || undefined,
            authorisedRepresentativePosition: data.get("authorisedRepresentativePosition") || undefined,
            beneficialOwnerName: data.get("beneficialOwnerName") || undefined,
            beneficialOwnerRelationship: data.get("beneficialOwnerRelationship") || undefined,
            sourceOfFunds: data.get("sourceOfFunds") || undefined,
            sourceOfFundsDetails: data.get("sourceOfFundsDetails") || undefined,
            fundsOwnership: data.get("fundsOwnership") || undefined,
            bankAccountHolder: data.get("bankAccountHolder") || undefined,
            bankName: data.get("bankName") || undefined,
            bankBranch: data.get("bankBranch") || undefined,
            bankAccountNumber: data.get("bankAccountNumber") || undefined,
            bankAccountType: data.get("bankAccountType") || undefined,
            bankSwift: data.get("bankSwift") || undefined,
            amlDeclarationAccepted: data.get("amlDeclarationAccepted") === "on",
            suitabilityDeclarationAccepted: data.get("suitabilityDeclarationAccepted") === "on",
            informationDeclarationAccepted: data.get("informationDeclarationAccepted") === "on",
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Order could not be created");
      setOrder(payload.order);
      setAccessToken(payload.accessToken);
      if (payload.emailStatus === "failed") {
        setError("Your reservation was created, but the confirmation email could not be sent. Use the payment instructions shown here and keep your order reference.");
      }
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

  async function startIdentityVerification() {
    if (devPreview || verificationStarted) return;
    const response = await fetch("/api/presale/kyc-session", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Identity verification could not be started");
    if (typeof payload.session?.url !== "string" || !payload.session.url.startsWith("https://verify.didit.me/")) {
      throw new Error("Identity verification returned an invalid session");
    }
    setDiditUrl(payload.session.url);
    setVerificationStarted(true);
  }

  async function startWebPayCheckout() {
    if (!order || order.paymentRail !== "webpay_card" || !accessToken) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/presale/orders/${encodeURIComponent(order.orderReference)}/webpay-checkout`, {
        method: "POST",
        headers: { "X-Presale-Access-Token": accessToken },
      });
      const payload = await response.json() as { actionUrl?: string; fields?: Record<string, string>; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "WebPay checkout could not be started");
      if (!payload.actionUrl?.startsWith("https://") || !payload.fields) throw new Error("WebPay returned an invalid checkout");
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payload.actionUrl;
      for (const [name, value] of Object.entries(payload.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "WebPay checkout could not be started");
      setSubmitting(false);
    }
  }

  async function registerMember(form: HTMLFormElement) {
    if (devPreview || memberProfileNumber) return;
    const data = new FormData(form);
    const password = String(data.get("accountPassword") ?? "");
    const confirmation = String(data.get("confirmAccountPassword") ?? "");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    if (password.length < 12 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new Error("Use at least 12 characters with a number and a special character.");
    }
    const cellphone = internationalCellphone(String(data.get("phoneCountryCode") ?? "+27"), data.get("buyerPhone"));
    const confirmedCellphone = internationalCellphone(String(data.get("phoneCountryCode") ?? "+27"), data.get("confirmMobileNumber"));
    if (cellphone !== confirmedCellphone) throw new Error("Cellphone numbers must match.");
    const response = await fetch("/api/presale/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken,
        email: data.get("buyerEmail"),
        password,
        legalName: data.get("buyerName"),
        phone: cellphone,
        applicantType: data.get("applicantType"),
        nationality: data.get("nationality"),
        countryOfResidence: data.get("countryOfResidence"),
        streetAddress: data.get("streetAddress"),
        suburb: data.get("suburb"),
        city: data.get("city"),
        postalCode: data.get("postalCode"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Member registration is temporarily unavailable.");
    setMemberProfileNumber(payload.profileNumber);
    setAccountEmailStatus(payload.emailStatus);
    if (payload.emailStatus === "sent" || payload.emailStatus === "existing") setAccountNotice(true);
  }

  function applicationDraft(form: HTMLFormElement): Record<string, string | boolean> {
    const draft: Record<string, string | boolean> = {};
    for (const [name, value] of new FormData(form).entries()) {
      if (name !== "accountPassword" && name !== "confirmAccountPassword") draft[name] = String(value);
    }
    for (const name of ["amlDeclarationAccepted", "suitabilityDeclarationAccepted", "informationDeclarationAccepted"]) {
      const control = form.elements.namedItem(name);
      draft[name] = control instanceof HTMLInputElement && control.checked;
    }
    return draft;
  }

  async function saveProgress(form: HTMLFormElement, phaseCompleted: number) {
    if (devPreview) return;
    const response = await fetch("/api/presale/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseCompleted, draft: applicationDraft(form) }),
    });
    if (!response.ok) throw new Error("Application progress could not be saved.");
  }

  async function advanceApplication(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const invalid = Array.from(form.querySelectorAll<HTMLElement>(`[data-application-phase="${applicationPhase}"] [required]`))
      .find((field) => field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? !field.checkValidity() : false);
    if (invalid instanceof HTMLInputElement || invalid instanceof HTMLSelectElement || invalid instanceof HTMLTextAreaElement) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    if (applicationPhase === 1 && !devPreview && !memberProfileNumber) {
      setSubmitting(true);
      setError("");
      try {
        await registerMember(form);
        await saveProgress(form, 1);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Member registration is temporarily unavailable.");
        return;
      } finally {
        setSubmitting(false);
      }
    }
    if (applicationPhase === 4) {
      if (devPreview) {
        setApplicationPhase(5);
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        await startIdentityVerification();
        const verification = await refreshKycVerification();
        if (!verification?.verified) return;
        await saveProgress(form, 4);
      } catch {
        setError("Identity verification is currently unavailable. Please try again shortly.");
        return;
      } finally {
        setSubmitting(false);
      }
    }
    if (applicationPhase === 2 || applicationPhase === 3) {
      try {
        await saveProgress(form, applicationPhase);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Application progress could not be saved.");
        return;
      }
    }
    setApplicationPhase((phase) => Math.min(5, phase + 1));
  }

  if (loading || resumeLoading) return <Shell><p className="text-sm text-slate-400">Opening private application…</p></Shell>;
  if (!devPreview && (!inviteToken || (!offer && error))) return (
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
      <div className="grid min-w-0 w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
        <section className="min-w-0 space-y-6">
          <div className="presale-badge inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[.18em]">
            <LockKeyhole className="h-3.5 w-3.5" /> {devPreview ? "Development preview — no payment" : "Private presale"}
          </div>
          <div>
            <p className="presale-eyebrow">KaSiShares founding allocation</p>
            <h1 className="presale-display mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">{offer.name}</h1>
            <p className="presale-lede mt-4 max-w-2xl text-lg leading-8">Own a stake in the ecosystem we are building together. Review your private allocation terms before any payment is made.</p>
          </div>
          <div className="presale-motifs" aria-label="Own, grow, prosper, better together">
            {(["own", "grow", "prosper", "better"] as const).map((value) => (
              <Image key={value} src={`/kasishares-${value}.png`} alt={`${value[0].toUpperCase()}${value.slice(1)}.`} width={180} height={180} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Price per paid share" value={`$${Number(offer.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Metric label="USDT price" value={`${formatUsdt(offer.priceUsdt)} USDT`} />
            <Metric label="Your allocation" value={`${offer.invitationSharesRemaining.toLocaleString()} shares`} />
            <Metric label="Network" value={offer.network} />
          </div>
        </section>

        {!order ? (
          <Card className="presale-form-card min-w-0 text-white shadow-2xl shadow-black/20">
            <CardHeader><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Investor application</p><h2 className="mt-2 font-semibold leading-none">{APPLICATION_PHASES[applicationPhase - 1].title}</h2><CardDescription className="text-slate-400">Step {applicationPhase} of 5 · {APPLICATION_PHASES[applicationPhase - 1].description}</CardDescription></CardHeader>
            <CardContent><form ref={applicationFormRef} key={resumeApplicant?.profileNumber ?? "new-applicant"} className="space-y-5" noValidate onSubmit={createOrder}>
              <ApplicationProgress phase={applicationPhase} />
              <div data-application-phase="1" hidden={applicationPhase !== 1} className="space-y-5">
              <SectionTitle>KASIHUB SHAREHOLDER PROFILE</SectionTitle>
              <p className="text-sm leading-6 text-slate-300">Your secure Shareholder profile links to this application, identity verification, share purchase and certificate.</p>
              <Field label="Full legal name"><Input name="buyerName" required minLength={2} defaultValue={resumeApplicant?.legalName} className="border-white/15 bg-black/20" /></Field>
              <Field label="Email address"><Input name="buyerEmail" type="email" required defaultValue={resumeApplicant?.email ?? offer.invitationEmail} readOnly={Boolean(resumeApplicant?.email || offer.invitationEmail)} className="border-white/15 bg-black/20" /></Field>
              <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
                <Field label="Country code *"><select name="phoneCountryCode" required value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-sm">{COUNTRY_CALLING_CODES.map(({ country, code }) => <option key={country} value={code}>{country} {code}</option>)}</select></Field>
                <Field label="Cellphone number *"><Input name="buyerPhone" type="tel" inputMode="tel" required defaultValue={resumeNationalNumber(resumeApplicant?.phone)} placeholder="82 123 4567" className="border-white/15 bg-black/20" /></Field>
              </div>
              <Field label="Confirm cellphone number *"><Input name="confirmMobileNumber" type="tel" inputMode="tel" required defaultValue={resumeNationalNumber(resumeApplicant?.phone)} placeholder="82 123 4567" className="border-white/15 bg-black/20" /></Field>
              <p className="text-xs leading-5 text-slate-400">Both cellphone entries must match and must be a valid length for the selected country code.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account password *"><div className="relative"><Input name="accountPassword" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/15 bg-black/20 pr-20" />{password.length >= 12 && <Check className="absolute right-11 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400" aria-label="Password has at least 12 characters" />}<button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></Field>
                <Field label="Confirm account password *"><div className="relative"><Input name="confirmAccountPassword" type={showConfirmPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="border-white/15 bg-black/20 pr-12" /><button type="button" onClick={() => setShowConfirmPassword((shown) => !shown)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></Field>
              </div>
              <p className="text-xs leading-5 text-slate-400">Password must contain at least 12 characters, including a number and a special character. Both passwords must match.</p>
              {memberProfileNumber ? <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"><strong className="block text-white">Applicant profile ready</strong>Profile {memberProfileNumber} is securely linked to this application. {accountEmailStatus === "sent" ? "Your account email has been sent." : accountEmailStatus === "failed" ? "Your account exists, but the email provider did not accept the welcome email. Use Applicant login above and contact support if needed." : "Use Applicant login above to return later."}</div> : null}
              <SectionTitle>Investor identity</SectionTitle>
              <Field label="Application type *"><select name="applicantType" required value={applicantType} onChange={(event) => setApplicantType(event.target.value as typeof applicantType)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-sm"><option value="individual">Individual application</option><option value="company">Company application</option><option value="trust">Trust application</option></select></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth (individual)"><Input name="dateOfBirth" type="date" className="border-white/15 bg-black/20" /></Field>
                <Field label="Nationality *"><Input name="nationality" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Country of residence *"><Input name="countryOfResidence" required defaultValue={resumeApplicant?.country} className="border-white/15 bg-black/20" /></Field>
                <Field label="Occupation *"><Input name="occupation" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Employer *"><Input name="employer" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Tax number *"><Input name="taxNumber" required className="border-white/15 bg-black/20" /></Field>
              </div>
              <SectionTitle>Physical address</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Street address *"><Input name="streetAddress" required defaultValue={resumeApplicant?.physicalAddress} className="border-white/15 bg-black/20" /></Field>
                <Field label="Suburb *"><Input name="suburb" required className="border-white/15 bg-black/20" /></Field>
                <Field label="City *"><Input name="city" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Postal code *"><Input name="postalCode" required inputMode="text" className="border-white/15 bg-black/20" /></Field>
              </div>
              {applicantType !== "individual" && <div className="grid gap-4 sm:grid-cols-2"><Field label={`${applicantType === "company" ? "Company" : "Trust"} registration number *`}><Input name="entityRegistrationNumber" required className="border-white/15 bg-black/20" /></Field>{applicantType === "company" && <Field label="VAT number (optional)"><Input name="vatNumber" className="border-white/15 bg-black/20" /></Field>}<Field label="Authorised representative *"><Input name="authorisedRepresentativeName" required className="border-white/15 bg-black/20" /></Field><Field label="Representative position *"><Input name="authorisedRepresentativePosition" required className="border-white/15 bg-black/20" /></Field></div>}
              </div>
              <div data-application-phase="2" hidden={applicationPhase !== 2} className="space-y-5">
              <SectionTitle>Investment</SectionTitle>
              <Field label="Phase 1 shares at $25 each *"><Input name="quantity" type="number" required min={1} max={maximumPaidShares} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="border-white/15 bg-black/20" /></Field>
              <p className="text-xs text-emerald-200">This invitation allows up to {maximumPaidShares.toLocaleString()} paid shares. Each paid share receives one bonus share free.</p>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><p className="font-semibold text-white">Estimated investment</p><p className="mt-1">Your current total is {formatUsdt(totalPreview)} USDT. The final amount and payment window are confirmed when your reservation is created.</p></div>
              </div>
              <div data-application-phase="3" hidden={applicationPhase !== 3} className="space-y-5">
              <SectionTitle>Source of funds</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary source *"><Select name="sourceOfFunds" options={SOURCE_OF_FUNDS} required value={sourceOfFunds} onChange={setSourceOfFunds} /></Field>
                <Field label="Whose funds? *"><Select name="fundsOwnership" options={[["own","Applicant's own"],["company","Company"],["trust","Trust"],["other","Other"]]} required /></Field>
              </div>
              <Field label={`Source-of-funds details${sourceOfFunds === "other" ? " *" : ""}`}><textarea name="sourceOfFundsDetails" required={sourceOfFunds === "other"} rows={3} className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" /></Field>
              <SectionTitle>Investor banking</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account holder *"><Input name="bankAccountHolder" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Bank *"><Input name="bankName" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Branch *"><Input name="bankBranch" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Account number *"><Input name="bankAccountNumber" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Account type *"><Input name="bankAccountType" required className="border-white/15 bg-black/20" /></Field>
                <Field label="SWIFT/BIC *"><Input name="bankSwift" required minLength={8} className="border-white/15 bg-black/20" /></Field>
              </div>
              </div>

              <div data-application-phase="4" hidden={applicationPhase !== 4} className="space-y-5">
              <SectionTitle>Identity verification</SectionTitle>
              {applicationPhase === 4 && error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-400/40 bg-red-950/50 p-4 text-sm leading-6 text-red-100"><strong className="block text-white">Verification unavailable</strong><span>{error}</span></div>}
              {diditUrl && <a href={diditUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-md bg-sky-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-200">Open secure identity verification</a>}
              {diditUrl && <iframe title="Didit identity verification" src={diditUrl} allow="camera; microphone; fullscreen; autoplay; encrypted-media" className="h-[680px] w-full rounded-xl border border-white/15 bg-white" />}

              <SectionTitle>Declarations</SectionTitle>
              <Declaration name="amlDeclarationAccepted">I confirm that the investment funds are not proceeds of crime, money laundering, or terrorist financing.</Declaration>
              <Declaration name="suitabilityDeclarationAccepted">I understand that the investment is long-term, may be illiquid, returns are not guaranteed, and I may lose the invested capital.</Declaration>
              <Declaration name="informationDeclarationAccepted">I confirm that the investor information supplied is complete and accurate and that I will provide supporting information when requested.</Declaration>
              {verificationStarted && !kycVerification?.verified && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"><strong className="block text-white">Identity verification in progress</strong>Complete or resubmit the requested steps in the secure Didit flow above. This page checks Didit&apos;s signed final decision automatically.<Button type="button" variant="outline" className="mt-3 border-amber-200/30 bg-transparent text-amber-50 hover:bg-amber-300/10" onClick={() => void refreshKycVerification().catch((reason) => setError(reason instanceof Error ? reason.message : "Identity verification status is unavailable"))}>Check verification status</Button></div>}
              </div>
              <div data-application-phase="5" hidden={applicationPhase !== 5} className="space-y-5">
              <SectionTitle>Terms and reservation</SectionTitle>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-white">Choose how you want to pay</legend>
                <label className={`block cursor-pointer rounded-xl border p-4 transition ${paymentRail === "remitano_usdt" ? "border-amber-300 bg-amber-300/10" : "border-white/15 bg-black/20"}`}>
                  <span className="flex items-start gap-3"><input name="paymentRail" type="radio" value="remitano_usdt" checked={paymentRail === "remitano_usdt"} onChange={() => setPaymentRail("remitano_usdt")} className="mt-1" required /><span><strong className="block text-white">International payment — Remitano</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Pay the locked USDT amount using the displayed blockchain network and receiving address.</span></span></span>
                </label>
                <label className={`block cursor-pointer rounded-xl border p-4 transition ${paymentRail === "webpay_card" ? "border-sky-300 bg-sky-300/10" : "border-white/15 bg-black/20"}`}>
                  <span className="flex items-start gap-3"><input name="paymentRail" type="radio" value="webpay_card" checked={paymentRail === "webpay_card"} onChange={() => setPaymentRail("webpay_card")} className="mt-1" required /><span><strong className="block text-white">Debit or credit card — WebPay</strong><span className="mt-1 block text-xs leading-5 text-slate-300">R{webPayUnitPriceZar.toFixed(2)} per paid share. Your card details are entered only on the secure WebPay checkout.</span><span className="mt-2 block font-bold text-sky-100">Total: R{(Number(quantity || 0) * webPayUnitPriceZar).toFixed(2)}</span></span></span>
                </label>
              </fieldset>
              <a href={TERMS_PDF_PATH} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-amber-200 underline underline-offset-4 hover:text-amber-100">Open the authoritative terms PDF</a>
              <div tabIndex={0} onScroll={(event) => { const node = event.currentTarget; if (node.scrollTop + node.clientHeight >= node.scrollHeight - 8) setTermsRead(true); }} className="h-[32rem] overflow-y-auto rounded-xl border border-white/15 bg-slate-100 p-2" aria-label="Investor terms document">
                {applicationPhase === 5 && TERMS_PAGE_PATHS.map((path, index) => <Image key={path} src={path} alt={`SOLIDUS Class B investor terms page ${index + 1} of ${TERMS_PAGE_PATHS.length}`} width={992} height={1403} loading={index === 0 ? "eager" : "lazy"} className="mb-2 h-auto w-full bg-white last:mb-0" />)}
              </div>
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input name="termsAccepted" type="checkbox" required disabled={!termsRead} className="mt-1" />
                <span>I accept the presale reservation acknowledgement (version {offer.termsVersion}) and understand that blockchain confirmation is payment evidence, not a Share Subscription Agreement or final share certificate.</span></label>
              {!termsRead && <p className="text-xs text-amber-200">Read and scroll through the complete terms to enable acceptance.</p>}
              </div>
              {error && applicationPhase !== 4 && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <div className="flex gap-3">
                {applicationPhase > 1 && (
                  <Button type="button" variant="outline" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setApplicationPhase((phase) => Math.max(1, phase - 1))}>
                    <ChevronLeft className="mr-1 h-4 w-4" />Back
                  </Button>
                )}
                {applicationPhase < 5 ? <Button type="button" className="flex-1 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={submitting || (applicationPhase === 4 && verificationStarted && !kycVerification?.verified)} onClick={advanceApplication}>{submitting && applicationPhase === 1 ? "Creating member profile…" : submitting && applicationPhase === 4 ? "Opening verification…" : applicationPhase === 4 && verificationStarted && !kycVerification?.verified ? "Awaiting verification" : applicationPhase === 4 && kycVerification?.status === "PENDING" ? "Resume identity verification" : applicationPhase === 4 ? "Verify ID" : "Continue"}<ChevronRight className="ml-1 h-4 w-4" /></Button> : devPreview ? <Button type="button" aria-label="Read-only preview — no reservation" className="flex-1 bg-slate-500 font-bold text-white" disabled>Preview only</Button> : <Button formNoValidate className="flex-1 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={submitting || !termsRead}>{submitting ? "Creating reservation…" : "Reserve and view payment"}</Button>}
              </div>
            </form></CardContent>
          </Card>
        ) : (
          <Card className="presale-form-card min-w-0 text-white shadow-2xl shadow-black/20">
            <CardHeader><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold leading-none">{statusLabel(order.status)}</h2><CardDescription className="mt-2 text-slate-400">{order.orderReference}</CardDescription></div>
              {order.status === "confirmed" ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <Clock3 className="h-8 w-8 text-amber-400" />}</div></CardHeader>
            <CardContent className="space-y-5">
              {order.paymentRail === "webpay_card" ? <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-4">
                <p className="text-xs uppercase tracking-wider text-sky-200">WebPay card amount</p><p className="mt-1 text-3xl font-black text-white">R{order.totalZar}</p>
                <p className="mt-1 text-sm text-sky-100/80">R{order.unitPriceZar} per paid share · bonus shares are free</p>
                <p className="mt-3 border-t border-sky-200/20 pt-3 text-sm text-sky-50">Pay before <time dateTime={order.paymentDeadline} className="font-semibold">{new Date(order.paymentDeadline).toLocaleString()}</time>.</p>
              </div> : <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-200">Send exactly</p><p className="mt-1 text-3xl font-black text-white">{order.totalUsdt} USDT</p>
                <p className="mt-1 text-sm text-amber-100/80">using {order.network} only</p>
                <p className="mt-3 border-t border-amber-200/20 pt-3 text-sm text-amber-50">Pay before <time dateTime={order.paymentDeadline} className="font-semibold">{new Date(order.paymentDeadline).toLocaleString()}</time>. Do not send funds after this deadline.</p>
              </div>}
              {order.paymentRail === "remitano_usdt" && <>
                <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-50">
                  <p className="font-semibold">The receiving address must get exactly {order.totalUsdt} USDT.</p>
                  <p className="mt-1 text-rose-100/85">Exchange withdrawal fees and network fees are additional. If your wallet deducts fees from the amount, increase the amount sent so the recipient still receives exactly {order.totalUsdt} USDT.</p>
                  <p className="mt-1 text-rose-100/85">Send USDT on {order.network} only. Do not send BNB or another token, even if it uses the same network.</p>
                </div>
                <div><p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Receiving address</p><div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 p-3 text-xs text-slate-200">{order.receivingAddress}</code>
                  <Button type="button" variant="outline" size="icon" onClick={copyAddress} aria-label="Copy receiving address"><Copy className="h-4 w-4" /></Button></div>{copied && <p className="mt-1 text-xs text-emerald-300">Address copied</p>}</div>
                {order.tokenContract && <div><p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Verified USDT contract</p><code className="break-all text-xs text-slate-300">{order.tokenContract}</code></div>}
              </>}
              {order.status === "confirmed" ? (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Payment has reached {order.confirmations} confirmations. Your order is secured and ready for the next processing step.</div>
              ) : order.paymentRail === "webpay_card" ? (
                <div className="space-y-3"><div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100">Your reservation is locked to WebPay. You will enter card details only on WebPay&apos;s secure hosted checkout.</div>{error && <p className="text-sm text-red-300">{error}</p>}<Button type="button" className="w-full bg-sky-300 font-bold text-slate-950 hover:bg-sky-200" disabled={submitting} onClick={() => void startWebPayCheckout()}>{submitting ? "Opening WebPay…" : "Continue to secure WebPay checkout"}</Button></div>
              ) : (
                <form className="space-y-3" onSubmit={submitProof}><Field label="Transaction hash"><Input value={txHash} onChange={(event) => setTxHash(event.target.value)} required minLength={16} placeholder="Paste the blockchain transaction hash" className="border-white/15 bg-black/20" /></Field>
                  {error && <p className="text-sm text-red-300">{error}</p>}<Button className="w-full" disabled={submitting}>{submitting ? "Submitting…" : "Submit transaction for confirmation"}</Button></form>
              )}
              {order.transactionHash && <div className="text-xs text-slate-400">Confirmations: {order.confirmations}/{order.minConfirmations}<br /><span className="break-all">{order.transactionHash}</span></div>}
              <p className="text-xs leading-5 text-slate-500">Never send assets on another network. A transaction hash is not accepted as settled until the configured blockchain verifier confirms the receiver, token contract, amount, and confirmation depth.</p>
            </CardContent>
          </Card>
        )}
      </div>
      {accountNotice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" role="dialog" aria-modal="true" aria-labelledby="account-email-title"><div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-slate-950 p-6 text-white shadow-2xl"><CheckCircle2 className="h-9 w-9 text-emerald-400" /><h2 id="account-email-title" className="mt-4 text-xl font-bold">Shareholder profile created</h2><p className="mt-3 text-sm leading-6 text-slate-300">An email has been sent to you with your shareholder login details if you need to continue the process.</p><p className="mt-2 text-xs leading-5 text-slate-500">For your security, the email contains the login link and account identity, never your password.</p><Button type="button" className="mt-6 w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => setAccountNotice(false)}>Continue application</Button></div></div>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="presale-shell min-h-screen px-5 py-6 sm:px-6 sm:py-8 lg:px-8"><div className="presale-header mx-auto mb-10 flex w-full max-w-6xl items-center justify-between gap-4 sm:mb-12"><Link href="/" className="relative block h-[76px] w-[134px] sm:h-[92px] sm:w-[162px]" aria-label="KaSiShares home"><Image src="/kasishares-logo.png" alt="KaSiShares — Own. Grow. Prosper. Together." fill sizes="(max-width: 640px) 134px, 162px" className="object-contain object-left" priority /></Link><div className="flex items-center gap-3"><Link href="/shares/account" aria-label="Log in to your KaSiShares profile and continue your application" className="rounded-md border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-300/10">Share profile login</Link><div className="hidden items-center gap-2 text-xs text-slate-300 sm:flex"><WalletCards className="h-4 w-4" /> USDT settlement</div></div></div><div className="mx-auto flex w-full max-w-6xl justify-center">{children}</div></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="presale-metric rounded-xl p-4"><p className="text-xs uppercase tracking-wider">{label}</p><p className="mt-2 font-bold text-white">{value}</p></div>;
}

function ApplicationProgress({ phase }: { phase: number }) {
  return <ol aria-label="Investor application progress" className="grid grid-cols-5 gap-1.5">{APPLICATION_PHASES.map((item, index) => {
    const current = index + 1 === phase;
    const complete = index + 1 < phase;
    const Icon = item.icon;
    return <li key={item.title} className="min-w-0"><div className={`flex h-9 items-center justify-center rounded-lg border ${current ? "presale-step-active text-slate-950" : complete ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/10 bg-black/20 text-slate-500"}`}><Icon className="h-4 w-4" /><span className="sr-only">{item.title}{current ? ", current step" : complete ? ", complete" : ""}</span></div><p className={`mt-1 truncate text-center text-[9px] font-semibold uppercase tracking-wide ${current ? "text-amber-200" : "text-slate-500"}`}>{index + 1}</p></li>;
  })}</ol>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium text-slate-200"><span>{label}</span>{children}</label>;
}

const SOURCE_OF_FUNDS: Array<[string, string]> = [
  ["salary", "Salary"], ["business", "Business income"], ["investment", "Investment proceeds"],
  ["property_sale", "Property sale"], ["inheritance", "Inheritance"], ["pension", "Pension"],
  ["savings", "Savings"], ["company", "Company funds"], ["trust", "Trust funds"], ["other", "Other"],
];

function Select({ name, options, required, value, onChange }: { name: string; options: Array<[string, string]>; required?: boolean; value?: string; onChange?: (value: string) => void }) {
  return <select name={name} required={required} value={value} defaultValue={value === undefined ? "" : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="h-10 w-full rounded-md border border-white/15 bg-[#111a18] px-3 text-sm text-white"><option value="" disabled>Select…</option>{options.map(([optionValue,label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-t border-white/10 pt-5 text-sm font-bold uppercase tracking-wider text-amber-300">{children}</h3>;
}

function Declaration({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input name={name} type="checkbox" required className="mt-1" /><span>{children}</span></label>;
}
