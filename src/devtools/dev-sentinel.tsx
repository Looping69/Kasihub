"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, ChevronDown, Clipboard, Trash2, X } from "lucide-react";
import { faultPacket } from "./sentinel-core";
import { useFaultStore, type DevFault } from "./fault-store";

const tone = {
  critical: "border-red-500 bg-red-950 text-red-50",
  error: "border-red-500 bg-red-950 text-red-50",
  warning: "border-amber-500 bg-amber-950 text-amber-50",
  info: "border-sky-500 bg-sky-950 text-sky-50",
};

async function copyFault(fault: DevFault, faults: DevFault[]) {
  await navigator.clipboard.writeText(JSON.stringify(faultPacket(fault, faults), null, 2));
}

export function DevSentinel() {
  const faults = useFaultStore((state) => state.faults);
  const dismiss = useFaultStore((state) => state.dismiss);
  const clear = useFaultStore((state) => state.clear);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string>();
  const counts = useMemo(() => ({
    errors: faults.filter((fault) => fault.severity === "error" || fault.severity === "critical").length,
    warnings: faults.filter((fault) => fault.severity === "warning").length,
    network: faults.filter((fault) => fault.source === "network").length,
    api: faults.filter((fault) => fault.source === "api").length,
  }), [faults]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(undefined), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[2147483647] font-mono text-xs" aria-label="Development diagnostics">
      {open && (
        <div className="mb-3 flex max-h-[70vh] w-[min(31rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
          <header className="flex items-center justify-between border-b border-slate-800 p-3">
            <div><div className="font-bold tracking-wider">DEV SENTINEL</div><div className="mt-1 text-slate-400">{counts.errors} errors · {counts.warnings} warnings · {counts.api} API · {counts.network} network</div></div>
            <div className="flex gap-2"><button type="button" title="Clear timeline" onClick={clear}><Trash2 className="h-4 w-4" /></button><button type="button" title="Close" onClick={() => setOpen(false)}><ChevronDown className="h-4 w-4" /></button></div>
          </header>
          <div className="overflow-y-auto p-2">
            {faults.length === 0 && <div className="p-6 text-center text-slate-500">No captured faults.</div>}
            {faults.map((fault) => (
              <article key={fault.id} className={`mb-2 rounded-lg border-l-4 p-3 ${tone[fault.severity]}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-bold">{fault.title}</div><div className="mt-1 break-words opacity-90">{fault.message}</div></div><button type="button" title="Dismiss" onClick={() => dismiss(fault.id)}><X className="h-4 w-4" /></button></div>
                <div className="mt-2 opacity-60">{new Date(fault.timestamp).toLocaleTimeString()} · {fault.source}{fault.requestId ? ` · ${fault.requestId}` : ""}</div>
                <button type="button" className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => { void copyFault(fault, faults); setCopied(fault.id); }}><Clipboard className="h-3 w-3" />{copied === fault.id ? "Copied" : "Ask Sani"}</button>
              </article>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex items-center gap-2 rounded-full border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 shadow-xl hover:bg-slate-900" aria-expanded={open}>
        <Bug className="h-4 w-4" /><span>DEV</span>{faults.length > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">{faults.length}</span>}
      </button>
    </aside>
  );
}
