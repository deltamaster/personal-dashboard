import type { Metadata, Viewport } from "next";
import { ClientProviders } from "@/components/client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
  description: "Portfolio, travel, and movies",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const isApiBuild = process.env.BUILD_TARGET === "api";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {isApiBuild ? children : <ClientProviders>{children}</ClientProviders>}
      </body>
    </html>
  );
}
