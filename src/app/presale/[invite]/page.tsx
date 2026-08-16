// Author: Klaasvaakie ( |╲ )
import { redirect } from "next/navigation";

/** Preserve existing private invitation links while the canonical query route remains authoritative. */
export default async function LegacyPresaleInvitePage({
  params,
}: {
  params: Promise<{ invite: string }>;
}) {
  const { invite } = await params;
  redirect(`/presale?invite=${encodeURIComponent(invite)}`);
}
