import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Avoid the dev server's export-path check for URL-encoded site IDs.
  // Production builds still generate the complete static export.
  ...(phase !== PHASE_DEVELOPMENT_SERVER ? { output: "export" } : {}),
  allowedDevOrigins: ["127.0.0.1"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
});

export default nextConfig;
