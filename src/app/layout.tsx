import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";

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
    default: "Memory Recap",
    template: "%s · Memory Recap",
  },
  description:
    "Upload heavy memory videos, pay with credits, and get a calm landscape + vertical recap ready to watch and share.",
  openGraph: {
    title: "Memory Recap",
    description: "Upload → pay → wait → receive a beautiful recap.",
    type: "website",
    siteName: "Memory Recap",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memory Recap",
    description: "Turn heavy memories into watchable moments.",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
