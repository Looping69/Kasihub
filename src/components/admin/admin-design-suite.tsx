"use client";

// Author: Klaasvaakie ( |╲ )
import { useEffect, useMemo, useState } from "react";
import { Bell, Building2, Clipboard, Coins, Droplets, History, LayoutDashboard, LayoutTemplate, LogOut, Menu, MessageCircle, Monitor, Palette, RotateCcw, Save, ShieldCheck, ShoppingBag, Smartphone, Tablet, Ticket, Type, UserPlus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_THEME, type AppTheme } from "@/lib/theme";

type ThemeVersion = { version: number; status: string; theme: AppTheme; createdAt: string };
const STORAGE_KEY = "kasihub-look-and-feel-draft";
const VERSION_KEY = "kasihub-look-and-feel-versions";
const PRESETS: { name: string; colors: Partial<AppTheme> }[] = [
  { name: "KaSiHUB", colors: { primary: "#0569BD", accent: "#F58220", sidebar: "#0569BD", background: "#F8FAFC" } },
  { name: "Midnight", colors: { primary: "#263470", accent: "#F59E0B", sidebar: "#0F172A", background: "#F8FAFC" } },
  { name: "Ubuntu", colors: { primary: "#0F766E", accent: "#F97316", sidebar: "#134E4A", background: "#F7FAF9" } },
];
const COLOR_FIELDS: { key: keyof AppTheme; label: string }[] = [
  { key: "primary", label: "Primary" }, { key: "accent", label: "Accent" },
  { key: "background", label: "Background" }, { key: "surface", label: "Surface" },
  { key: "text", label: "Text" }, { key: "mutedText", label: "Muted text" },
  { key: "border", label: "Border" }, { key: "sidebar", label: "Sidebar" },
  { key: "sidebarText", label: "Sidebar text" },
];

