// Author: Klaasvaakie ( |╲ )
const PRIVATE_PRESALE_ORIGIN = "https://shares.kasihub.net";

export function privatePresaleInviteUrl(inviteToken: string): string {
  const url = new URL("/", PRIVATE_PRESALE_ORIGIN);
  url.searchParams.set("invite", inviteToken);
  return url.toString();
}
