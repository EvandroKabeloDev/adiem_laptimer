import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADIEM Racing Live Timing",
    short_name: "ADIEM Timing",
    description:
      "ADIEM — Associação de Desenvolvimento e Incentivo de Esporte a Motor",
    start_url: "/",
    display: "standalone",
    background_color: "#07090c",
    theme_color: "#07090c",
    orientation: "landscape",
    icons: [
      {
        src: "/adiem-icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/adiem-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