export function AdminDesignSuite() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(readLocal<AppTheme>(STORAGE_KEY, DEFAULT_THEME));
      setVersions(readLocal<ThemeVersion[]>(VERSION_KEY, []));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function saveDraft() {
    const nextVersion: ThemeVersion = { version: versions.length + 1, status: "local draft", theme, createdAt: new Date().toISOString() };
    const nextVersions = [nextVersion, ...versions].slice(0, 5);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    window.localStorage.setItem(VERSION_KEY, JSON.stringify(nextVersions));
    setVersions(nextVersions);
    toast.success("Look & feel saved on this device");
  }

  async function copyForWimpie() {
    await navigator.clipboard.writeText(JSON.stringify(theme, null, 2));
    toast.success("Theme specification copied for Wimpie");
  }
  const previewStyle = useMemo(() => ({
    "--preview-primary": theme.primary, "--preview-accent": theme.accent, "--preview-bg": theme.background,
    "--preview-surface": theme.surface, "--preview-text": theme.text, "--preview-muted": theme.mutedText,
    "--preview-border": theme.border, "--preview-sidebar": theme.sidebar, "--preview-sidebar-text": theme.sidebarText,
    "--preview-radius": `${theme.radius}px`, fontSize: `${theme.fontScale}rem`,
  }) as React.CSSProperties, [theme]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-2xl font-bold tracking-tight">Look & Feel</h2><p className="text-sm text-muted-foreground">Shape the colours and styling, then copy the exact specification for Wimpie.</p></div>
      <div className="inline-flex items-center gap-2 self-start rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-500" /> Frontend concept only · nothing is published</div>
    </div>
    <div className="grid min-h-[690px] overflow-hidden rounded-xl border bg-card theme-elevation xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="border-b xl:border-b-0 xl:border-r">
        <Tabs defaultValue="theme" className="h-full">
          <TabsList className="grid h-12 w-full grid-cols-3 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="theme" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Palette className="mr-2 h-4 w-4" />Theme</TabsTrigger>
            <TabsTrigger value="pages" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><LayoutTemplate className="mr-2 h-4 w-4" />Pages</TabsTrigger>
            <TabsTrigger value="brand" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Type className="mr-2 h-4 w-4" />Brand</TabsTrigger>
          </TabsList>
          <TabsContent value="theme" className="m-0 space-y-5 p-5">
            <div className="space-y-2"><Label>Theme name</Label><Input value={theme.name} onChange={(event) => setTheme({ ...theme, name: event.target.value })} /></div>
            <div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick palettes</h3><div className="grid grid-cols-3 gap-2">{PRESETS.map((preset) => <button key={preset.name} onClick={() => setTheme({ ...theme, ...preset.colors, name: preset.name })} className="rounded-lg border bg-card p-2 text-left text-[11px] font-semibold transition hover:border-primary"><span className="mb-2 flex gap-1">{[preset.colors.primary, preset.colors.accent, preset.colors.sidebar].map((color, index) => <span key={`${preset.name}-${index}`} className="h-4 flex-1 rounded-sm" style={{ background: color }} />)}</span>{preset.name}</button>)}</div></div>
            <div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Colors</h3><div className="space-y-2.5">{COLOR_FIELDS.map((field) => <ColorField key={field.key} label={field.label} value={String(theme[field.key])} onChange={(value) => setTheme({ ...theme, [field.key]: value })} />)}</div></div>
            <div className="space-y-4 border-t pt-4"><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Appearance</h3>
              <Range label="Corner radius" value={theme.radius} min={0} max={24} suffix="px" onChange={(radius) => setTheme({ ...theme, radius })} />
              <Range label="Font scale" value={Math.round(theme.fontScale * 100)} min={85} max={120} suffix="%" onChange={(value) => setTheme({ ...theme, fontScale: value / 100 })} />
              <div className="space-y-2"><Label>Shadow strength</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={theme.shadow} onChange={(event) => setTheme({ ...theme, shadow: event.target.value as AppTheme["shadow"] })}><option value="none">None</option><option value="soft">Soft</option><option value="medium">Medium</option><option value="strong">Strong</option></select></div>
            </div>
          </TabsContent>
          <TabsContent value="pages" className="m-0 p-5"><h3 className="font-semibold">Page backgrounds</h3><p className="mt-1 text-sm text-muted-foreground">Choose the global canvas treatment used behind application content.</p><div className="mt-5 grid grid-cols-3 gap-2">{(["solid", "soft", "grid"] as const).map((mode) => <button key={mode} onClick={() => setTheme({ ...theme, pageBackground: mode })} className={`h-24 rounded-lg border text-xs font-medium capitalize ${theme.pageBackground === mode ? "border-primary ring-2 ring-primary/20" : ""}`} style={{ background: mode === "solid" ? theme.background : mode === "soft" ? `radial-gradient(circle at top right, ${theme.primary}25, ${theme.background} 70%)` : `linear-gradient(${theme.border} 1px, transparent 1px),linear-gradient(90deg,${theme.border} 1px,transparent 1px)`, backgroundSize: mode === "grid" ? "12px 12px" : undefined }}>{mode}</button>)}</div></TabsContent>
          <TabsContent value="brand" className="m-0 space-y-5 p-5"><div><h3 className="font-semibold">Brand identity</h3><p className="mt-1 text-sm text-muted-foreground">Logo assets remain protected. This suite controls the surrounding brand palette, typography scale and geometry.</p></div><div className="rounded-lg border bg-muted/40 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current mark</p><p className="mt-3 text-2xl font-black">KaSi<span style={{ color: theme.accent }}>HUB</span></p></div></TabsContent>
        </Tabs>
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-card p-4"><Button variant="outline" onClick={() => setTheme(DEFAULT_THEME)}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button><Button variant="outline" onClick={saveDraft}><Save className="mr-2 h-4 w-4" />Save locally</Button><Button className="col-span-2" onClick={() => void copyForWimpie()}><Clipboard className="mr-2 h-4 w-4" />Copy colours for Wimpie</Button></div>
      </section>
      <section className="min-w-0 bg-muted/20 p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Live preview</h3><p className="text-xs text-muted-foreground">Draft changes stay isolated here until publication.</p></div><div className="flex rounded-md border bg-card p-1">{([{ key: "desktop", icon: Monitor }, { key: "tablet", icon: Tablet }, { key: "mobile", icon: Smartphone }] as const).map(({ key, icon: Icon }) => <button key={key} aria-label={key} onClick={() => setViewport(key)} className={`rounded px-3 py-1.5 ${viewport === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Icon className="h-4 w-4" /></button>)}</div></div>
        <div className={`mx-auto overflow-hidden border bg-white transition-all ${viewport === "desktop" ? "w-full" : viewport === "tablet" ? "max-w-[760px]" : "max-w-[390px]"}`} style={{ ...previewStyle, borderRadius: theme.radius + 2 }}><ThemePreview compact={viewport === "mobile"} /></div>
        <div className="mt-6 overflow-hidden rounded-lg border bg-card"><div className="flex items-center gap-2 border-b px-4 py-3"><History className="h-4 w-4" /><h3 className="text-sm font-semibold">Local draft history</h3></div><div className="divide-y">{versions.length ? versions.map((item) => <button key={`${item.version}-${item.createdAt}`} onClick={() => setTheme(item.theme)} className="grid w-full grid-cols-[55px_80px_1fr] items-center gap-3 px-4 py-3 text-left text-xs hover:bg-muted/50"><strong>v{item.version}</strong><span className="text-orange-600">{item.status}</span><span className="truncate text-muted-foreground">{item.theme.name} · {new Date(item.createdAt).toLocaleString()}</span></button>) : <p className="px-4 py-6 text-center text-xs text-muted-foreground">Save a local draft to begin comparison history.</p>}</div></div>
      </section>
    </div>
  </div>;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="grid grid-cols-[92px_42px_1fr] items-center gap-2"><Label className="text-xs">{label}</Label><Input aria-label={`${label} color`} type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 p-1" /><Input aria-label={`${label} hex`} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 font-mono text-xs" /></div>; }
