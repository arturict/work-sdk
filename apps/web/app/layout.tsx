import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteAnalytics } from "@/components/site-analytics";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { discoveryAlternates, site } from "@/lib/site";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: "Work SDK contributors" }],
  creator: "Work SDK contributors",
  publisher: "Work SDK contributors",
  category: "Developer tools",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  keywords: [
    "TypeScript SDK",
    "GitHub Issues",
    "GitLab",
    "Linear",
    "Jira",
    "Azure DevOps",
    "AI agents",
    "agent tools",
    "issue tracker",
  ],
  alternates: { types: discoveryAlternates },
  openGraph: {
    type: "website",
    url: "/",
    title: site.title,
    description: site.description,
    siteName: site.name,
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Work SDK — agent-safe TypeScript SDK for every work tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070a18",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body>
        <RootProvider theme={{ enabled: false }}>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
          <SiteAnalytics />
        </RootProvider>
      </body>
    </html>
  );
}
