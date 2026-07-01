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

/** Runs before React so a hard refresh on /travel still reaches /travel/. */
const TRAILING_SLASH_BOOTSTRAP = `
(function () {
  var path = location.pathname;
  if (path.length > 1 && path.charAt(path.length - 1) !== "/" && path.indexOf("/api/") !== 0) {
    var last = path.slice(path.lastIndexOf("/") + 1);
    if (last.indexOf(".") === -1) location.replace(path + "/" + location.search + location.hash);
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {!isApiBuild && (
          <script dangerouslySetInnerHTML={{ __html: TRAILING_SLASH_BOOTSTRAP }} />
        )}
        {isApiBuild ? children : <ClientProviders>{children}</ClientProviders>}
      </body>
    </html>
  );
}
