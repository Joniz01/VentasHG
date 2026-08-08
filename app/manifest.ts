import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hechizo Gourmet ERP",
    short_name: "HG ERP",
    description: "Control de productos, costos y ventas",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      {
        src: "/icons/icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
