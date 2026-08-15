// Author: Klaasvaakie ( |╲ )
import { redirect } from "next/navigation";

export default async function LegacyPresaleInvitationPage({
  params,
}: {
  params: Promise<{ invite: string }>;
}) {
  const { invite } = await params;
  redirect(`/presale?invite=${encodeURIComponent(invite)}`);
}
