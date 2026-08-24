"use client";

// Author: Klaasvaakie ( |╲ )
import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Portal = {
  applicant: { profileNumber: string; email: string };
  application: null | { applicationNumber: string; campaignName: string; status: string; phaseCompleted: number; completionPercent: number; nextStep: number; resumeUrl: string | null };
  kyc: { status: string; verified: boolean };
  order: null | { orderReference: string; status: string; incorporationStatus: string };
};

export function SharesAccountClient() {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPortal = useCallback(async () => {
    const response = await fetch("/api/presale/portal", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) { setPortal(null); return; }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Applicant status is unavailable");
    setPortal(body);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortal().catch((reason) => setError(reason.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortal]);

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

  return <main className="presale-shell min-h-screen px-5 py-8 text-white">
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="relative h-[76px] w-[134px]"><Image src="/kasishares-logo.png" alt="KaSiShares home" fill sizes="134px" className="object-contain object-left" priority /></Link>
        {portal ? <Button variant="outline" onClick={() => void logout()} className="border-white/20 bg-transparent text-white"><LogOut className="mr-2 h-4 w-4" />Sign out</Button> : null}
      </header>
      {loading ? <p className="text-slate-300">Loading applicant account…</p> : portal ? <PortalView portal={portal} /> : <LoginForm error={error} onSubmit={login} />}
    </div>
  </main>;
}

function LoginForm({ error, onSubmit }: { error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#0f2744] p-7 shadow-2xl">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Separate applicant access</p>
    <h1 className="mt-3 text-3xl font-black">KaSiShares account</h1>
    <p className="mt-3 text-sm leading-6 text-slate-300">Sign in with the account created during Step 1. This space is separate from the normal KaSiHub member dashboard.</p>
    <form onSubmit={onSubmit} className="mt-7 space-y-5">
      <label className="block text-sm">Email address<Input name="email" type="email" required autoComplete="email" className="mt-2 border-white/15 bg-black/20" /></label>
      <label className="block text-sm">Password<Input name="password" type="password" required minLength={12} autoComplete="current-password" className="mt-2 border-white/15 bg-black/20" /></label>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <Button className="w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">Sign in to KaSiShares</Button>
    </form>
  </section>;
}

function PortalView({ portal }: { portal: Portal }) {
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Applicant account</p><h1 className="mt-2 text-3xl font-black">Welcome back</h1><p className="mt-2 text-slate-300">{portal.applicant.email} · {portal.applicant.profileNumber}</p></div>
    <div className="grid gap-5 md:grid-cols-3">
      <StatusCard title="Application" value={portal.application ? `Step ${portal.application.nextStep} of 5` : "Not started"} detail={portal.application?.applicationNumber ?? "No application record"} complete={Boolean(portal.application && portal.application.phaseCompleted >= 5)} />
      <StatusCard title="Identity verification" value={portal.kyc.verified ? "Verified" : portal.kyc.status} detail="ID, liveness and face match" complete={portal.kyc.verified} />
      <StatusCard title="Reservation" value={portal.order?.status ?? "Not created"} detail={portal.order?.orderReference ?? "Payment remains locked until eligible"} complete={portal.order?.status === "confirmed"} />
    </div>
    {portal.application ? <section className="rounded-2xl border border-white/10 bg-[#0f2744] p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm text-slate-400">{portal.application.campaignName}</p><h2 className="mt-1 text-2xl font-bold">Continue your application</h2><p className="mt-2 text-sm text-slate-300">Your next incomplete step is Step {portal.application.nextStep}. Progress is retained against your isolated applicant profile.</p></div>{portal.application.resumeUrl ? <Button asChild className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"><a href={portal.application.resumeUrl}>Continue application</a></Button> : null}</div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{ width: `${portal.application.completionPercent}%` }} /></div>
    </section> : null}
    <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" />This account cannot enter the normal KaSiHub member dashboard.</p>
  </div>;
}

function StatusCard({ title, value, detail, complete }: { title: string; value: string; detail: string; complete: boolean }) {
  const Icon = complete ? CheckCircle2 : Clock3;
  return <div className="rounded-2xl border border-white/10 bg-[#0f2744] p-5"><Icon className={`h-6 w-6 ${complete ? "text-emerald-400" : "text-amber-300"}`} /><p className="mt-4 text-xs uppercase tracking-wider text-slate-400">{title}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></div>;
}
