'use client';

/**
 * Mode transition system — smooth fade-through-dark when switching
 * between Lex CRM and Lex Market.
 *
 * Architecture: a fixed overlay at root level (inside ThemeProvider, above
 * all layout trees). ModeSwitcher triggers it instead of calling router.push
 * directly, giving us control over the timing:
 *
 *   click → overlay fades IN (160ms) → router.push fires
 *           → new page renders under overlay → overlay fades OUT (240ms)
 *
 * Total perceived transition: ~480ms — smooth, fast, premium.
 * No routing changes. No layout restructuring. Purely additive.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

// ── Context ──────────────────────────────────────────────────────────────────

interface ModeTransitionCtx {
  /**
   * Trigger the fade-through transition then navigate to href.
   * Safe to call from any component inside ThemeProvider.
   */
  triggerTransition: (href: string) => void;
  /**
   * The href we're currently transitioning toward, or null if idle.
   * Use for optimistic pill styling so the pill commits immediately.
   */
  pendingHref: string | null;
}

const Ctx = createContext<ModeTransitionCtx>({
  triggerTransition: () => {},
  pendingHref: null,
});

export function useModeTransition(): ModeTransitionCtx {
  return useContext(Ctx);
}

// ── Provider + overlay ───────────────────────────────────────────────────────

type Phase = 'idle' | 'in' | 'hold' | 'out';

export function ModeTransitionProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const [phase,       setPhase]       = useState<Phase>('idle');
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pre-fetch both mode roots so navigation under the overlay is instant.
  useEffect(() => {
    router.prefetch('/market');
    router.prefetch('/transactions');
  }, [router]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  const triggerTransition = useCallback((href: string) => {
    clearTimers();
    setPendingHref(href);
    setPhase('in');                          // overlay fades in

    timers.current.push(setTimeout(() => {
      router.push(href);                     // navigate while overlay is opaque
      setPhase('hold');

      timers.current.push(setTimeout(() => {
        setPhase('out');                     // overlay fades out

        timers.current.push(setTimeout(() => {
          setPhase('idle');
          setPendingHref(null);
        }, 260));                            // matches CSS transition-out duration
      }, 60));                              // brief hold so new page is painted
    }, 170));                              // matches CSS transition-in duration
  }, [router]);

  // ── Overlay opacity / pointer-events ────────────────────────────────────
  const visible = phase !== 'idle';
  const opacity = (phase === 'in' || phase === 'hold') ? 1 : 0;

  // To-market gets a deep blue-black; to-crm gets a neutral dark.
  // The difference is subtle but reinforces mode identity.
  const isToMarket = pendingHref?.startsWith('/market');
  const bg = isToMarket
    ? 'radial-gradient(ellipse at 50% 25%, rgba(5,12,30,0.99) 0%, rgba(2,4,12,1) 100%)'
    : 'rgba(6,8,16,0.97)';

  return (
    <Ctx.Provider value={{ triggerTransition, pendingHref }}>
      {children}

      {/* Fixed overlay — sits above all layout trees */}
      <div
        aria-hidden="true"
        style={{
          position:      'fixed',
          inset:         0,
          zIndex:        9998,
          background:    bg,
          opacity,
          pointerEvents: visible ? 'all' : 'none',
          transition:    phase === 'in'
            ? 'opacity 170ms ease-in'
            : 'opacity 250ms ease-out',
          willChange:    visible ? 'opacity' : 'auto',
        }}
      />
    </Ctx.Provider>
  );
}
