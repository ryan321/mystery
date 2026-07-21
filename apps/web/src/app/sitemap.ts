import type { MetadataRoute } from "next";
import { listCases } from "../lib/api";

const BASE = "https://mysterytrove.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/gallery",
    "/help",
    "/signin",
    "/signup",
  ].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  // Public gallery cases only — listCases never returns private ones.
  let caseRoutes: MetadataRoute.Sitemap = [];
  try {
    const cases = await listCases();
    caseRoutes = cases.map((c) => ({
      url: `${BASE}/mystery/${c.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    // The static routes still ship if the API is unreachable at request time.
  }

  return [...staticRoutes, ...caseRoutes];
}
