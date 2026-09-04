import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import ShellBar from "@/components/ShellBar";
import SidebarNav from "@/components/SidebarNav";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import { ThemeProvider } from "@/lib/theme-context";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const EMPRESA = process.env.EMPRESA_NOMBRE ?? "Hechizo Gourmet Polanco";

export const metadata: Metadata = {
  title: EMPRESA,
  description: "Control de productos, costos y ventas",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192-v2.png",
    apple: "/icons/icon-192-v2.png",
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
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Restore saved theme before React hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('erp-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body
        className="min-h-full"
        style={{ background: "var(--erp-bg)", color: "var(--erp-text)" }}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`,
          }}
        />
        <ThemeProvider>
          {/* Shell bar — fixed, h-12 (48px) */}
          <ShellBar sesionActiva={!!sesion} empresa={EMPRESA} />

          {/* Sidebar — fixed left, starts below shell */}
          <SidebarNav
            rol={sesion?.rol ?? null}
            permisos={sesion?.permisos ?? null}
          />

          {/* Content — padded to clear shell (pt-12) and sidebar (dynamic via --sidebar-w CSS var set by SidebarNav) */}
          <main
            id="erp-main"
            className="min-h-screen pt-12 px-5 py-6"
            style={{ background: "var(--erp-bg)" }}
          >
            <Breadcrumb />
            <BackButton />
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
