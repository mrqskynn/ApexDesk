/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: false,
  serverExternalPackages: [],
  transpilePackages: ["lucide-react"],
};

module.exports = nextConfig;
