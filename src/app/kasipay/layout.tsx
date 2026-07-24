// ( |╲ ) — Author: Klaasvaakie
import type { Metadata } from "next";
import { KasiPayShell } from "./kasipay-shell";
import "./kasipay.css";

export const metadata: Metadata = {
  title: { default: "KasiPay | Payments, Savings & Merchant Tools", template: "%s | KasiPay" },
  description: "KasiPay payment, merchant and savings-administration information powered through an authorised InstaPay custodian relationship.",
  icons: { icon: "/kasipay-assets/favicon/favicon-32x32.png" },
};

export default function KasiPayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <KasiPayShell>{children}</KasiPayShell>;
}
