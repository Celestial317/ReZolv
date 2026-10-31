import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";
import "./globals.css";

const sans = Urbanist({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = { title: "ReZolv Staff", description: "Campus grievance dashboard" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
