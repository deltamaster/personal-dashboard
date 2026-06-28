/** @type {import('next').NextConfig} */
const buildTarget = process.env.BUILD_TARGET;

const nextConfig = {
  ...(buildTarget === "api" ? { output: "standalone" } : {}),
  ...(buildTarget === "static" ? { output: "export" } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
