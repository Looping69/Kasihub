"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { QrCode, ShieldCheck } from "lucide-react";
import { createCryptoPaymentRequest } from "@/lib/crypto-payment-request";

export function CryptoPaymentQr({ network, receivingAddress, tokenContract, amountUsdt }: {
  network: string;
  receivingAddress: string;
  tokenContract?: string;
  amountUsdt: string;
}) {
  const request = useMemo(() => {
    try {
      return { value: createCryptoPaymentRequest({ network, receivingAddress, tokenContract, amountUsdt }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Wallet QR request is unavailable" };
    }
  }, [amountUsdt, network, receivingAddress, tokenContract]);
  const [qrState, setQrState] = useState<{ imageUrl: string; error: string }>({ imageUrl: "", error: "" });

  useEffect(() => {
    let active = true;
    setQrState({ imageUrl: "", error: "" });
    if (!request.value) return () => { active = false; };
    void import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(request.value!.payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 256,
        color: { dark: "#071a2f", light: "#ffffff" },
      }))
      .then((imageUrl) => { if (active) setQrState({ imageUrl, error: "" }); })
      .catch(() => { if (active) setQrState({ imageUrl: "", error: "The QR image could not be generated. Use the verified payment details below." }); });
    return () => { active = false; };
  }, [request]);

  if (!request.value) {
    return <div role="status" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
      <strong className="block text-white">Wallet QR unavailable</strong>
      {request.error}. Use the verified payment details below.
    </div>;
  }

  return <section className="rounded-2xl border border-amber-300/25 bg-white p-5 text-slate-950 shadow-lg shadow-black/15" aria-labelledby="wallet-qr-heading">
    <div className="flex items-start gap-3">
      <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><QrCode className="h-5 w-5" /></span>
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">Scan to pay</p><h3 id="wallet-qr-heading" className="mt-1 text-lg font-black">{request.value.networkLabel}</h3></div>
    </div>
    <div className="mx-auto mt-4 flex aspect-square w-full max-w-[256px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
      {qrState.imageUrl
        ? <Image src={qrState.imageUrl} alt={request.value.includesExactAmount
          ? `Wallet payment QR for exactly ${amountUsdt} USDT on ${request.value.networkLabel}`
          : `Wallet receiving-address QR for ${request.value.networkLabel}`}
          width={256} height={256} unoptimized className="h-full w-full" />
        : <div role="status" className="px-4 text-center text-sm text-slate-500">{qrState.error || "Generating secure payment QR…"}</div>}
    </div>
    <div className="mt-4 rounded-xl bg-slate-100 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount due</p><p className="mt-1 text-2xl font-black">{amountUsdt} USDT</p></div>
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{request.value.guidance}</p>
  </section>;
}
