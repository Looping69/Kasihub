import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KaSiHUB",
    short_name: "KaSiHUB",
    description: "Save more, earn more and access the KaSiHUB community ecosystem.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#263470",
    icons: [
      {
        src: "/icons/kasi-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/kasi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
