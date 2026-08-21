import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/topik-master/:path*", headers: privateHeaders },
      { source: "/api/topik-master/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
