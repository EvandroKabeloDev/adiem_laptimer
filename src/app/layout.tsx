import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADIEM | Racing Live Timing",

  description:
    "ADIEM — Associação de Desenvolvimento e Incentivo de Esporte a Motor. Racing Live Timing.",

  icons: {
    icon: "/adiem-icon.png",
    apple: "/adiem-icon.png",
  },

  appleWebApp: {
    capable: true,
    title: "ADIEM Timing",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
