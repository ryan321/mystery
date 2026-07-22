import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import TopNav from "../components/TopNav";
import AmbienceProvider from "../components/AmbienceProvider";
import "./globals.css";

const displayFont = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});
const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
});
const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
});

const SITE_DESCRIPTION =
  "Handcrafted whodunits with real, sealed solutions. Question a living cast, search the scene, and accuse when you are ready.";

export const metadata: Metadata = {
  // Canonical origin — OG/Twitter image URLs resolve against this.
  metadataBase: new URL("https://mysterytrove.com"),
  title: {
    default: "MysteryTrove — interactive whodunits",
    template: "%s · MysteryTrove",
  },
  description: SITE_DESCRIPTION,
  // Label shown under the icon when saved to the iOS home screen.
  appleWebApp: {
    title: "MysteryTrove",
  },
  openGraph: {
    siteName: "MysteryTrove",
    type: "website",
    title: "MysteryTrove — interactive whodunits",
    description: SITE_DESCRIPTION,
    // images: app/opengraph-image.jpg is picked up by file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: "MysteryTrove — interactive whodunits",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body>
        <AmbienceProvider>
          <TopNav />
          {children}
        </AmbienceProvider>
      </body>
    </html>
  );
}
