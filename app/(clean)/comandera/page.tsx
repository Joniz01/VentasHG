import { requirePermiso } from "@/lib/auth";
import ComandaClient from "@/components/ComandaClient";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comandera — Hechizo Gourmet",
  appleWebApp: {
    capable: true,
    title: "Comandera HG",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default async function ComandaPage() {
  await requirePermiso("pedidosPendientes");

  return <ComandaClient />;
}
