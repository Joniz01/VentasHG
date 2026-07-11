import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import NavTabs from "@/components/NavTabs";
import PerfilMenu from "@/components/PerfilMenu";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const EMPRESA = process.env.EMPRESA_NOMBRE ?? "Hechizo Gourmet Polanco";
const EMPRESA_COLOR = process.env.EMPRESA_COLOR ?? "";

export const metadata: Metadata = {
  title: EMPRESA,
  description: "Control de productos, costos y ventas",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: EMPRESA,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#DBEAFE",
};

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');` }} />
        <header className="border-b border-zinc-200 bg-white" style={EMPRESA_COLOR ? { backgroundColor: EMPRESA_COLOR } : {}}>
          <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
            <Image src="/logo.jpg" alt="La Tequeñería Hechizo Gourmet" width={48} height={60} className="h-10 w-auto rounded-md sm:h-12" priority />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold sm:text-xl">{EMPRESA}</h1>
              <NavTabs rol={sesion?.rol ?? null} permisos={sesion?.permisos ?? null} />
            </div>
            {sesion && <PerfilMenu />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
