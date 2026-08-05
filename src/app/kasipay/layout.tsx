// ( |╲ ) — Author: Klaasvaakie
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { KasiPayShell } from "./kasipay-shell";
import "./kasipay.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-kasipay-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: { default: "KaSiPay | Payments, Savings & Merchant Tools", template: "%s | KaSiPay" },
  description: "KaSiPay payment, merchant and savings-administration information delivered through an authorised custodian relationship.",
  icons: { icon: "/kasipay-assets/favicon/favicon-32x32.png" },
};

export default function KasiPayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={inter.variable}><KasiPayShell>{children}</KasiPayShell></div>;
}
