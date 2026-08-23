// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { requireEcosystemProfileAccess } from "../auth/access";
import { myProfile } from "../identity/api";
import { walletMe } from "../wallets/api";
import { memberDownline } from "../network/api";
import { listSharePhases, myShares } from "../shares/api";

interface DashboardBundle {
  profile: { member: {
    id: string; profileNumber: string; membershipType: string; firstName: string | null; lastName: string | null;
    companyName: string | null; companyRegNo: string | null; idPassport: string | null; sarsNumber: string | null;
    email: string; country: string; mobile: string; addressLine: string | null; city: string | null; postalCode: string | null;
    profilePicture: string | null; beneficiaryName: string | null; beneficiaryId: string | null; guardianName: string | null;
    kycStatus: string; kycVerifiedAt: string | null; subscriptionStatus: string; subscriptionAmount: number;
    subscriptionCurrency: string; paymentMethod: string | null; taxThreshold: boolean; monthlyEarnings: number;
    nfcTagId: string | null; visaCardLast4: string | null; rootsBankAccount: string | null; citizenshipType: string | null;
    instapayStatus: string; instapayVerifiedAt: string | null; instapayAccountRef: string | null;
    uplineProfileNumber: string | null; uplineConfirmed: boolean; isAdmin: boolean; createdAt: string;
  } };
  wallet: { balance: string; currency: string; transactions: { id: string; type: string; amount: number; description: string; status: string; createdAt: string }[] };
  matrix: { nodes: { id: string; profileId: string; parentNodeId: string | null; sponsorProfileId: string | null; positionIndex: number; depth: number; path: string }[] };
  shares: { certificates: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt: string | null }[] };
  phases: { phases: { id: string; phaseNumber: number; quantityAvailable: number; pricePerShare: string; currency: string; status: string; totalShares?: number; bonusBuyOneGet?: boolean; createdAt?: string; updatedAt?: string }[] };
}

export const dashboardBundle = api<{ profileId: string }, DashboardBundle>(
  { method: "GET", path: "/dashboard/:profileId", expose: true },
  async ({ profileId }) => {
    await requireEcosystemProfileAccess(profileId);
    const [profile, wallet, matrix, shares, phases] = await Promise.all([
      myProfile(),
      walletMe({ profileId }),
      memberDownline({ profileId }),
      myShares({ profileId }),
      listSharePhases(),
    ]);
    return { profile, wallet, matrix, shares, phases };
  },
);
