import type { Metadata } from "next";
import TopNav from "../components/TopNav";
import AmbienceProvider from "../components/AmbienceProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystery",
  description: "Handcrafted interactive mysteries you investigate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AmbienceProvider>
          <TopNav />
          {children}
        </AmbienceProvider>
      </body>
    </html>
  );
}
