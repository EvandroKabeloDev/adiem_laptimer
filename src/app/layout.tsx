import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LapWiz RT004 | Live Timing",
  description: "LapWiz RT004 racing live timing MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}