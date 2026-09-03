import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./action-buttons-v2.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeRuntime } from "@/components/theme-runtime";
import { ThemeProvider } from "@/components/theme-provider";

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KaSiHUB — Hybrid Ecosystem for Community Wealth",
  description: "KaSiHUB is the central point of a hybrid ecosystem connecting members to shares, marketplace, mall, and the Roots CO-OP Bank.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icons/kasi-icon-180-ios.png", sizes: "180x180", type: "image/png" }],
  },
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
        className={`${interSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <ThemeRuntime />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
