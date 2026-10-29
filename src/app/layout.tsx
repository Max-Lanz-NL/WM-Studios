import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Studio MW — Independent by design",
    template: "%s | Studio MW",
  },
  description:
    "Een onafhankelijke kijk op de garderobe van morgen. Studio MW. Ontwikkelomgeving met fictieve producten.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
