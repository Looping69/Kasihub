// Author: Klaasvaakie ( |╲ )
import Image from "next/image";

export default async function SiteLockPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07152f] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl shadow-black/40 backdrop-blur sm:p-10">
        <Image src="/icons/kasi-icon-192.png" alt="KaSiHUB" width={72} height={72} priority className="mx-auto h-18 w-18 rounded-2xl" />
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.28em] text-amber-300">Private access</p>
        <h1 className="mt-3 text-center text-3xl font-black">KaSiHUB is temporarily locked</h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-300">Enter the temporary access PIN to continue.</p>
        <form action="/api/site-lock/unlock" method="post" className="mt-7 space-y-4">
          <input type="hidden" name="next" value={query.next ?? "/"} />
          <label className="block text-sm font-semibold" htmlFor="pin">Access PIN</label>
          <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} required autoFocus className="h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-center text-xl tracking-[0.5em] outline-none focus:border-amber-300" />
          {query.error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/50 p-3 text-sm text-red-100">Incorrect PIN. Try again.</p>}
          <button type="submit" className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-black uppercase text-slate-950 hover:brightness-110">Unlock site</button>
        </form>
      </section>
    </main>
  );
}
