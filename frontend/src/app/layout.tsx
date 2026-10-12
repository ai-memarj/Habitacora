import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
