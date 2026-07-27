import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";
import { PaddleProvider } from "@/components/paddle-provider";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memory Recap",
  description: "Turn heavy memories into watchable moments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", roboto.variable)}>
      <body className="min-h-full bg-white font-sans text-neutral-900">
        <AuthProvider>
          <PaddleProvider>{children}</PaddleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
