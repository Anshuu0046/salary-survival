import type { Metadata, Viewport } from "next";
import { Anek_Latin, Besley } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { FeedbackProvider } from "@/components/ui/feedback";
import { StoreProvider } from "@/state/store";
import "./globals.css";

const besley = Besley({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-besley",
  display: "swap",
});

const anek = Anek_Latin({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-anek",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SalarySurvival", template: "%s · SalarySurvival" },
  description: "Plan your salary from payday to payday and see what you can safely spend each day.",
};

export const viewport: Viewport = {
  themeColor: "#153826",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${besley.variable} ${anek.variable}`}>
      <body>
        <StoreProvider>
          <FeedbackProvider>
            <AppShell>{children}</AppShell>
          </FeedbackProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
