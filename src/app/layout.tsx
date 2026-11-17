import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "E-Club Projects", template: "%s · E-Club Projects" },
  description: "The Entrepreneurship Club’s project application and review portal at Ashoka University.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
