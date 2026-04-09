import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      padding: '2rem',
    }}>
      {/* Glass card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow-elevated)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        {/* Lex logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            boxShadow: '0 0 14px rgba(30,94,255,0.3)',
          }}>
            <svg width="22" height="20" viewBox="0 0 34 30" fill="none">
              <defs>
                <linearGradient id="nflg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
                </linearGradient>
              </defs>
              <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#nflg)"/>
              <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#nflg)"/>
              <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#nflg)"/>
              <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#nflg)"/>
              <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#nflg)"/>
            </svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text-primary)' }}>
            Lex
          </span>
        </div>

        {/* 404 */}
        <h1 style={{
          fontSize: '5rem',
          fontWeight: 900,
          letterSpacing: '-0.06em',
          lineHeight: 1,
          color: 'var(--text-muted)',
          marginBottom: '0.5rem',
        }}>
          404
        </h1>

        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}>
          Page not found
        </h2>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}>
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/transactions"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.7rem 1.5rem',
            background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.875rem',
            borderRadius: '10px',
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(30,94,255,0.35)',
            transition: 'box-shadow 0.2s',
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
