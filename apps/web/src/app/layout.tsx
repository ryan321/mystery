import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
