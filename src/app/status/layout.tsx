import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status",
  description: "Live health status for Memories Recap.",
};

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
