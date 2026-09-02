"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, Download, FileCheck2, Layers3, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CryptoVerificationProgress } from "@/components/presale/crypto-verification-progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  allowsApplicantAction,
  applicantJourneyPresentation,
  readApplicantAuthority,
  type ApplicantAuthority,
  type PresaleReservationContract,
} from "@/lib/applicant-portal-contract";

type Portal = {
  applicant: { profileNumber: string; email: string };
  application: null | { applicationNumber: string; campaignName: string; status: string; phaseCompleted: number; completionPercent: number; nextStep: number; resumeUrl: string | null };
  kyc: { status: string; verified: boolean };
  order: null | {
    orderReference: string; status: string; incorporationStatus: string; paymentRail: "remitano_usdt" | "webpay_card";
    quantity: number; totalUsdt: string; paymentNetwork?: string; paymentMinConfirmations?: number;
    transactionHash?: string; paymentVerificationStatus?: string; paymentVerificationReason?: string;
    paymentVerificationCheckedAt?: string; paymentConfirmations?: number;
    webPayProcessStatus?: string; webPayProcessStage?: string;
  };
  shareholder?: {
    totalIssuedShares: number;
    holdings: Array<{
      orderReference: string; campaignName: string; paidShares: number; bonusShares: number; allocatedShares: number;
      status: "awaiting_issuance" | "issued" | "revoked" | "issuance_error"; incorporationStatus: string;
      certificate?: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt?: string };
    }>;
  };
  testInviteUrl?: string;
  continuation?: {
    nextStep: number | null;
    reason: "resume" | "resume_credential_unavailable" | "no_application" | "invitation_unavailable" | "application_not_editable" | "reservation_in_progress" | "signup_complete";
    resumeUrl: string | null;
  };
  journey?: unknown;
  reservation?: unknown;
  authority: ApplicantAuthority;
};

const SIGNUP_STEPS = [
  "Applicant profile",
  "Investment selection",
  "Funding details",
  "Identity verification",
  "Terms and reservation",
] as const;

