import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lex Transaction Agent',
  description: 'Real Estate Transaction Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
