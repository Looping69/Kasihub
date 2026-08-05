import type { Metadata } from "next";
import KasiPayInfoPage from "./[slug]/page";

export const metadata: Metadata = {
  title: "KaSiPayOne",
  description: "The free savings wallet that helps every rand go further.",
};

export default function KasiPayHome() {
  return KasiPayInfoPage({
    params: Promise.resolve({ slug: "gini" }),
  });
}
