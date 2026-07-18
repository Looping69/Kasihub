// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type WalletResponse = {
  transactions: { id: string; type: string; amount: number; description: string; status: string; createdAt: string }[];
};
type ProfileResponse = {
  member: {
    id: string;
    subscriptionAmount: number;
    subscriptionCurrency: string;
    subscriptionStatus: string;
    paymentMethod: string | null;
    createdAt: string;
  };
};

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const [wallet, profile] = await Promise.all([
      encoreRequest<WalletResponse>(`/wallets/me/${encodeURIComponent(memberId)}`, {}, token),
      encoreRequest<ProfileResponse>("/profiles/me", {}, token),
    ]);
    if (profile.member.id !== memberId) return NextResponse.json({ error: "Member identity mismatch" }, { status: 403 });
    const totalCredits = wallet.transactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalDebits = wallet.transactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    return NextResponse.json({
      transactions: wallet.transactions,
      subscriptions: [{
        id: `encore-${profile.member.id}`,
        amount: profile.member.subscriptionAmount,
        currency: profile.member.subscriptionCurrency,
        method: profile.member.paymentMethod ?? "PENDING",
        status: profile.member.subscriptionStatus,
        period: profile.member.createdAt.slice(0, 7),
        createdAt: profile.member.createdAt,
      }],
      totalCredits,
      totalDebits,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load transactions from Encore" }, { status });
  }
}
