import type { Metadata } from "next";
import { getCase } from "../../../lib/api";
import MysteryDetail from "./MysteryDetail";

/**
 * Server shell: per-case SEO/social metadata, client component does the rest.
 * Private cases 404 here (no session) — they fall back to a generic card,
 * which is exactly what we want crawlers to see.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const c = await getCase(id);
    const description =
      c.meta.premise ??
      c.meta.summary ??
      "An interactive whodunit from the MysteryTrove gallery.";
    return {
      title: c.meta.title,
      description,
      openGraph: {
        title: c.meta.title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title: c.meta.title,
        description,
      },
    };
  } catch {
    return {
      title: "Mystery",
      description: "An interactive whodunit from MysteryTrove.",
    };
  }
}

export default function MysteryPage() {
  return <MysteryDetail />;
}
