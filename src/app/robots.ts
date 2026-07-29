import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/billing/config";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/billing", "/upload", "/processing", "/result"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
