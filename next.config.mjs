/** @type {import('next').NextConfig} */
const buildTarget = process.env.BUILD_TARGET;

const nextConfig = {
  ...(buildTarget === "api"
    ? {
        output: "standalone",
        // Microsoft OAuth callback has no trailing slash; avoid 308 that CDN may cache.
        skipTrailingSlashRedirect: true,
      }
    : {}),
  ...(buildTarget === "static" ? { output: "export" } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
