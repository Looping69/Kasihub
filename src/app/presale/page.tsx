// Author: Klaasvaakie ( |╲ )
import type { Metadata } from "next";
import { isLocalPresalePreviewRequested } from "@/lib/presale-dev-preview";
import { PresaleClient } from "./presale-client";

export const metadata: Metadata = {
  title: "Private KaSiShares Presale | KaSiHUB",
  description: "Invitation-only KaSiShares reservation and USDT settlement.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PresalePage({ searchParams }: { searchParams: Promise<{ invite?: string; devPreview?: string }> }) {
  const { invite = "", devPreview } = await searchParams;
  // This is deliberately server-gated. It never exists in a deployed build.
  // Author: Klaasvaakie ( |╲ )
  const readOnlyPreview = isLocalPresalePreviewRequested(devPreview);
  return <PresaleClient inviteToken={invite} devPreview={readOnlyPreview} />;
}
