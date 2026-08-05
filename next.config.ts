import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Keep optimized variants on the CDN for a full year — avoid constant re-encode MISSes.
    minimumCacheTTL: 31536000,
    formats: ["image/webp"],
    // Cap generated widths — fewer `/_next/image` variants if next/image is used.
    deviceSizes: [640, 750, 1080, 1200],
    imageSizes: [64, 128, 256, 384],
  },
};

export default nextConfig;
