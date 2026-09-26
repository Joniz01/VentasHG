import { requirePermiso } from "@/lib/auth";
import CajaClient from "@/components/CajaClient";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Caja Rápida — Hechizo Gourmet",
  appleWebApp: {
    capable: true,
    title: "Caja Rápida HG",
    statusBarStyle: "black-translucent",
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#1C1C1E",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default async function CajaPage() {
  await requirePermiso("ventas");
  return <CajaClient />;
}
