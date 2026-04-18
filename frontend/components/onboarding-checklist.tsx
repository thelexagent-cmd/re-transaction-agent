'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Upload, Users, Plus } from 'lucide-react';
import Link from 'next/link';

interface Props {
  transactionCount: number;
  forceShow?: boolean;
  onDismiss?: () => void;
}

const steps = [
  {
    icon: Plus,
    title: 'Create your first deal',
    desc: 'Add a transaction to start tracking it',
    href: '/transactions/new',
    actionLabel: 'Start',
  },
  {
    icon: Upload,
    title: 'Upload a document',
    desc: 'Attach contracts, disclosures, or inspection reports',
  },
  {
    icon: Users,
    title: 'Invite via portal',
    desc: 'Share a secure link with clients or lenders',
  },
];

export function OnboardingChecklist({ transactionCount, forceShow, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('lex_onboarding_dismissed') === 'true';
    setDismissed(isDismissed);
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!forceShow && (dismissed || transactionCount > 0)) return null;

  function handleDismiss() {
    localStorage.setItem('lex_onboarding_dismissed', 'true');
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      className="relative mb-6"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderTop: '2px solid #1E5EFF',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>

      <h3 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
      }}>
        Get started with Lex
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{
                background: 'rgba(148,163,184,0.04)',
                border: '1px solid rgba(148,163,184,0.08)',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: 'rgba(30,94,255,0.1)',
                  border: '1px solid rgba(30,94,255,0.15)',
                }}
              >
                <Icon className="h-4 w-4" style={{ color: '#60a5fa' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {step.desc}
                </div>
                {step.href && (
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 mt-2 transition-all duration-150"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #1E5EFF, #0A3FCC)',
                      color: '#fff',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    {step.actionLabel} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
