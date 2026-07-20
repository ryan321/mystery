import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystery Studio",
  description: "Local authoring tool for mystery definitions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="top">
          <Link href="/" className="brand">
            Mystery <span>Studio</span>
          </Link>
          <span className="crumb">definition authoring &amp; review</span>
          <span className="spacer" />
          <span className="env">local only</span>
        </div>
        {children}
      </body>
    </html>
  );
}
