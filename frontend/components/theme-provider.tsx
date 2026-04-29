'use client';
import { useEffect } from 'react';
import { ModeTransitionProvider } from '@/components/mode-transition';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    document.documentElement.setAttribute('data-theme', stored ?? 'dark');
  }, []);
  return <ModeTransitionProvider>{children}</ModeTransitionProvider>;
}
