import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "WM Studio Collective — Independent by design",
    template: "%s | WM Studio Collective",
  },
  description:
    "Een onafhankelijke kijk op de garderobe van morgen. WM Studio Collective. Ontwikkelomgeving met fictieve producten.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
