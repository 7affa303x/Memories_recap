import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";
import { AnalyticsPixels } from "@/components/analytics-pixels";
import { CookieBanner } from "@/components/cookie-banner";
import { PaddleProviderWithCustomer } from "@/components/paddle-provider-with-customer";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_SHORT } from "@/lib/brand";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  "https://memories-recap-one.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl.replace(/\/$/, "")),
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_SHORT,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/brand/logo-mark.png" }],
  },
  openGraph: {
    title: BRAND_NAME,
    description: "Upload → pay → wait → receive a beautiful recap.",
    type: "website",
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: BRAND_TAGLINE,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ecfdf5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", manrope.variable, fraunces.variable)}>
      <body className="min-h-full bg-white font-sans text-neutral-900">
        <AuthProvider>
          <PaddleProviderWithCustomer>
            <AnalyticsPixels />
            {children}
            <CookieBanner />
          </PaddleProviderWithCustomer>
        </AuthProvider>
      </body>
    </html>
  );
}
