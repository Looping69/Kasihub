// Author: Klaasvaakie ( |╲ )
import type { Metadata } from "next";
import { SharesAccountClient } from "./shares-account-client";

export const metadata: Metadata = {
  title: "KaSiShares Applicant Account",
  description: "Continue a private KaSiShares application and track verification progress.",
  robots: { index: false, follow: false },
};

export default function SharesAccountPage() {
  return <SharesAccountClient />;
}
