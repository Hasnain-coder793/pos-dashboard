import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chai Charcha Panel",
  description: "Admin panel for Chai Charcha",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased [scrollbar-gutter:stable]`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
