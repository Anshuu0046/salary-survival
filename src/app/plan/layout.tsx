import type { Metadata } from "next";

export const metadata: Metadata = { title: "Monthly plan" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
