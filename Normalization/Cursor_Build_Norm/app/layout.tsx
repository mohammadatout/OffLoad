import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EntityMatch Pro - Data Wrangling Studio',
  description: 'Clean, normalize, and deduplicate your entity data with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

