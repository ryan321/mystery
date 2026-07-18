import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.25rem" }}>
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "#9aafc4", fontSize: 12 }}>
        Mystery
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.2 }}>Can you solve a murder?</h1>
      <p style={{ color: "#9aafc4", lineHeight: 1.6 }}>
        Play vertical-slice cases against the game API. Marketing site still lives
        in <code>/web</code> for now.
      </p>
      <p>
        <Link href="/play">Start a case →</Link>
      </p>
    </main>
  );
}
