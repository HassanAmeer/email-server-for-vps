import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TempEmail — Secure Disposable Mail Service",
  description: "A secure, private, and self-hosted temporary email server. Fully active and operational.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[#050505] text-gray-100">
        {children}
      </body>
    </html>
  );
}
