import type { Metadata } from "next";
import { AdminDesignSuite } from "@/components/admin/admin-design-suite";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "KaSiHUB Look & Feel Preview",
  description: "Frontend-only colour workshop for the KaSiHUB admin shell.",
};

export default function LookAndFeelPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-28 items-center rounded-xl bg-[#0569BD] px-3">
              <BrandLogo className="h-12 w-full" priority />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Visual workshop</p>
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Admin shell colour concept</h1>
              <p className="text-sm text-slate-500">No login required. Nothing here changes the live KaSiHUB platform.</p>
            </div>
          </div>
          <div className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:self-auto">
            Frontend-only handoff
          </div>
        </header>

        <AdminDesignSuite />
      </div>
    </main>
  );
}
