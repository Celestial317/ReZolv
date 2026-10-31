import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReZolv",
    short_name: "ReZolv",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f7f6",
    theme_color: "#0f6b5e",
    icons: [],
  };
}