export function SharesAccountClient() {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [recheckingPayment, setRecheckingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");

  const loadPortal = useCallback(async () => {
    const response = await fetch("/api/presale/portal", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) { setPortal(null); return; }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Applicant status is unavailable");
    const authority = readApplicantAuthority(body);
    setPortal({ ...body, authority });
    if (authority.journey.state !== "awaiting_payment") setConfirmingPayment(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortal().catch((reason) => setError(reason.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortal]);

  useEffect(() => {
    if (!portal?.authority.available || portal.authority.reservation?.paymentMethod !== "webpay_card" || portal.authority.journey.state !== "awaiting_payment") return;
    const returnState = new URLSearchParams(window.location.search).get("payment");
    if (returnState !== "webpay" && returnState !== "cancelled") return;
    const startTimer = returnState === "webpay" ? window.setTimeout(() => setConfirmingPayment(true), 0) : undefined;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      void loadPortal().catch((reason) => setError(reason.message));
      if (attempts >= 15) {
        window.clearInterval(interval);
        setConfirmingPayment(false);
      }
    }, 2_000);
    return () => {
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [loadPortal, portal?.authority.available, portal?.authority.journey.state, portal?.authority.reservation?.paymentMethod]);

  useEffect(() => {
    if (!portal?.authority.available || !["payment", "incorporation"].includes(portal.authority.journey.polling)) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadPortal().catch((reason) => setError(reason.message));
    };
    const interval = window.setInterval(refresh, 5_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadPortal, portal?.authority.available, portal?.authority.journey.polling]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/presale/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Login failed"); return; }
    await loadPortal();
  }

  async function logout() {
    await fetch("/api/presale/auth/logout", { method: "POST" });
    setPortal(null);
  }

  async function cancelReservation(orderReference: string) {
    setError("");
    const response = await fetch(`/api/presale/orders/${encodeURIComponent(orderReference)}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgeNoPaymentSent: true }),
    });
    const body = await response.json();
    if (!response.ok) {
      await loadPortal().catch(() => undefined);
      setError(body.error ?? "The reservation could not be cancelled. Your account status has been refreshed.");
      return;
    }
    await loadPortal();
  }

  async function recheckPayment(orderReference: string) {
    setError("");
    setPaymentNotice("");
    setRecheckingPayment(true);
    try {
      const response = await fetch(`/api/presale/orders/${encodeURIComponent(orderReference)}/payment-recheck`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Payment verification is temporarily unavailable");
      setPaymentNotice(body.status === "settled"
        ? "Payment verified. Share issuance has started; this page will update when the certificate is ready."
        : paymentStatusMessage(body.status, body.reason));
      await loadPortal();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment verification is temporarily unavailable");
      await loadPortal().catch(() => undefined);
    } finally {
      setRecheckingPayment(false);
    }
  }

  return <main className="presale-shell min-h-screen px-5 py-8 text-white">
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="relative h-[76px] w-[134px]"><Image src="/kasishares-logo.png" alt="KaSiShares home" fill sizes="134px" className="object-contain object-left" priority /></Link>
        {portal ? <Button variant="outline" onClick={() => void logout()} className="border-white/20 bg-transparent text-white"><LogOut className="mr-2 h-4 w-4" />Sign out</Button> : null}
      </header>
      {loading ? <p className="text-slate-300">Loading applicant account…</p> : portal ? <PortalView portal={portal} error={error} confirmingPayment={confirmingPayment} recheckingPayment={recheckingPayment} paymentNotice={paymentNotice} onCancel={cancelReservation} onRecheck={recheckPayment} /> : <LoginForm error={error} onSubmit={login} />}
    </div>
  </main>;
}

function LoginForm({ error, onSubmit }: { error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#0f2744] p-7 shadow-2xl">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Separate applicant access</p>
    <h1 className="mt-3 text-3xl font-black">KaSiShares account</h1>
    <p className="mt-3 text-sm leading-6 text-slate-300">Sign in with the account created during Step 1. This space is separate from the normal KaSiHub member dashboard.</p>
    <form onSubmit={onSubmit} className="mt-7 space-y-5">
      <label className="block text-sm">Email address<Input name="email" type="email" required pattern="[^\s@]+@[^\s@]+\.[^\s@]+" title="Enter a complete email address, including the domain ending" autoComplete="email" className="mt-2 border-white/15 bg-black/20" /></label>
      <label className="block text-sm">Password<Input name="password" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="current-password" className="mt-2 border-white/15 bg-black/20" /></label>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-amber-400" />
        Show password
      </label>
      <Link href="/reset-password" className="inline-block text-sm font-semibold text-amber-200 hover:text-amber-100">Forgot password?</Link>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <Button className="w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">Sign in to KaSiShares</Button>
    </form>
  </section>;
}

function PortalView({ portal, error, confirmingPayment, recheckingPayment, paymentNotice, onCancel, onRecheck }: {
  portal: Portal; error: string; confirmingPayment: boolean; recheckingPayment: boolean; paymentNotice: string;
  onCancel: (orderReference: string) => Promise<void>; onRecheck: (orderReference: string) => Promise<void>;
}) {
  const shareholder = portal.shareholder ?? { totalIssuedShares: 0, holdings: [] };
  const isShareholder = shareholder.totalIssuedShares > 0;
  const journey = applicantJourneyPresentation(portal.authority.journey);
  const reservation = portal.authority.reservation;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">{isShareholder ? "Shareholder account" : "Applicant account"}</p><h1 className="mt-2 text-3xl font-black">Welcome back</h1><p className="mt-2 text-slate-300">{portal.applicant.email} · {portal.applicant.profileNumber}</p></div>
    <div className="grid gap-5 md:grid-cols-3">
      <StatusCard title="Application" value={portal.application ? `Step ${portal.application.nextStep} of 5` : "Not started"} detail={portal.application?.applicationNumber ?? "No application record"} complete={Boolean(portal.application && portal.application.phaseCompleted >= 4 && portal.kyc.verified)} />
      <StatusCard title="Identity verification" value={portal.kyc.verified ? "Verified" : portal.kyc.status} detail="ID, liveness and face match" complete={portal.kyc.verified} />
      <StatusCard title="Applicant journey" value={confirmingPayment ? "Confirming WebPay notification" : journey.label} detail={reservation?.orderReference ?? journey.detail} complete={journey.complete} attention={journey.attention} />
    </div>
    {!portal.authority.available ? <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100"><strong className="block text-white">Applicant controls are safely locked</strong>The server authority contract is unavailable or incomplete. No payment, cancellation, or continuation action has been enabled.</p> : null}
    {portal.order?.webPayProcessStatus && ["FAILED", "REJECTED", "EXPIRED", "REVERSED"].includes(portal.order.webPayProcessStatus) ? <p role="status" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">The last WebPay attempt was {portal.order.webPayProcessStatus.toLowerCase()}. No successful card payment was recorded and no shares were allocated.</p> : null}
    {confirmingPayment ? <p role="status" className="rounded-xl border border-sky-300/30 bg-sky-400/10 p-4 text-sm text-sky-100">WebPay returned successfully. We are waiting for the signed payment notification before confirming your shares.</p> : null}
    {portal.order?.paymentRail === "remitano_usdt" && reservation && allowsApplicantAction(portal.authority, "recheck_payment") ? <CryptoPaymentRecovery order={portal.order} reservation={reservation} journeyState={portal.authority.journey.state} rechecking={recheckingPayment} notice={paymentNotice} onRecheck={onRecheck} /> : null}
    {shareholder.holdings.length > 0 ? <ShareholderPortfolio shareholder={shareholder} /> : null}
    <ContinuationPanel portal={portal} error={error} onCancel={onCancel} />
    <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" />KaSiShares access remains separate. Normal dashboard and matrix access require an activated membership subscription.</p>
  </div>;
}

type PortalOrder = NonNullable<Portal["order"]>;

function paymentStatusMessage(status?: string, reason?: string): string {
  if (status === "pending_confirmations") return "The transfer was found and is waiting for the required blockchain confirmations.";
  if (status === "manual_review") return "The transfer was found but needs a controlled review before shares can be issued.";
  if (status === "underpaid") return "The transfer was found, but the verified amount is below the reserved amount. Support must review it.";
  if (status === "rejected") return "The submitted transaction does not match the reservation and was rejected.";
  if (reason === "chain_provider_unavailable") return "The blockchain verifier is temporarily unavailable. Your hash is saved and automatic retries remain active.";
  if (reason?.includes("custody") || reason?.includes("provider")) return "Blockchain verification passed. Remitano credit confirmation is still pending; your hash is saved and automatic retries remain active.";
  return "Verification is still pending. Your submitted hash is saved and automatic retries remain active.";
}

function CryptoPaymentRecovery({ order, reservation, journeyState, rechecking, notice, onRecheck }: {
  order: PortalOrder; reservation: PresaleReservationContract; journeyState: ApplicantAuthority["journey"]["state"]; rechecking: boolean; notice: string; onRecheck: (orderReference: string) => Promise<void>;
}) {
  const statusMessage = paymentStatusMessage(order.paymentVerificationStatus, order.paymentVerificationReason);
  return <section className="rounded-2xl border border-amber-300/30 bg-[#0f2744] p-7" aria-labelledby="crypto-payment-heading">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Crypto payment recovery</p>
        <h2 id="crypto-payment-heading" className="mt-2 text-2xl font-black">Your share choice is preserved</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{reservation.paidShares.toLocaleString()} paid {reservation.paidShares === 1 ? "share is" : "shares are"} reserved for {reservation.totalUsdt} USDT. A second purchase form is intentionally locked while this payment is verified.</p>
      </div>
      <Button type="button" disabled={rechecking || !order.transactionHash} onClick={() => void onRecheck(reservation.orderReference)} className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60">
        {rechecking ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {rechecking ? "Checking payment…" : "Recheck payment"}
      </Button>
    </div>
    <div className="mt-6"><CryptoVerificationProgress journeyState={journeyState} transactionHash={order.transactionHash} confirmations={order.paymentConfirmations} requiredConfirmations={order.paymentMinConfirmations ?? reservation.requiredConfirmations} verificationReason={order.paymentVerificationReason} /></div>
    <dl className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-black/15 p-5 sm:grid-cols-2">
      <div><dt className="text-xs uppercase tracking-wider text-slate-400">Transaction hash</dt><dd className="mt-2 break-all font-mono text-sm text-slate-100">{order.transactionHash ?? "No hash has been submitted"}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-slate-400">Verification</dt><dd className="mt-2 text-sm font-semibold text-amber-100">{order.paymentVerificationStatus ?? "submitted"}{typeof order.paymentConfirmations === "number" ? ` · ${order.paymentConfirmations}/${order.paymentMinConfirmations ?? "required"} confirmations` : ""}</dd></div>
    </dl>
    <p role="status" className="mt-4 rounded-lg border border-sky-300/30 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100">{notice || statusMessage}</p>
  </section>;
}

type Shareholder = NonNullable<Portal["shareholder"]>;

function ShareholderPortfolio({ shareholder }: { shareholder: Shareholder }) {
  return <section className="rounded-2xl border border-amber-300/20 bg-[#0f2744] p-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Shareholder dashboard</p><h2 className="mt-2 text-2xl font-black">Your KaSiShares</h2><p className="mt-2 text-sm text-slate-300">Campaign allocations and certificates are read directly from the authoritative share register.</p></div>
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-3 text-right"><p className="text-xs uppercase tracking-wider text-emerald-200">Issued shares</p><p className="text-2xl font-black text-white">{shareholder.totalIssuedShares.toLocaleString()}</p></div>
    </div>
    <div className="mt-6 grid gap-4">
      {shareholder.holdings.map((holding) => <article key={holding.orderReference} className="rounded-xl border border-white/10 bg-black/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs uppercase tracking-wider text-slate-400">Campaign</p><h3 className="mt-1 text-xl font-bold">{holding.campaignName}</h3><p className="mt-1 text-xs text-slate-400">{holding.orderReference}</p></div>
          <HoldingStatus status={holding.status} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <AllocationMetric label="Paid shares" value={holding.paidShares} icon={Layers3} />
          <AllocationMetric label="Bonus shares" value={holding.bonusShares} icon={Layers3} />
          <AllocationMetric label="Campaign allocation" value={holding.allocatedShares} icon={FileCheck2} />
        </div>
        {holding.certificate ? <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
          <div><p className="text-xs uppercase tracking-wider text-slate-400">Certificate</p><p className="mt-1 font-semibold">{holding.certificate.certificateNumber}</p><p className="mt-1 text-xs text-slate-400">Issued {new Date(holding.certificate.issuedAt).toLocaleDateString("en-ZA")}</p></div>
          <Button asChild className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"><a href={`/api/presale/certificates/${encodeURIComponent(holding.certificate.certificateNumber)}`}><Download className="mr-2 h-4 w-4" />Download certificate</a></Button>
        </div> : <p className={`mt-5 rounded-lg border p-3 text-sm ${holding.status === "issuance_error" ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : "border-sky-300/30 bg-sky-400/10 text-sky-100"}`}>{holding.status === "issuance_error" ? "The order is marked incorporated but its certificate record is missing. Support has to reconcile this issuance." : "Payment is confirmed. Certificate issuance is pending the controlled incorporation of this campaign allocation."}</p>}
      </article>)}
    </div>
  </section>;
}

function HoldingStatus({ status }: { status: Shareholder["holdings"][number]["status"] }) {
  const labels = { awaiting_issuance: "Issuance pending", issued: "Certificate issued", revoked: "Certificate revoked", issuance_error: "Reconciliation required" };
  const issued = status === "issued";
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${issued ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-100"}`}>{issued ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{labels[status]}</span>;
}

function AllocationMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Layers3 }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><Icon className="h-4 w-4 text-amber-300" /><p className="mt-2 text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-bold">{value.toLocaleString()}</p></div>;
}

function ContinuationPanel({ portal, error, onCancel }: { portal: Portal; error: string; onCancel: (orderReference: string) => Promise<void> }) {
  const continuation = portal.continuation ?? {
    nextStep: portal.application?.nextStep ?? null,
    reason: portal.application
      ? portal.application.resumeUrl ? "resume" as const : "resume_credential_unavailable" as const
      : "no_application" as const,
    resumeUrl: portal.application?.resumeUrl ?? null,
  };
  const stepName = continuation.nextStep ? SIGNUP_STEPS[continuation.nextStep - 1] : null;
  const canUseTestInvitation = Boolean(portal.testInviteUrl && (
    continuation.reason === "no_application" || continuation.reason === "resume_credential_unavailable"
  ));
  const canResume = allowsApplicantAction(portal.authority, "resume_application") || allowsApplicantAction(portal.authority, "resume_kyc");
  const reservation = portal.authority.reservation;
  const canCancel = Boolean(
    reservation?.cancellation.eligible
    && allowsApplicantAction(portal.authority, "cancel_reservation"),
  );
  const content = ({
    resume: {
      title: "Continue signup",
      detail: `Your first unfinished step is Step ${continuation.nextStep}: ${stepName}. Saved applicant-profile details will be restored.`,
    },
    resume_credential_unavailable: {
      title: "Signup continuation unavailable",
      detail: `Your next step is ${stepName ?? "not available"}, but the secure continuation credential is missing. Contact KaSiHub support; do not create another applicant account.`,
    },
    no_application: {
      title: "No application to continue",
      detail: "This applicant account has no active KaSiShares application. A private invitation is still required to begin.",
    },
    invitation_unavailable: {
      title: "Private access is no longer available",
      detail: "The invitation or campaign is no longer active, so signup cannot continue. Contact KaSiHub support if you believe access should still be open.",
    },
    application_not_editable: {
      title: "Application cannot be resumed online",
      detail: "This application has left the editable signup stage. Its current status is shown above; contact KaSiHub support if more information was requested.",
    },
    reservation_in_progress: {
      title: "Signup steps complete",
      detail: "A reservation already exists, so another signup path is not opened. Its current status is shown in the Reservation card above.",
    },
    signup_complete: {
      title: "Signup complete",
      detail: "There is no unfinished signup step. Your confirmed reservation status is shown above.",
    },
  } as const)[continuation.reason];

  return <section className="rounded-2xl border border-white/10 bg-[#0f2744] p-7">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-2xl">
        <p className="text-sm text-slate-400">{portal.application?.campaignName ?? "Private KaSiShares application"}</p>
        <h2 className="mt-1 text-2xl font-bold">{content.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{content.detail}</p>
      </div>
      {continuation.reason === "resume" && continuation.resumeUrl && canResume ? <Button asChild className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">
        <Link href={continuation.resumeUrl}>Continue signup</Link>
      </Button> : canCancel && reservation ? <CancelReservationDialog reservation={reservation} onCancel={onCancel} /> : canUseTestInvitation && allowsApplicantAction(portal.authority, "start_with_invitation") ? <Button asChild className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">
        <Link href={portal.testInviteUrl!}>Open test invitation</Link>
      </Button> : null}
    </div>
    {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
    {portal.application ? <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800" aria-label={`${portal.application.completionPercent}% of signup milestones saved`}>
      <div className="h-full bg-amber-400" style={{ width: `${portal.application.completionPercent}%` }} />
    </div> : null}
  </section>;
}

function CancelReservationDialog({ reservation, onCancel }: { reservation: PresaleReservationContract; onCancel: (orderReference: string) => Promise<void> }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button type="button" variant="outline" className="border-rose-300/50 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20">Cancel unpaid reservation &amp; change payment method</Button></AlertDialogTrigger>
    <AlertDialogContent className="border-rose-300/30 bg-slate-950 text-white">
      <AlertDialogHeader>
        <AlertDialogTitle>Release reservation {reservation.orderReference}?</AlertDialogTitle>
        <AlertDialogDescription className="leading-6 text-slate-300">Confirm only if no card payment or crypto transfer has been sent. Cancelling releases {reservation.totalAllocatedShares.toLocaleString()} allocated shares and cannot be undone from this screen.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="border-white/20 bg-transparent text-white hover:bg-white/10">Keep reservation</AlertDialogCancel>
        <AlertDialogAction className="bg-rose-500 font-bold text-white hover:bg-rose-400" onClick={() => void onCancel(reservation.orderReference)}>I have not paid — release it</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function StatusCard({ title, value, detail, complete, attention = false }: { title: string; value: string; detail: string; complete: boolean; attention?: boolean }) {
  const Icon = complete ? CheckCircle2 : Clock3;
  const color = complete ? "text-emerald-400" : attention ? "text-rose-300" : "text-amber-300";
  return <div className="rounded-2xl border border-white/10 bg-[#0f2744] p-5"><Icon className={`h-6 w-6 ${color}`} /><p className="mt-4 text-xs uppercase tracking-wider text-slate-400">{title}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></div>;
}
