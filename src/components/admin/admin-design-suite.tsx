"use client";

// Author: Klaasvaakie ( |╲ )
import { useEffect, useMemo, useState } from "react";
import { Check, History, LayoutTemplate, Loader2, Monitor, Palette, RotateCcw, Save, Smartphone, Tablet, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_THEME, applyTheme, type AppTheme } from "@/lib/theme";

type ThemeVersion = { version: number; status: string; theme: AppTheme; createdAt: string };
const COLOR_FIELDS: { key: keyof AppTheme; label: string }[] = [
  { key: "primary", label: "Primary" }, { key: "accent", label: "Accent" },
  { key: "background", label: "Background" }, { key: "surface", label: "Surface" },
  { key: "text", label: "Text" }, { key: "mutedText", label: "Muted text" },
  { key: "border", label: "Border" }, { key: "sidebar", label: "Sidebar" },
  { key: "sidebarText", label: "Sidebar text" },
];

export function AdminDesignSuite() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);
  const [published, setPublished] = useState<AppTheme>(DEFAULT_THEME);
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    const response = await fetch("/api/admin/design", { cache: "no-store" });
    if (!response.ok) return toast.error("Unable to load the design suite");
    const data = await response.json();
    setPublished(data.active ?? DEFAULT_THEME);
    setTheme(data.versions?.find((item: ThemeVersion) => item.status === "draft")?.theme ?? data.active ?? DEFAULT_THEME);
    setVersions(data.versions ?? []);
  }
  async function save(action: "draft" | "publish") {
    setSaving(action);
    try {
      const response = await fetch("/api/admin/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, theme }) });
      if (!response.ok) throw new Error();
      if (action === "publish") { setPublished(theme); applyTheme(theme); }
      toast.success(action === "publish" ? "Theme published across KaSiHUB" : "Draft saved");
      await load();
    } catch { toast.error("The theme could not be saved"); }
    finally { setSaving(null); }
  }
  const previewStyle = useMemo(() => ({
    "--preview-primary": theme.primary, "--preview-accent": theme.accent, "--preview-bg": theme.background,
    "--preview-surface": theme.surface, "--preview-text": theme.text, "--preview-muted": theme.mutedText,
    "--preview-border": theme.border, "--preview-sidebar": theme.sidebar, "--preview-sidebar-text": theme.sidebarText,
    "--preview-radius": `${theme.radius}px`, fontSize: `${theme.fontScale}rem`,
  }) as React.CSSProperties, [theme]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-2xl font-bold tracking-tight">Design Suite</h2><p className="text-sm text-muted-foreground">Control the visual language of every KaSiHUB experience.</p></div>
      <div className="inline-flex items-center gap-2 self-start rounded-md border bg-card px-3 py-2 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Published theme: {published.name}</div>
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
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-card p-4"><Button variant="outline" onClick={() => setTheme(published)}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button><Button variant="outline" disabled={!!saving} onClick={() => save("draft")}><Save className="mr-2 h-4 w-4" />Save draft</Button><Button className="col-span-2" disabled={!!saving} onClick={() => save("publish")}>{saving === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Publish theme</Button></div>
      </section>
      <section className="min-w-0 bg-muted/20 p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Live preview</h3><p className="text-xs text-muted-foreground">Draft changes stay isolated here until publication.</p></div><div className="flex rounded-md border bg-card p-1">{([{ key: "desktop", icon: Monitor }, { key: "tablet", icon: Tablet }, { key: "mobile", icon: Smartphone }] as const).map(({ key, icon: Icon }) => <button key={key} aria-label={key} onClick={() => setViewport(key)} className={`rounded px-3 py-1.5 ${viewport === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Icon className="h-4 w-4" /></button>)}</div></div>
        <div className={`mx-auto overflow-hidden border bg-white transition-all ${viewport === "desktop" ? "w-full" : viewport === "tablet" ? "max-w-[760px]" : "max-w-[390px]"}`} style={{ ...previewStyle, borderRadius: theme.radius + 2 }}><ThemePreview compact={viewport === "mobile"} /></div>
        <div className="mt-6 overflow-hidden rounded-lg border bg-card"><div className="flex items-center gap-2 border-b px-4 py-3"><History className="h-4 w-4" /><h3 className="text-sm font-semibold">Version history</h3></div><div className="divide-y">{versions.length ? versions.slice(0, 5).map((item) => <div key={item.version} className="grid grid-cols-[70px_85px_1fr] items-center gap-3 px-4 py-3 text-xs"><strong>v{item.version}</strong><span className={item.status === "published" ? "text-emerald-700" : item.status === "draft" ? "text-orange-600" : "text-muted-foreground"}>{item.status}</span><span className="truncate text-muted-foreground">{item.theme.name} · {new Date(item.createdAt).toLocaleString()}</span></div>) : <p className="px-4 py-6 text-center text-xs text-muted-foreground">Publish the first theme to begin version history.</p>}</div></div>
      </section>
    </div>
  </div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="grid grid-cols-[92px_42px_1fr] items-center gap-2"><Label className="text-xs">{label}</Label><Input aria-label={`${label} color`} type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 p-1" /><Input aria-label={`${label} hex`} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 font-mono text-xs" /></div>; }
function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <div className="space-y-2"><div className="flex justify-between"><Label>{label}</Label><span className="text-xs text-muted-foreground">{value}{suffix}</span></div><input className="w-full accent-[var(--primary)]" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>; }
function ThemePreview({ compact }: { compact: boolean }) { return <div className="flex min-h-[500px] text-[var(--preview-text)]" style={{ background: "var(--preview-bg)", borderRadius: "var(--preview-radius)" }}><aside className={`${compact ? "w-16" : "w-16 sm:w-44"} shrink-0 p-4 text-[var(--preview-sidebar-text)]`} style={{ background: "var(--preview-sidebar)" }}><p className="font-black">K<span className="text-[var(--preview-accent)]">H</span></p><div className="mt-8 space-y-2">{["Dashboard", "Wallet", "Shares", "Marketplace", "Settings"].map((item, index) => <div key={item} className="rounded-md px-2 py-2 text-xs" style={{ background: index === 0 ? "var(--preview-accent)" : "transparent" }}><span className={compact ? "hidden" : "hidden sm:inline"}>{item}</span><span className={compact ? "inline" : "sm:hidden"}>{item[0]}</span></div>)}</div></aside><main className="min-w-0 flex-1 p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><div><p className="text-lg font-bold">Welcome back</p><p className="text-xs text-[var(--preview-muted)]">Your KaSiHUB ecosystem at a glance.</p></div><button className="shrink-0 rounded-md px-3 py-2 text-xs text-white" style={{ background: "var(--preview-primary)" }}>View wallet</button></div><div className={`mt-6 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>{["Wallet balance", "KasiShares", "Pool earnings"].map((label, index) => <div key={label} className="min-w-0 border p-4" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)" }}><p className="text-xs text-[var(--preview-muted)]">{label}</p><p className="mt-2 break-words font-bold">{index ? "24 active" : "R 12,840.00"}</p></div>)}</div><div className="mt-4 border p-4" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-border)", borderRadius: "var(--preview-radius)" }}><p className="font-semibold">Recent activity</p>{["Membership confirmed", "Wallet contribution", "Share certificate issued"].map((item) => <div key={item} className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs" style={{ borderColor: "var(--preview-border)" }}><span>{item}</span><span className="shrink-0 text-[var(--preview-muted)]">Today</span></div>)}</div></main></div>; }
