// ( |╲ ) — Author: Klaasvaakie
import type { Metadata } from "next";
import { KasiPayShell } from "./kasipay-shell";
import "./kasipay.css";

export const metadata: Metadata = {
  title: { default: "KaSiPay | Payments, Savings & Merchant Tools", template: "%s | KaSiPay" },
  description: "KaSiPay payment, merchant and savings-administration information delivered through an authorised custodian relationship.",
  icons: { icon: "/kasipay-assets/favicon/favicon-32x32.png" },
};

export default function KasiPayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <KasiPayShell>{children}</KasiPayShell>;
}
