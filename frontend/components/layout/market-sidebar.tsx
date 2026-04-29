'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, ListChecks, MapPin } from 'lucide-react';

const marketNavItems = [
  { href: '/market/watchlist', label: 'Watchlist', icon: ListChecks },
  { href: '/market/alerts',    label: 'Alerts',    icon: Bell },
];

// ── Data model ───────────────────────────────────────────────────────────────

interface ZipEntry {
  zip: string;
  label?: string;
  pinned?: boolean;
}

function parseZips(raw: string | null): ZipEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).flatMap((item) => {
      if (typeof item === 'string') return [{ zip: item }];
      if (typeof item === 'object' && item !== null && 'zip' in item) return [item as ZipEntry];
      return [];
    });
  } catch { return []; }
}

function persistZips(entries: ZipEntry[]) {
  try {
    localStorage.setItem('lex-market-zips', JSON.stringify(entries));
    window.dispatchEvent(new Event('storage'));
  } catch { /* ignore */ }
}

// ── Context menu (fixed-position, portal-style) ──────────────────────────────

interface MenuState {
  zip: string;
  x: number;
  y: number;
  mode: 'main' | 'label';
}

function ZipContextMenu({
  state,
  entries,
  onClose,
  onSave,
}: {
  state: MenuState;
  entries: ZipEntry[];
  onClose: () => void;
  onSave: (next: ZipEntry[]) => void;
}) {
  const menuRef    = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const [mode, setMode]         = useState<'main' | 'label'>(state.mode);
  const [labelVal, setLabelVal] = useState('');

  const entry = entries.find((e) => e.zip === state.zip);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Focus input when entering label mode
  useEffect(() => {
    if (mode === 'label') {
      setLabelVal(entry?.label ?? '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [mode, entry?.label]);

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  function handlePin() {
    const next = entries.map((e) =>
      e.zip === state.zip ? { ...e, pinned: !e.pinned } : e
    );
    onSave(next);
    onClose();
  }

  function handleDelete() {
    const next = entries.filter((e) => e.zip !== state.zip);
    onSave(next);
    onClose();
  }

  function handleLabelSave() {
    const trimmed = labelVal.trim();
    const next = entries.map((e) =>
      e.zip === state.zip ? { ...e, label: trimmed || undefined } : e
    );
    onSave(next);
    onClose();
  }

  const isPinned = entry?.pinned ?? false;

  // Clamp menu to viewport
  const menuW = 148;
  const menuH = mode === 'label' ? 82 : 110;
  const x = Math.min(state.x, window.innerWidth  - menuW - 8);
  const y = Math.min(state.y, window.innerHeight - menuH - 8);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        width: menuW,
        background: 'rgba(10,14,26,0.97)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        animation: 'zipMenuIn 120ms ease-out',
      }}
    >
      <style>{`
        @keyframes zipMenuIn {
          from { opacity: 0; transform: scale(0.94) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      {mode === 'label' ? (
        <div style={{ padding: '10px 10px 10px' }}>
          <input
            ref={inputRef}
            value={labelVal}
            onChange={(e) => setLabelVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSave();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="e.g. South Beach Luxury"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: '5px 8px',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button
              onClick={handleLabelSave}
              style={{
                flex: 1,
                background: 'rgba(59,130,246,0.75)',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 5,
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '3px 0' }}>
          <MenuButton onClick={() => setMode('label')}>
            {entry?.label ? 'Edit Label' : 'Add Label'}
          </MenuButton>
          <MenuButton onClick={handlePin}>
            {isPinned ? 'Unpin' : 'Pin'}
          </MenuButton>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
          <MenuButton onClick={handleDelete} danger>
            Delete
          </MenuButton>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: hovered
          ? danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'
          : 'transparent',
        border: 'none',
        padding: '6px 12px',
        fontSize: '0.8125rem',
        color: danger
          ? hovered ? '#f87171' : 'rgba(248,113,113,0.7)'
          : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background 80ms, color 80ms',
      }}
    >
      {children}
    </button>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function MarketSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {/* Lex Market header */}
      <div style={{ paddingLeft: '8px', paddingRight: '8px', paddingBottom: '12px', paddingTop: '4px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '2px', fontVariant: 'small-caps' }}>
          Lex Market
        </p>
        <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Intelligence Platform
        </p>
      </div>

      {marketNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
            style={{
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      <RecentZips />
    </nav>
  );
}

// ── Recent ZIPs ──────────────────────────────────────────────────────────────

function RecentZips() {
  const pathname = usePathname();
  const [entries, setEntries]     = useState<ZipEntry[]>([]);
  const [menu, setMenu]           = useState<MenuState | null>(null);
  const [hoveredZip, setHoveredZip] = useState<string | null>(null);

  useEffect(() => {
    function read() {
      const raw = localStorage.getItem('lex-market-zips');
      setEntries(parseZips(raw));
    }
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  const handleSave = useCallback((next: ZipEntry[]) => {
    setEntries(next);
    persistZips(next);
  }, []);

  const handleMenuOpen = useCallback((
    zip: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ zip, x: rect.right + 4, y: rect.top - 4, mode: 'main' });
  }, []);

  if (entries.length === 0) return null;

  const pinned  = entries.filter((e) => e.pinned);
  const recents = entries.filter((e) => !e.pinned);

  return (
    <>
      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="mt-3 px-1">
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', paddingLeft: '8px' }}>
            Pinned
          </p>
          {pinned.map((entry) => (
            <ZipRow
              key={entry.zip}
              entry={entry}
              active={pathname === `/market/${entry.zip}`}
              hovered={hoveredZip === entry.zip}
              menuOpen={menu?.zip === entry.zip}
              onHover={setHoveredZip}
              onMenuOpen={handleMenuOpen}
              pinned
            />
          ))}
        </div>
      )}

      {/* Recents */}
      {recents.length > 0 && (
        <div className="mt-3 px-1">
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', paddingLeft: '8px' }}>
            Recent
          </p>
          <div style={{
            maxHeight: 'calc(100vh - 420px)',
            minHeight: 80,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}>
            {recents.map((entry) => (
              <ZipRow
                key={entry.zip}
                entry={entry}
                active={pathname === `/market/${entry.zip}`}
                hovered={hoveredZip === entry.zip}
                menuOpen={menu?.zip === entry.zip}
                onHover={setHoveredZip}
                onMenuOpen={handleMenuOpen}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating menu */}
      {menu && (
        <ZipContextMenu
          state={menu}
          entries={entries}
          onClose={() => setMenu(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// ── ZIP row ──────────────────────────────────────────────────────────────────

function ZipRow({
  entry,
  active,
  hovered,
  menuOpen,
  onHover,
  onMenuOpen,
  pinned,
}: {
  entry: ZipEntry;
  active: boolean;
  hovered: boolean;
  menuOpen: boolean;
  onHover: (zip: string | null) => void;
  onMenuOpen: (zip: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  pinned?: boolean;
}) {
  const showDots = hovered || menuOpen;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => onHover(entry.zip)}
      onMouseLeave={() => onHover(null)}
    >
      <Link
        href={`/market/${entry.zip}`}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors"
        style={{
          fontSize: '0.8125rem',
          color: active ? 'var(--text-primary)' : 'var(--text-muted)',
          background: active || menuOpen
            ? 'var(--bg-elevated)'
            : hovered ? 'rgba(255,255,255,0.035)' : 'transparent',
          paddingRight: '28px', // make room for three-dot button
          transition: 'background 120ms, color 120ms',
        }}
      >
        <MapPin
          className="h-3 w-3 shrink-0"
          style={{ color: pinned ? '#60a5fa' : 'inherit', opacity: pinned ? 1 : 0.6 }}
        />
        <span className="flex-1 min-w-0 truncate">
          {entry.label ? (
            <>
              <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {entry.label}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 5 }}>
                {entry.zip}
              </span>
            </>
          ) : (
            entry.zip
          )}
        </span>
      </Link>

      {/* Three-dot trigger */}
      <button
        onClick={(e) => onMenuOpen(entry.zip, e)}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 4,
          color: menuOpen ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.8125rem',
          lineHeight: 1,
          letterSpacing: '0.05em',
          opacity: showDots ? 1 : 0,
          transition: 'opacity 120ms, color 120ms, background 120ms',
          pointerEvents: showDots ? 'auto' : 'none',
        }}
        aria-label="ZIP options"
        tabIndex={-1}
      >
        ···
      </button>
    </div>
  );
}
