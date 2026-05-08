import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EntityMatch Pro',
  description: 'Entity resolution and data matching studio',
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
