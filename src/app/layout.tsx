import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADIEM | Racing Live Timing",
  description:
    "ADIEM — Associação de Desenvolvimento e Incentivo de Esporte a Motor. Racing Live Timing.",
  icons: {
    icon: "/adiem-icon.png",
  },
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
