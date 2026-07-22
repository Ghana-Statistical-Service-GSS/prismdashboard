import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM | Price Index System Monitor",
  description: "Price Index System Monitor for Ghana Statistical Service",
  icons: {
    icon: "/Prism-logo.png",
    apple: "/Prism-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
