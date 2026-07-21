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

export const metadata: Metadata = {
  title: "MysteryTrove",
  description: "Handcrafted interactive mysteries you investigate.",
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
