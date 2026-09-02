"use client";

// Author: Klaasvaakie ( |╲ )
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Coins, Award, FileText, Loader2, Sparkles, Download,
  Calendar, ExternalLink, ArrowRight, ShieldCheck,
  AlertTriangle, RefreshCw, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActivePresaleCampaigns } from "@/components/views/active-presale-campaigns";
import type { SharesData } from "@/lib/shares-portfolio";

function fmtUSD(amount: number): string {
  return `$${(amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SharesView() {
  const [data, setData] = useState<SharesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/member/shares", {
        cache: "no-store",
        signal,
      });
      const payload = await res.json().catch(() => null) as SharesData | { error?: string } | null;
      if (!res.ok) {
        const message = payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The authoritative share portfolio is temporarily unavailable.";
        throw new Error(message);
      }
      setData(payload as SharesData);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setData(null);
      setError(reason instanceof Error ? reason.message : "The authoritative share portfolio is temporarily unavailable.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading your authoritative share portfolio...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-2xl border-rose-200 bg-rose-50/60 p-7 dark:border-rose-900 dark:bg-rose-950/20" role="alert">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black">Your shares could not be loaded</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{error ?? "The authoritative share portfolio is temporarily unavailable."}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">No share values or certificates are being estimated while the register is unavailable.</p>
            <Button type="button" className="mt-5" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry portfolio
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const activePhase = data.phases.find((p) => p.status === "OPEN");
  const kasiActiveCount = data.activeShares.length;
  const kasiRetractedCount = data.retractedShares.length;
  const totalBonusShares = data.activeShares.reduce((sum, s) => sum + (s.bonusShares ?? 0), 0);
  const purchaseAmount = data.activeShares.reduce((sum, share) => sum + (share.totalAmount ?? 0), 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Active Presale Campaigns Notice */}
      <ActivePresaleCampaigns />

      {/* Hero: Authoritative Shareholder Position */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-[linear-gradient(135deg,#0a1128_0%,#101f42_45%,#1c2d5a_100%)] p-6 text-slate-50 shadow-2xl sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,.8fr)] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Solidus Holdings Class B Shares
              </span>
              <span className="text-slate-300">Sealed Ledger Register</span>
            </div>

            <div className="relative h-14 w-48 sm:h-16 sm:w-56">
              <Image
                src="/kasishares-logo.png"
                alt="KaSiShares — Own. Grow. Prosper. Together."
                fill
                sizes="(max-width: 640px) 192px, 224px"
                className="object-contain object-left"
                priority
              />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Your Shareholder Portfolio
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Direct, authoritative holding records, active allocations and sealed digital certificates verified on the KaSiHub share register.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild className="bg-gradient-to-r from-amber-400 to-amber-500 font-bold text-slate-950 shadow-lg hover:from-amber-300 hover:to-amber-400">
                <Link href="/presale">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Open private application <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Panel */}
          <div className="rounded-2xl border border-white/15 bg-black/40 p-5 backdrop-blur-md">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Holding Summary</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Total Shares</p>
                <p className="mt-1 text-xl font-black text-white">{data.totalShares.toLocaleString()}</p>
                {totalBonusShares > 0 && (
                  <p className="text-[10px] text-amber-300 mt-0.5">({totalBonusShares} bonus included)</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Historical acquisition cost</p>
                <p className="mt-1 text-xl font-black text-emerald-400">{fmtUSD(data.totalValue)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Purchase amount {fmtUSD(purchaseAmount)}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Average paid issue price</p>
                <p className="mt-1 text-lg font-bold text-white">{fmtUSD(data.shareValuePerShare)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">per paid share</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Certificates</p>
                <p className="mt-1 text-lg font-bold text-white">{kasiActiveCount} active</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{kasiRetractedCount} historical</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Share Phases & Campaign Availability */}
      {data.phases.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-500" /> Share Allocation Phases
                </CardTitle>
                <CardDescription>
                  Official funding phases and inventory distribution schedule.
                </CardDescription>
              </div>
              {activePhase && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Phase {activePhase.phase} is Open
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.phases.map((phase) => {
                const isOpen = phase.status === "OPEN";
                const isUpcoming = phase.status === "UPCOMING";
                const isSoldOut = phase.status === "SOLD_OUT";
                const soldPct = phase.totalShares > 0 ? (phase.soldShares / phase.totalShares) * 100 : 0;

                return (
                  <div
                    key={phase.id}
                    className={`relative rounded-xl border p-4 transition-all ${
                      isOpen
                        ? "border-amber-400/40 bg-amber-500/[0.04] shadow-sm"
                        : "border-border/60 bg-muted/20 opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold flex items-center gap-1.5">
                          Phase {phase.phase}
                          {phase.bonusBuyOneGet && (
                            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-600 dark:text-amber-400">
                              <Sparkles className="mr-1 h-3 w-3" /> BOGO
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtUSD(phase.pricePerShare)} per share
                        </p>
                      </div>
                      <Badge
                        variant={isOpen ? "default" : "outline"}
                        className={isOpen ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : ""}
                      >
                        {isOpen ? "Open" : isUpcoming ? "Upcoming" : isSoldOut ? "Sold out" : phase.status}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{phase.soldShares.toLocaleString()} / {phase.totalShares.toLocaleString()} allocated</span>
                        <span>{soldPct.toFixed(0)}%</span>
                      </div>
                      <Progress value={soldPct} className="h-1.5" />
                    </div>

                    {isOpen && (
                      <Button asChild size="sm" className="mt-4 w-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
                        <Link href="/presale">Apply for Phase {phase.phase}</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Official Digital Certificates Register */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Official Share Certificates
              </CardTitle>
              <CardDescription>
                Open the holder-authorised PDF generated from the sealed ledger snapshot for regulatory proof of ownership.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-xs grid-cols-2 mb-6">
              <TabsTrigger value="active" className="flex items-center gap-1.5 text-xs font-semibold">
                <Award className="h-3.5 w-3.5" />
                Active ({kasiActiveCount})
              </TabsTrigger>
              <TabsTrigger value="retracted" className="flex items-center gap-1.5 text-xs font-semibold">
                <FileText className="h-3.5 w-3.5" />
                Historical ({kasiRetractedCount})
              </TabsTrigger>
            </TabsList>

            {/* Active Tab */}
            <TabsContent value="active" className="space-y-4">
              {kasiActiveCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Award className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">No active certificates issued yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                    Certificates are cryptographically sealed and issued upon completed presale settlement and identity approval.
                  </p>
                  <Button asChild className="mt-5 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                    <Link href="/presale">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Open private application
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.activeShares.map((share) => {
                    const certificateUrl = `/api/shares/certificates/${encodeURIComponent(share.certificateNo)}`;
                    const paid = share.paidShares ?? Math.max(0, share.quantity - (share.bonusShares ?? 0));
                    const bonus = share.bonusShares ?? 0;

                    return (
                      <motion.div
                        key={share.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/[0.05] via-background to-background p-5 shadow-sm space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              Solidus Share Certificate
                            </span>
                            <h4 className="font-mono text-base font-black tracking-tight">{share.certificateNo}</h4>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                            Active
                          </Badge>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Total Allocation</p>
                            <p className="text-base font-black">{share.quantity.toLocaleString()} Shares</p>
                            {bonus > 0 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                {paid.toLocaleString()} paid + {bonus.toLocaleString()} bonus
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Historical acquisition cost</p>
                            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {fmtUSD(share.totalAmount)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {fmtUSD(share.pricePerShare)} / paid share
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phase</p>
                            <p className="font-semibold">{share.phase > 0 ? `Phase ${share.phase}` : "Standard"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Issued Date</p>
                            <p className="font-semibold flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {new Date(share.createdAt).toLocaleDateString("en-ZA")}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold">
                            <a href={certificateUrl} download>
                              <Download className="h-3.5 w-3.5" /> Download Sealed PDF
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <a href={certificateUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> View
                            </a>
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Retracted Tab */}
            <TabsContent value="retracted" className="space-y-4">
              {kasiRetractedCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">No historical certificates</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                    When you purchase additional shares, prior certificates are replaced and archived here as historical ledger records.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.retractedShares.map((share) => {
                    const certificateUrl = `/api/shares/certificates/${encodeURIComponent(share.certificateNo)}`;

                    return (
                      <div
                        key={share.id}
                        className="rounded-2xl border border-border bg-muted/20 p-5 opacity-75 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Historical Certificate
                            </span>
                            <h4 className="font-mono text-sm font-bold line-through text-muted-foreground">
                              {share.certificateNo}
                            </h4>
                          </div>
                          <Badge variant="outline" className="border-rose-300 text-rose-600 dark:text-rose-400 bg-rose-500/10 text-[10px]">
                            Replaced
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Holding</p>
                            <p className="font-semibold">{share.quantity.toLocaleString()} Shares</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Paid Amount</p>
                            <p className="font-semibold">{fmtUSD(share.totalAmount)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                          <span>Issued {new Date(share.createdAt).toLocaleDateString("en-ZA")}</span>
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <a href={certificateUrl} target="_blank" rel="noreferrer">
                              <Download className="mr-1 h-3 w-3" /> Archive PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Shareholder Governance Note */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground text-sm">Solidus Holdings Shareholder Governance</p>
            <p>
              KaSiShares Class B private shares represent equity participation in Solidus Holdings (Pty) Ltd. Shareholder rights, dividend distributions to Roots Bank accounts, and digital certificate verification are governed by the approved Class B Investor Terms and authoritative ledger snapshots.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
