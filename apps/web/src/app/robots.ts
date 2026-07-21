import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Auth and in-play surfaces have no search value.
      disallow: ["/account", "/settings", "/my-mysteries", "/play/", "/signin/complete"],
    },
    sitemap: "https://mysterytrove.com/sitemap.xml",
  };
}
