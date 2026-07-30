import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/billing/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/examples`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/journey`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/moments`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/company`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
