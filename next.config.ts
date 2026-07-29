import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
  outputFileTracingIncludes: {
    "/api/jobs/[jobId]/process": ["./node_modules/ffmpeg-static/**/*"],
    "/api/cron/process": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
