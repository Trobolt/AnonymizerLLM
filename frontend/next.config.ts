import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig: NextConfig = {
  // Static export for Electron production: generates plain HTML/CSS/JS loadable via file://
  output: isExport ? 'export' : undefined,

  // Make all asset paths relative so file:// loading works in Electron
  assetPrefix: isExport ? './' : undefined,

  // Ensure each route generates an index.html (required for file:// navigation)
  trailingSlash: isExport ? true : undefined,

  // Environment variables for API communication mode
  env: {
    NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE || 'http',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000',
  },
};

export default nextConfig;
