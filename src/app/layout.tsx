import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KaSiHUB — Hybrid Ecosystem for Community Wealth",
  description: "KaSiHUB is the central point of a hybrid ecosystem connecting members to shares, marketplace, mall, and the Roots CO-OP Bank.",
  keywords: ["KaSiHUB", "KasiHub", "Roots Bank", "KasiShares", "KasiMall", "KasiMarketPlace", "community wealth", "South Africa"],
  authors: [{ name: "Solidus Holdings (Pty) Ltd" }],
  openGraph: {
    title: "KaSiHUB — Hybrid Ecosystem",
    description: "Join the KaSiHUB ecosystem. Members, shares, marketplace, mall and Roots Bank — all in one app.",
    siteName: "KaSiHUB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KaSiHUB — Hybrid Ecosystem",
    description: "Join the KaSiHUB ecosystem. Members, shares, marketplace, mall and Roots Bank — all in one app.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <Script
          src="https://2090ba837d3c653d95.v2.appdeploy.ai/kasi-feedback-widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
