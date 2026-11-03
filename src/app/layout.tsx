import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Studio MW — Independent by design",
    template: "%s | Studio MW",
  },
  description:
    "An independent perspective on tomorrow’s wardrobe. Studio MW. Test store with fictional products.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
