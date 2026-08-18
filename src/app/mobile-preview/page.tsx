import { notFound } from "next/navigation";

type MobilePreviewPageProps = {
  searchParams: Promise<{ layout?: string; path?: string }>;
};

export default async function MobilePreviewPage({ searchParams }: MobilePreviewPageProps) {
  if (process.env.NODE_ENV === "production") notFound();

  const { layout, path } = await searchParams;
  const previewPath = path?.startsWith("/") && !path.startsWith("//") ? path : "/";
  const tablet = layout === "tablet";

  return (
    <main className="min-h-screen bg-[#07111d] px-4 sm:p-6">
      <div className={`mx-auto flex min-h-screen w-full flex-col overflow-hidden bg-white shadow-2xl shadow-black/60 sm:border-[8px] sm:border-slate-950 ${tablet ? "max-w-[768px] sm:min-h-[1024px] sm:rounded-[24px]" : "max-w-[390px] sm:min-h-[844px] sm:rounded-[28px]"}`}>
        <iframe
          title={`KaSiHub ${tablet ? "tablet" : "mobile"} preview`}
          src={previewPath}
          className={`h-screen w-full flex-1 border-0 bg-white ${tablet ? "min-h-[1024px]" : "min-h-[844px]"}`}
        />
      </div>
    </main>
  );
}
