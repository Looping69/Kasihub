// Author: Klaasvaakie ( |╲ )
import type { Metadata } from "next";
import { SharesAccountClient } from "./shares-account-client";

export const metadata: Metadata = {
  title: "KaSiShares Applicant & Shareholder Account",
  description: "Continue a private KaSiShares application and view issued campaign allocations and certificates.",
  robots: { index: false, follow: false },
};

export default function SharesAccountPage() {
  return <SharesAccountClient />;
}
