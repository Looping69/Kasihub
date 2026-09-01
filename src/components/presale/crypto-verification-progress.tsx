import { CheckCircle2, Clock3, FileBadge2, ScanSearch, Send, ShieldCheck, WalletCards } from "lucide-react";
import type { ApplicantJourneyState } from "@/lib/applicant-portal-contract";

type StepState = "complete" | "active" | "waiting";

export function CryptoVerificationProgress({
  journeyState,
  transactionHash,
  confirmations,
  requiredConfirmations,
  verificationReason,
}: {
  journeyState: ApplicantJourneyState;
  transactionHash?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  verificationReason?: string;
}) {
  const hashSaved = Boolean(transactionHash);
  const settlementVerified = ["confirmed", "awaiting_incorporation", "issued"].includes(journeyState);
  const custodyPending = Boolean(verificationReason?.includes("custody") || verificationReason?.includes("provider"));
  const chainVerified = settlementVerified || custodyPending;
  const certificateReady = journeyState === "issued";
  const steps: Array<{ label: string; detail: string; state: StepState; icon: typeof Send }> = [
    {
      label: "Send exact USDT",
      detail: hashSaved ? "Payment details used" : "Scan the QR or use the verified details",
      state: hashSaved ? "complete" : "active",
      icon: WalletCards,
    },
    {
      label: "Submit transaction hash",
      detail: hashSaved ? "Hash saved securely" : "Paste the hash after your wallet broadcasts",
      state: hashSaved ? "complete" : "waiting",
      icon: Send,
    },
    {
      label: "Chain verification",
      detail: chainVerified
        ? "Receiver, token, amount and depth verified"
        : hashSaved && typeof confirmations === "number"
          ? `${confirmations}/${requiredConfirmations ?? "required"} confirmations`
          : "Automatic checks begin after submission",
      state: chainVerified ? "complete" : hashSaved ? "active" : "waiting",
      icon: ScanSearch,
    },
    {
      label: "Remitano credit confirmation",
      detail: settlementVerified
        ? "Custodian credit matched to this transfer"
        : custodyPending
          ? "Blockchain checks passed; Remitano credit is being reconciled"
          : "Starts after the blockchain checks pass",
      state: settlementVerified ? "complete" : custodyPending ? "active" : "waiting",
      icon: ShieldCheck,
    },
    {
      label: "Certificate ready",
      detail: certificateReady ? "Shares issued and certificate available" : settlementVerified ? "Issuance is in progress" : "Starts only after verified settlement",
      state: certificateReady ? "complete" : settlementVerified ? "active" : "waiting",
      icon: FileBadge2,
    },
  ];

  return <ol aria-label="Crypto payment verification progress" className="grid gap-3 sm:grid-cols-2">
    {steps.map((step) => {
      const Icon = step.icon;
      return <li key={step.label} className={`flex items-start gap-3 rounded-xl border p-4 ${step.state === "complete" ? "border-emerald-300/30 bg-emerald-400/10" : step.state === "active" ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-black/15"}`}>
        <span className={`mt-0.5 rounded-lg p-2 ${step.state === "complete" ? "bg-emerald-400/15 text-emerald-300" : step.state === "active" ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-slate-500"}`}>
          {step.state === "complete" ? <CheckCircle2 className="h-4 w-4" /> : step.state === "active" ? <Clock3 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <div><p className="text-sm font-bold text-white">{step.label}</p><p className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</p></div>
      </li>;
    })}
  </ol>;
}
