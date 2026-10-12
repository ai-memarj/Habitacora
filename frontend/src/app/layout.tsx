import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Bitácora",
  description: "Seguimiento de hábitos, objetivos y salud mental",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Clase "dark" fija por ahora: arrancamos en modo oscuro por defecto,
    // tal como se pidió (estética Vercel/Linear). Cuando añadamos un toggle
    // de tema real (next-themes), esta clase pasará a gestionarse en cliente.
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
