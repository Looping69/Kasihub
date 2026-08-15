import { notFound } from "next/navigation";

export default function MobilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-[#07111d] px-4 sm:p-6">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col overflow-hidden bg-white shadow-2xl shadow-black/60 sm:min-h-[844px] sm:rounded-[28px] sm:border-[8px] sm:border-slate-950">
        <iframe
          title="KaSiHub mobile preview"
          src="/"
          className="h-screen min-h-[844px] w-full flex-1 border-0 bg-white"
        />
      </div>
    </main>
  );
}
