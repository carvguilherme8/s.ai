import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Cabecalho } from "./cabecalho";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "s.ai",
  description: "Descubra onde sua turma está travando e o que revisar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* usePathname() é dado de requisição: precisa de Suspense. O substituto tem a altura da barra para não haver salto. */}
        <Suspense fallback={<div aria-hidden className="h-[3.25rem] bg-bar" />}>
          <Cabecalho />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
