"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token")?.trim() ?? "");
  }, []);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "Password recovery is unavailable."); return; }
      setMessage("If that email belongs to an active KaSiHub account, a one-use reset link has been sent.");
    } catch {
      setError("Password recovery is temporarily unavailable.");
    } finally {
      setWorking(false);
    }
  }

  async function completeReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setWorking(true);
    try {
      const response = await fetch("/api/auth/password-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "The password could not be reset."); return; }
      setMessage("Your password has been changed. All existing sessions were signed out for your protection.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Password reset is temporarily unavailable.");
    } finally {
      setWorking(false);
    }
  }

  return <main className="min-h-screen bg-gradient-to-br from-[#071a2f] via-[#0f2744] to-[#172554] px-5 py-12 text-white">
    <section className="mx-auto max-w-md rounded-2xl border border-white/15 bg-slate-950/55 p-7 shadow-2xl backdrop-blur">
      <KeyRound className="h-10 w-10 text-amber-300" aria-hidden="true" />
      <h1 className="mt-4 text-3xl font-black">{token ? "Choose a new password" : "Reset your password"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">{token ? "Use at least 12 characters. Completing the reset signs out every existing KaSiHub and KaSiShares session." : "Enter the email used for your KaSiHub or KaSiShares account."}</p>

      {message ? <div role="status" className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="mr-2 inline h-4 w-4" />{message}</div> : null}
      {error ? <p role="alert" className="mt-6 rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</p> : null}

      {token ? <form onSubmit={completeReset} className="mt-7 space-y-5">
        <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/15 bg-black/20" /></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="border-white/15 bg-black/20" /></div>
        <Button type="submit" disabled={working || Boolean(message)} className="w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{working ? "Securing account…" : "Reset password"}</Button>
      </form> : <form onSubmit={requestReset} className="mt-7 space-y-5">
        <div className="space-y-2"><Label htmlFor="reset-email">Email address</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="border-white/15 bg-black/20" /></div>
        <Button type="submit" disabled={working || Boolean(message)} className="w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{working ? "Sending secure link…" : "Send reset link"}</Button>
      </form>}

      <p className="mt-6 flex gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Reset links expire after 30 minutes and can be used only once.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-amber-200 hover:text-amber-100">Return to KaSiHub</Link>
    </section>
  </main>;
}
