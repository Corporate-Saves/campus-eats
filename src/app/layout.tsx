import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#FF6B35",
};

export const metadata: Metadata = {
  title: "Campus Eats",
  description: "Campus canteen ordering",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "CampusEats",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
