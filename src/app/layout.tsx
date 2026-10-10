import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Studio — Your document workspace",
  description: "View and manage PDF documents privately in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
