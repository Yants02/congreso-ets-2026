import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "boxicons/css/boxicons.min.css";
import "sweetalert2/dist/sweetalert2.min.css";
import SweetAlertProvider from "@/components/SweetAlertProvider";
import FrontendThemeProvider from "@/components/FrontendThemeProvider";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "1er Congreso de Educación Técnica Superior - ETS 2026",
  description:
    "Plataforma integral de gestión, acreditación con QR criptográfico y control del Congreso ETS 2026 - Auditorio Polo Saavedra / DETS",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#005691",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#005691" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${archivo.className} antialiased`} suppressHydrationWarning>
        <SweetAlertProvider />
        <FrontendThemeProvider />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch((err) => console.log('SW registration fail:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
