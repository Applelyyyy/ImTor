import type { NextConfig } from "next";
const imageOrigin = process.env.S3_PUBLIC_BASE_URL
  ? new URL(process.env.S3_PUBLIC_BASE_URL)
  : null;
const config: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      ...(imageOrigin
        ? [
            {
              protocol: imageOrigin.protocol.replace(":", "") as
                "https" | "http",
              hostname: imageOrigin.hostname,
              port: imageOrigin.port,
              pathname: `${imageOrigin.pathname.replace(/\/$/, "")}/**`,
            },
          ]
        : []),
    ],
  },
};
export default config;