function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <div className="space-y-2"><div className="flex justify-between"><Label>{label}</Label><span className="text-xs text-muted-foreground">{value}{suffix}</span></div><input className="w-full accent-[var(--primary)]" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>; }
const PREVIEW_NAV = [
  { label: "Overview", sub: "Platform analytics", icon: LayoutDashboard },
  { label: "Members & KYC", sub: "Manage members", icon: Users },
  { label: "Eco-System", sub: "5×6 structure view", icon: Building2 },
  { label: "KasiShares", sub: "Phases & dividends", icon: Coins },
  { label: "Marketplace", sub: "Products & orders", icon: ShoppingBag },
  { label: "KasiMall", sub: "Transactions & silos", icon: Wallet },
  { label: "KasiPool", sub: "Distributions & payouts", icon: Droplets },
];

const PRIMARY_METRICS = [
  { label: "Total members", value: "126", note: "1 active", icon: Users, tone: "#00A878" },
  { label: "Total revenue", value: "R 581 123", note: "all sources", icon: Wallet, tone: "var(--preview-accent)" },
  { label: "Shares sold", value: "1 296", note: "$31,225 value", icon: Coins, tone: "#F5A000" },
  { label: "KasiPool balance", value: "R -6 167", note: "R 6 432 paid out", icon: Droplets, tone: "#00A878" },
];

const SMALL_METRICS = [
  { label: "Pending KYC", value: "17", note: "", icon: ShieldCheck },
  { label: "Pioneers", value: "35/200", note: "", icon: Users },
  { label: "Mall transactions", value: "8", note: "", icon: Building2 },
  { label: "Tax-eligible members", value: "0", note: "earning > R7k/mo", icon: ShieldCheck },
  { label: "Active vouchers", value: "1", note: "0 expiring", icon: Ticket },
  { label: "Referrals", value: "2/3", note: "66.7% conversion", icon: UserPlus },
  { label: "WhatsApp reminders", value: "103", note: "5/3/1 day sent", icon: MessageCircle },
  { label: "KasiPay verified", value: "1", note: "0 pending", icon: ShieldCheck },
];

