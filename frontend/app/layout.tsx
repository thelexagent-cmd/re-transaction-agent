import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lex Transaction AI — Real Estate CRM',
  description: 'Manage real estate transactions with AI. Track documents, deadlines, commissions, and automate communications.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Lex Transaction AI',
    description: 'AI-powered real estate transaction management',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lex Transaction AI',
    description: 'AI-powered real estate transaction management',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
