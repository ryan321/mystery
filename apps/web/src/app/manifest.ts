import type { MetadataRoute } from "next";

// PWA manifest — Android Chrome uses this for the install/home-screen
// name and icons (iOS uses apple-icon.png + appleWebApp.title instead).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MysteryTrove",
    short_name: "MysteryTrove",
    description:
      "Handcrafted whodunits with real, sealed solutions. Question a living cast, search the scene, and accuse when you are ready.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080e",
    theme_color: "#05080e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
