// Author: Klaasvaakie ( |╲ )
import type { Metadata } from "next";
import { PresaleClient } from "./presale-client";

export const metadata: Metadata = {
  title: "Private KaSiShares Presale | KaSiHUB",
  description: "Invitation-only KaSiShares reservation and USDT settlement.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PresalePage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite = "" } = await searchParams;
  return <PresaleClient inviteToken={invite} />;
}
