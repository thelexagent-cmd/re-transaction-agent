'use client';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    document.documentElement.setAttribute('data-theme', stored ?? 'dark');
  }, []);
  return <>{children}</>;
}
