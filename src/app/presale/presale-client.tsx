"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Copy, FileCheck2, Landmark, LockKeyhole, ShieldCheck, Upload, UserRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRESALE_DEV_PREVIEW_OFFER, type PresaleDevPreviewOffer } from "@/lib/presale-dev-preview";

type Offer = PresaleDevPreviewOffer & {
  invitationEmail?: string;
};

type Order = {
  orderReference: string;
  campaign: string;
  issuerName: string;
  shareClass: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
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

const APPLICATION_PHASES = [
  { title: "Application details", description: "Applicant identity, contact and ownership details", icon: UserRound },
  { title: "Choose your investment", description: "Allocation and live server quote", icon: Landmark },
  { title: "Funding details", description: "Source of funds and investor banking", icon: WalletCards },
  { title: "Identity evidence", description: "Secure ID, selfie and declarations", icon: FileCheck2 },
  { title: "Terms and reserve", description: "Read and accept the terms before reservation", icon: ShieldCheck },
] as const;

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
  const [applicantType, setApplicantType] = useState<"individual" | "company" | "trust">("individual");
  const [termsRead, setTermsRead] = useState(false);
  const [documentsUploaded, setDocumentsUploaded] = useState(false);

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

  useEffect(() => {
    if (!order || !accessToken || ["confirmed", "expired", "cancelled", "incorporated"].includes(order.status)) return;
    const timer = window.setInterval(() => { void refreshOrder(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [accessToken, order, refreshOrder]);

  const totalPreview = offer ? Number(offer.priceUsdt) : 0;

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (devPreview) return;
    if (!offer) return;
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get("quantity"));
    try {
      const response = await fetch("/api/presale/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          inviteToken,
          buyerName: data.get("buyerName"),
          buyerEmail: data.get("buyerEmail"),
          buyerPhone: data.get("buyerPhone") || undefined,
          quantity,
          termsAccepted: data.get("termsAccepted") === "on",
          investorApplication: {
            applicantType: data.get("applicantType"),
            dateOfBirth: data.get("dateOfBirth") || undefined,
            nationality: data.get("nationality") || undefined,
            occupation: data.get("occupation") || undefined,
            employer: data.get("employer") || undefined,
            countryOfResidence: data.get("countryOfResidence") || undefined,
            physicalAddress: data.get("physicalAddress") || undefined,
            confirmMobileNumber: data.get("confirmMobileNumber") || undefined,
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

  async function uploadIdentityEvidence(form: HTMLFormElement) {
    if (documentsUploaded || devPreview) return;
    const data = new FormData(form);
    const files = [
      ["identity_document", data.get("identityDocument")],
      ["identity_selfie", data.get("identitySelfie")],
    ] as const;
    for (const [documentType, file] of files) {
      if (!(file instanceof File) || file.size === 0) throw new Error("Select both your ID document and selfie");
      const upload = new FormData();
      upload.set("documentType", documentType);
      upload.set("file", file);
      const response = await fetch("/api/presale/kyc-documents", { method: "POST", body: upload });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Identity evidence could not be uploaded");
    }
    setDocumentsUploaded(true);
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
    if (applicationPhase === 4) {
      setSubmitting(true);
      setError("");
      try {
        await uploadIdentityEvidence(form);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Identity evidence could not be uploaded");
        return;
      } finally {
        setSubmitting(false);
      }
    }
    setApplicationPhase((phase) => Math.min(5, phase + 1));
  }

  if (loading) return <Shell><p className="text-sm text-slate-400">Validating private invitation…</p></Shell>;
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
            <p className="presale-lede mt-4 max-w-2xl text-lg leading-8">Own a stake in the ecosystem we are building together. Review the server-issued private allocation terms before any payment is made.</p>
          </div>
          <div className="presale-motifs" aria-label="Own, grow, prosper, better together">
            {(["own", "grow", "prosper", "better"] as const).map((value) => (
              <Image key={value} src={`/kasishares-${value}.png`} alt={`${value[0].toUpperCase()}${value.slice(1)}.`} width={180} height={180} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Price per paid share" value={`$${Number(offer.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Metric label="Server USDT quote" value={`${Number(offer.priceUsdt).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDT`} />
            <Metric label="Your allocation" value={`${offer.invitationSharesRemaining.toLocaleString()} shares`} />
            <Metric label="Network" value={offer.network} />
          </div>
          <div className="presale-assurance rounded-2xl p-5 text-sm leading-6">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white"><ShieldCheck className="h-4 w-4" /> Clean separation by design</div>
            Campaign reservations remain isolated from the live share ledger. Payment evidence is verified by the central payment engine, and only settled orders may enter controlled share incorporation; this page does not issue a final share certificate.
          </div>
          {devPreview && <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-5 text-sm leading-6 text-sky-100"><strong className="text-white">Read-only local preview.</strong> This fixture has no campaign, invitation, payment route, receiving address, token contract, reservation, or backend request.</div>}
        </section>

        {!order ? (
          <Card className="presale-form-card min-w-0 text-white shadow-2xl shadow-black/20">
            <CardHeader><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Investor application</p><h2 className="mt-2 font-semibold leading-none">{APPLICATION_PHASES[applicationPhase - 1].title}</h2><CardDescription className="text-slate-400">Step {applicationPhase} of 5 · {APPLICATION_PHASES[applicationPhase - 1].description}</CardDescription></CardHeader>
            <CardContent><form className="space-y-5" noValidate onSubmit={createOrder}>
              <ApplicationProgress phase={applicationPhase} />
              <div data-application-phase="1" hidden={applicationPhase !== 1} className="space-y-5">
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-xs leading-5 text-sky-100">
                <strong className="block text-sm text-white">Identity and KYC source</strong>
                All marked fields are compulsory. Identity evidence is still verified through the server-selected KYC authority and is never accepted from browser claims alone.
              </div>
              <Field label="Full legal name"><Input name="buyerName" required minLength={2} className="border-white/15 bg-black/20" /></Field>
              <Field label="Email address"><Input name="buyerEmail" type="email" required defaultValue={offer.invitationEmail} readOnly={Boolean(offer.invitationEmail)} className="border-white/15 bg-black/20" /></Field>
              <Field label="Cellphone number *"><Input name="buyerPhone" required className="border-white/15 bg-black/20" /></Field>
              <Field label="Confirm cellphone number *"><Input name="confirmMobileNumber" required className="border-white/15 bg-black/20" /></Field>
              <SectionTitle>Investor identity</SectionTitle>
              <Field label="Application type *"><select name="applicantType" required value={applicantType} onChange={(event) => setApplicantType(event.target.value as typeof applicantType)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-sm"><option value="individual">Individual application</option><option value="company">Company application</option><option value="trust">Trust application</option></select></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth (individual)"><Input name="dateOfBirth" type="date" className="border-white/15 bg-black/20" /></Field>
                <Field label="Nationality *"><Input name="nationality" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Country of residence *"><Input name="countryOfResidence" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Occupation *"><Input name="occupation" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Employer *"><Input name="employer" required className="border-white/15 bg-black/20" /></Field>
                <Field label="Tax number *"><Input name="taxNumber" required className="border-white/15 bg-black/20" /></Field>
              </div>
              <Field label="Physical address *"><textarea name="physicalAddress" required rows={2} className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" /></Field>
              {applicantType !== "individual" && <div className="grid gap-4 sm:grid-cols-2"><Field label={`${applicantType === "company" ? "Company" : "Trust"} registration number *`}><Input name="entityRegistrationNumber" required className="border-white/15 bg-black/20" /></Field>{applicantType === "company" && <Field label="VAT number *"><Input name="vatNumber" required className="border-white/15 bg-black/20" /></Field>}<Field label="Authorised representative *"><Input name="authorisedRepresentativeName" required className="border-white/15 bg-black/20" /></Field><Field label="Representative position *"><Input name="authorisedRepresentativePosition" required className="border-white/15 bg-black/20" /></Field></div>}
              </div>
              <div data-application-phase="2" hidden={applicationPhase !== 2} className="space-y-5">
              <SectionTitle>Investment</SectionTitle>
              <Field label="Phase 1 shares at $25 each *"><Input name="quantity" type="number" required min={1} max={Math.min(300, offer.invitationSharesRemaining, offer.sharesRemaining)} defaultValue={1} className="border-white/15 bg-black/20" /></Field>
              <p className="text-xs text-emerald-200">Phase 1 is capped at 300 paid shares per application. Each paid share receives one bonus share free.</p>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><p className="font-semibold text-white">Server-authoritative quote</p><p className="mt-1">The current server quote is {totalPreview.toFixed(6)} USDT per paid share. Your final amount and payment window are locked only when the reservation is created.</p></div>
              </div>
              <div data-application-phase="3" hidden={applicationPhase !== 3} className="space-y-5">
              <SectionTitle>Source of funds</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary source"><Select name="sourceOfFunds" options={SOURCE_OF_FUNDS} /></Field>
                <Field label="Whose funds?"><Select name="fundsOwnership" options={[["own","Applicant's own"],["company","Company"],["trust","Trust"],["other","Other"]]} /></Field>
              </div>
              <Field label="Source-of-funds details"><textarea name="sourceOfFundsDetails" rows={3} className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" /></Field>
              <SectionTitle>Investor banking</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account holder"><Input name="bankAccountHolder" className="border-white/15 bg-black/20" /></Field>
                <Field label="Bank"><Input name="bankName" className="border-white/15 bg-black/20" /></Field>
                <Field label="Branch"><Input name="bankBranch" className="border-white/15 bg-black/20" /></Field>
                <Field label="Account number"><Input name="bankAccountNumber" className="border-white/15 bg-black/20" /></Field>
                <Field label="Account type"><Input name="bankAccountType" className="border-white/15 bg-black/20" /></Field>
                <Field label="SWIFT/BIC"><Input name="bankSwift" className="border-white/15 bg-black/20" /></Field>
              </div>
              </div>

              <div data-application-phase="4" hidden={applicationPhase !== 4} className="space-y-5">
              <SectionTitle>Identity documents</SectionTitle>
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100"><div className="flex gap-3"><Upload className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" /><p>{devPreview ? "Preview mode validates your file selections locally and does not send or retain them." : "Files are sent directly to KaSiHub's private compliance store. PDF, JPEG and PNG are accepted, up to 10 MB per file."}</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <UploadField label="ID document or passport *" name="identityDocument" accept="application/pdf,image/jpeg,image/png" hint="PDF, JPG or PNG · max 10 MB" onChange={() => setDocumentsUploaded(false)} />
                <UploadField label="Selfie holding your ID *" name="identitySelfie" accept="image/jpeg,image/png" hint="JPG or PNG · max 10 MB" onChange={() => setDocumentsUploaded(false)} />
              </div>
              {documentsUploaded && <p className="text-xs font-medium text-emerald-300">Identity evidence uploaded securely.</p>}

              <SectionTitle>Declarations</SectionTitle>
              <Declaration name="amlDeclarationAccepted">I confirm that the investment funds are not proceeds of crime, money laundering, or terrorist financing.</Declaration>
              <Declaration name="suitabilityDeclarationAccepted">I understand that the investment is long-term, may be illiquid, returns are not guaranteed, and I may lose the invested capital.</Declaration>
              <Declaration name="informationDeclarationAccepted">I confirm that the investor information supplied is complete and accurate and that I will provide supporting information when requested.</Declaration>
              </div>
              <div data-application-phase="5" hidden={applicationPhase !== 5} className="space-y-5">
              <SectionTitle>Terms and reservation</SectionTitle>
              <div tabIndex={0} onScroll={(event) => { const node = event.currentTarget; if (node.scrollTop + node.clientHeight >= node.scrollHeight - 8) setTermsRead(true); }} className="h-56 overflow-y-auto rounded-xl border border-white/15 bg-black/30 p-4 text-xs leading-6 text-slate-300" aria-label="Investor terms"><p className="font-semibold text-white">Class B Share Offering — Investor Terms</p><p className="mt-3">You are applying for a private Phase 1 allocation at USD 25 per paid share, subject to the server-issued invitation, eligibility, KYC and compliance approval, available allocation and the governing offering documents.</p><p className="mt-3">The buy-one-get-one bonus applies only to Phase 1 and does not alter the rights attached to the paid or bonus shares. A reservation is not final incorporation, a share certificate, guaranteed liquidity or guaranteed return.</p><p className="mt-3">USDT payment must be sent only to the exact server-issued Remitano receiving route on the stated network. KaSiHub settles only after matching canonical blockchain and custody evidence. Wrong-network or wrong-token transfers may be irrecoverable.</p><p className="mt-3">Your application information must be accurate and may be verified. KaSiHub may request further evidence, reject an application, or pause settlement where legal, compliance, fraud, custody or reconciliation controls require it.</p><p className="mt-3">Scroll to the end to enable acceptance. The authoritative wording remains the version identified below and must be approved before production activation.</p><p className="mt-3 font-semibold text-amber-200">End of terms — version {offer.termsVersion}</p></div>
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input name="termsAccepted" type="checkbox" required disabled={!termsRead} className="mt-1" />
                <span>I accept the presale reservation acknowledgement (version {offer.termsVersion}) and understand that blockchain confirmation is payment evidence, not a Share Subscription Agreement or final share certificate.</span></label>
              {!termsRead && <p className="text-xs text-amber-200">Read and scroll through the complete terms to enable acceptance.</p>}
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <div className="flex gap-3">
                {applicationPhase > 1 && (
                  <Button type="button" variant="outline" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setApplicationPhase((phase) => Math.max(1, phase - 1))}>
                    <ChevronLeft className="mr-1 h-4 w-4" />Back
                  </Button>
                )}
                {applicationPhase < 5 ? <Button type="button" className="flex-1 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={submitting} onClick={advanceApplication}>{submitting && applicationPhase === 4 ? "Uploading…" : "Continue"}<ChevronRight className="ml-1 h-4 w-4" /></Button> : devPreview ? <Button type="button" className="flex-1 bg-slate-500 font-bold text-white" disabled>Read-only preview — no reservation</Button> : <Button className="flex-1 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={submitting || !termsRead}>{submitting ? "Creating reservation…" : "Reserve and view payment"}</Button>}
              </div>
            </form></CardContent>
          </Card>
        ) : (
          <Card className="presale-form-card min-w-0 text-white shadow-2xl shadow-black/20">
            <CardHeader><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold leading-none">{statusLabel(order.status)}</h2><CardDescription className="mt-2 text-slate-400">{order.orderReference}</CardDescription></div>
              {order.status === "confirmed" ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <Clock3 className="h-8 w-8 text-amber-400" />}</div></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-200">Send exactly</p><p className="mt-1 text-3xl font-black text-white">{order.totalUsdt} USDT</p>
                <p className="mt-1 text-sm text-amber-100/80">using {order.network} only</p>
              </div>
              <div><p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Receiving address</p><div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 p-3 text-xs text-slate-200">{order.receivingAddress}</code>
                <Button type="button" variant="outline" size="icon" onClick={copyAddress} aria-label="Copy receiving address"><Copy className="h-4 w-4" /></Button></div>{copied && <p className="mt-1 text-xs text-emerald-300">Address copied</p>}</div>
              {order.tokenContract && <div><p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Verified USDT contract</p><code className="break-all text-xs text-slate-300">{order.tokenContract}</code></div>}
              {order.status === "confirmed" ? (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Payment has reached {order.confirmations} confirmations. Your order is secured for later incorporation into the live share ledger.</div>
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="presale-shell min-h-screen px-5 py-6 sm:px-6 sm:py-8 lg:px-8"><div className="presale-header mx-auto mb-10 flex w-full max-w-6xl items-center justify-between sm:mb-12"><Link href="/" className="relative block h-[76px] w-[134px] sm:h-[92px] sm:w-[162px]" aria-label="KaSiShares home"><Image src="/kasishares-logo.png" alt="KaSiShares — Own. Grow. Prosper. Together." fill sizes="(max-width: 640px) 134px, 162px" className="object-contain object-left" priority /></Link><div className="hidden items-center gap-2 text-xs text-slate-300 sm:flex"><WalletCards className="h-4 w-4" /> USDT settlement</div></div><div className="mx-auto flex w-full max-w-6xl justify-center">{children}</div></main>;
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

function UploadField({ label, name, accept, hint, onChange }: { label: string; name: string; accept: string; hint: string; onChange: () => void }) {
  return <label className="block rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-sm font-medium text-slate-200 transition-colors hover:border-sky-300/50"><span className="flex items-center gap-2"><Upload className="h-4 w-4 text-sky-300" />{label}</span><input name={name} type="file" accept={accept} required onChange={onChange} className="mt-3 block w-full cursor-pointer text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-sky-300 file:px-3 file:py-2 file:font-semibold file:text-slate-950" /><span className="mt-2 block text-xs font-normal text-slate-400">{hint}</span></label>;
}

const SOURCE_OF_FUNDS: Array<[string, string]> = [
  ["salary", "Salary"], ["business", "Business income"], ["investment", "Investment proceeds"],
  ["property_sale", "Property sale"], ["inheritance", "Inheritance"], ["pension", "Pension"],
  ["savings", "Savings"], ["company", "Company funds"], ["trust", "Trust funds"], ["other", "Other"],
];

function Select({ name, options, required }: { name: string; options: Array<[string, string]>; required?: boolean }) {
  return <select name={name} required={required} defaultValue="" className="h-10 w-full rounded-md border border-white/15 bg-[#111a18] px-3 text-sm text-white"><option value="" disabled>Select…</option>{options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-t border-white/10 pt-5 text-sm font-bold uppercase tracking-wider text-amber-300">{children}</h3>;
}

function Declaration({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input name={name} type="checkbox" required className="mt-1" /><span>{children}</span></label>;
}
