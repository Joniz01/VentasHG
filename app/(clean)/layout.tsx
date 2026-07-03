import { Geist } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function CleanLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} antialiased`}>
      <body className="bg-white text-zinc-900">{children}</body>
    </html>
  );
}
