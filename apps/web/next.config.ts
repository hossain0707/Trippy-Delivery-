import type { NextConfig } from "next";
// Frontend-only static export; API lives separately on Cloud Run.
const nextConfig: NextConfig = { reactStrictMode: true, output: "export" };
export default nextConfig;
