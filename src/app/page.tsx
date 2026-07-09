"use client";

import { useEffect, useState } from "react";
import { useKasiStore } from "@/lib/store";
import { Landing } from "@/components/landing";
import { AppShell } from "@/components/app-shell";
import { AdminShell } from "@/components/admin-shell";
import { RegistrationWizard } from "@/components/registration-wizard";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  const { isAuthenticated, registrationOpen, adminMode } = useKasiStore();
  const [booted, setBooted] = useState(false);

  // Auto-login the demo member on first load so the dashboard is explorable.
  // If a member is already persisted (e.g. just registered), keep them logged in.
  // Users can still "logout" to see the landing and re-register.
  useEffect(() => {
    async function boot() {
      // If already authenticated from a previous session, keep them.
      const existing = useKasiStore.getState();
      if (existing.isAuthenticated && existing.currentMember) {
        setBooted(true);
        return;
      }
      try {
        const res = await fetch("/api/auth/login", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.member) {
            useKasiStore.getState().setMember(data.member);
          }
        }
      } catch {
        // ignore - user will see landing
      } finally {
        setBooted(true);
      }
    }
    boot();
  }, []);

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 animate-pulse" />
            <div className="absolute inset-1 rounded-xl bg-background flex items-center justify-center">
              <span className="text-2xl font-black bg-gradient-to-br from-emerald-600 to-amber-500 bg-clip-text text-transparent">
                K
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading KaSiHUB...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (adminMode ? <AdminShell /> : <AppShell />) : <Landing />}
      {registrationOpen && <RegistrationWizard />}
      <Toaster richColors position="top-right" />
    </>
  );
}
