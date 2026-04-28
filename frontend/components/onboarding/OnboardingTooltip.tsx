'use client';

import { useState, useEffect, useRef, CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingTooltipProps {
  targetSelector: string;
  text: string;
  step: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  nextLabel?: string;
}

const TOOLTIP_WIDTH = 260;
const TOOLTIP_HEIGHT = 110; // estimated height for initial positioning
const STYLE_ID = 'lex-tour-highlight-style';

function injectHighlightStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.lex-tour-highlight {
  outline: 2px solid rgba(59,130,246,0.6) !important;
  outline-offset: 3px !important;
  border-radius: 6px !important;
  position: relative;
  z-index: 1000;
}
  `.trim();
  document.head.appendChild(style);
}

export default function OnboardingTooltip({
  targetSelector,
  text,
  step,
  total,
  onNext,
  onDismiss,
  position = 'bottom',
  nextLabel = 'Next →',
}: OnboardingTooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Inject highlight style once; highlight is added by the retry-capable effect below
  useEffect(() => {
    injectHighlightStyle();
    return () => {
      const target = document.querySelector(targetSelector);
      if (target) target.classList.remove('lex-tour-highlight');
    };
  }, [targetSelector]);

  // Position tooltip relative to target.
  // Polls up to ~2 s (20 × 100 ms) if the target element is not yet in the
  // DOM — handles conditionally-rendered elements like [data-tour="deal-grid"].
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 20;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function computePosition(): void {
      const el = document.querySelector(targetSelector);
      if (!el) {
        // Element not mounted yet — retry up to MAX_RETRIES times
        if (retryCount < MAX_RETRIES) {
          retryCount += 1;
          retryTimer = setTimeout(computePosition, 100);
        }
        return;
      }

      // Also add highlight once element is found (handles delayed elements)
      el.classList.add('lex-tour-highlight');

      const rect = el.getBoundingClientRect();
      const tooltipW = tooltipRef.current?.offsetWidth ?? TOOLTIP_WIDTH;
      const tooltipH = tooltipRef.current?.offsetHeight ?? TOOLTIP_HEIGHT;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const GAP = 10;
      const EDGE = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'bottom':
          top = rect.bottom + GAP;
          left = rect.left + rect.width / 2 - tooltipW / 2;
          break;
        case 'top':
          top = rect.top - tooltipH - GAP;
          left = rect.left + rect.width / 2 - tooltipW / 2;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipH / 2;
          left = rect.right + GAP;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipH / 2;
          left = rect.left - tooltipW - GAP;
          break;
      }

      // Clamp to viewport
      top = Math.max(EDGE, Math.min(top, vh - tooltipH - EDGE));
      left = Math.max(EDGE, Math.min(left, vw - tooltipW - EDGE));

      setCoords({ top, left });
      setVisible(true);
    }

    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      if (retryTimer !== null) clearTimeout(retryTimer);
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [targetSelector, position]);

  // Arrow styles per position
  const arrowBase: CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    background: 'var(--bg-surface)',
    border: '1px solid rgba(59,130,246,0.4)',
    transform: 'rotate(45deg)',
  };

  const arrowStyle: CSSProperties = (() => {
    switch (position) {
      case 'bottom':
        return { ...arrowBase, top: -6, left: '50%', marginLeft: -5, borderBottom: 'none', borderRight: 'none' };
      case 'top':
        return { ...arrowBase, bottom: -6, left: '50%', marginLeft: -5, borderTop: 'none', borderLeft: 'none' };
      case 'right':
        return { ...arrowBase, top: '50%', marginTop: -5, left: -6, borderTop: 'none', borderRight: 'none' };
      case 'left':
        return { ...arrowBase, top: '50%', marginTop: -5, right: -6, borderBottom: 'none', borderLeft: 'none' };
    }
  })();

  const tooltip = (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        background: 'var(--bg-surface)',
        border: '1px solid rgba(59,130,246,0.4)',
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.15)',
        minWidth: 220,
        maxWidth: 280,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Arrow */}
      <div style={arrowStyle} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {step} / {total}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss tour"
          style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Guidance text */}
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-primary)',
          fontWeight: 500,
          margin: '6px 0 10px',
          lineHeight: 1.45,
        }}
      >
        {text}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onNext}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(tooltip, document.body);
}