function ThemePreview({ compact }: { compact: boolean }) {
  return (
    <div className="flex min-h-[720px] overflow-hidden text-[var(--preview-text)]" style={{ background: "var(--preview-bg)", borderRadius: "var(--preview-radius)" }}>
      <aside className={`${compact ? "hidden" : "flex w-52"} shrink-0 flex-col text-[var(--preview-sidebar-text)]`} style={{ background: "var(--preview-sidebar)" }}>
        <div className="border-b border-white/15 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#263470_100%)] px-5 py-5 text-center">
          <p className="text-2xl font-black italic">KaSi<span style={{ color: "var(--preview-accent)" }}>HUB</span></p>
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[.22em]" style={{ color: "var(--preview-accent)" }}>Admin Portal</p>
        </div>
        <nav className="flex-1 space-y-1 bg-[linear-gradient(180deg,#0f172a_0%,#172554_52%,#263470_100%)] p-3">
          <p className="px-2 pb-2 text-[8px] font-bold uppercase opacity-50">Management</p>
          {PREVIEW_NAV.map(({ label, sub, icon: Icon }, index) => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: index === 0 ? "linear-gradient(135deg, #F97316 0%, #F58220 52%, #FB923C 100%)" : "transparent", borderRadius: "var(--preview-radius)" }}>
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase">{label}</p><p className="truncate text-[8px] opacity-65">{sub}</p></div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/15 p-3">
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] font-bold">Exco Administrator</p><p className="mt-1 text-[8px] opacity-65">KSI-TESTADMIN</p></div>
          <p className="mt-3 flex items-center gap-2 px-2 text-[9px]"><LogOut className="h-3 w-3" /> Sign out</p>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b px-4 text-white" style={{ background: "linear-gradient(90deg, #0f172a 0%, #172554 52%, #263470 100%)", borderColor: "#334155" }}>
          <div className="flex items-center gap-2">{compact && <Menu className="h-4 w-4" />}<div><p className="text-[8px] font-bold uppercase" style={{ color: "var(--preview-accent)" }}>Admin · Overview</p><p className="text-sm font-bold">Platform analytics</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden rounded-md px-3 py-1.5 text-[9px] font-bold sm:inline" style={{ background: "var(--preview-primary)", color: "white" }}>Member view</span><Bell className="h-4 w-4" /><span className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--preview-accent)" }}>TA</span></div>
        </header>

        <main className="p-4 sm:p-5">
          <div className="mb-5"><h2 className="text-xl font-black">Platform overview</h2><p className="text-[11px] text-[var(--preview-muted)]">Real-time analytics across the entire KaSiHUB ecosystem.</p></div>
          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4"}`}>
            {PRIMARY_METRICS.map(({ label, value, note, icon: Icon, tone }) => (
              <article key={label} className="border p-4" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)", boxShadow: "var(--theme-shadow)" }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: tone }}><Icon className="h-4 w-4" /></span>
                <p className="mt-6 text-[10px] text-[var(--preview-muted)]">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-5 text-[8px] text-[var(--preview-muted)]">{note}</p>
              </article>
            ))}
          </div>
          <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4"}`}>
            {SMALL_METRICS.map(({ label, value, note, icon: Icon }) => (
              <article key={label} className="flex min-h-20 items-center gap-3 border px-4 py-3" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)", boxShadow: "var(--theme-shadow)" }}>
                <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--preview-primary)" }} /><div><p className="text-[9px] text-[var(--preview-muted)]">{label}</p><p className="text-base font-black">{value}</p>{note && <p className="text-[8px] text-[var(--preview-muted)]">{note}</p>}</div>
              </article>
            ))}
          </div>
          <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-[2fr_1fr]"}`}>
            <article className="border p-5" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)" }}>
              <p className="text-sm font-bold">Member growth</p><p className="text-[9px] text-[var(--preview-muted)]">New registrations · last 14 days</p>
              <div className="mt-5 flex h-36 items-end gap-2 border-b border-dashed px-2" style={{ borderColor: "var(--preview-border)" }}>{[24, 34, 28, 52, 46, 74, 64, 88, 80, 96, 92, 112].map((height, index) => <span key={index} className="flex-1 rounded-t-sm opacity-85" style={{ height, background: "var(--preview-primary)" }} />)}</div>
            </article>
            <article className="border p-5" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)" }}>
              <p className="text-sm font-bold">Revenue by source</p><p className="text-[9px] text-[var(--preview-muted)]">All-time breakdown</p>
              <div className="mx-auto mt-5 h-28 w-28 rounded-full" style={{ background: `conic-gradient(var(--preview-primary) 0 48%, var(--preview-accent) 48% 76%, #00A878 76% 100%)` }}><div className="relative left-7 top-7 h-14 w-14 rounded-full" style={{ background: "var(--preview-surface)" }} /></div>
            </article>
          </div>
        </main>
      </section>
    </div>
  );
}
