// Copyright (c) 2026 Alonics Inc. (주식회사 알로닉스). All rights reserved.
// Licensed under the AGPL-3.0 License.
// For commercial use, investment, or partnerships, please contact the author.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegistry } from "@/components/PwaRegistry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alopop - 프라이빗 채팅",
  description: "알로팝에서 친구의 채팅 초대가 도착했습니다!",
  manifest: "/manifest.json",
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegistry />
        {children}
      </body>
    </html>
  );
}
