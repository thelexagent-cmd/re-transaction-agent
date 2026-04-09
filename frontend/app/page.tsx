'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, Clock, Users, TrendingUp, Shield, Zap, Play } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// ── Constants ─────────────────────────────────────────────────────────────────
const HEADLINE_PART1 = "Stop chasing paperwork. ";
const HEADLINE_PART2 = "Start closing deals.";
const FULL_HEADLINE  = HEADLINE_PART1 + HEADLINE_PART2;

const FIELD_POINTS = [
  { phase: 0.00, spd: 0.20, r: 700, color: [99,  102, 241] as const },
  { phase: 1.57, spd: 0.15, r: 800, color: [59,  130, 246] as const },
  { phase: 3.14, spd: 0.25, r: 650, color: [139, 92,  246] as const },
  { phase: 4.71, spd: 0.18, r: 750, color: [20,  184, 166] as const },
  { phase: 0.80, spd: 0.22, r: 620, color: [99,  102, 241] as const },
  { phase: 2.40, spd: 0.17, r: 680, color: [59,  130, 246] as const },
];

const FEATURES = [
  { icon: FileText,   title: 'AI Contract Parsing',   desc: 'Upload any contract PDF and Lex extracts all parties, deadlines, and key terms automatically.' },
  { icon: Clock,      title: 'Deadline Intelligence', desc: 'Never miss a critical date. Automated alerts at 3 days and 1 day before every deadline.' },
  { icon: Users,      title: 'Client Portals',        desc: 'Send buyers, sellers, and lenders a secure magic-link portal to upload docs and track progress.' },
  { icon: TrendingUp, title: 'Deal Health Score',     desc: 'Real-time 0–100 score for every transaction, powered by Claude AI.' },
  { icon: Shield,     title: 'Compliance & FIRPTA',   desc: 'Built-in compliance checklists and automatic FIRPTA withholding calculations.' },
  { icon: Zap,        title: 'Automation Workflows',  desc: 'Status triggers, document collection, and multilingual broker emails — running 24/7.' },
];

const STATS = [
  { value: 500, suffix: '+',   label: 'Transactions managed' },
  { value: 98,  suffix: '%',   label: 'On-time closings' },
  { value: 3,   suffix: ' min', label: 'Avg contract parsed' },
];

const DEMOS = [
  {
    title: 'Upload a Contract',
    desc:  'Drop any PDF and Lex reads every clause, extracts all parties and deadlines, and pre-fills your transaction in seconds. No manual data entry.',
    color: '#1E5EFF',
  },
  {
    title: 'Track Every Deadline',
    desc:  'One calendar across all your deals. Lex sends automated alerts 3 days and 1 day before every deadline — and emails your clients so you never have to chase.',
    color: '#7C3AED',
  },
  {
    title: 'Send the Client Portal',
    desc:  'One click gives buyers, sellers, and lenders a secure magic-link portal to upload documents, check progress, and sign off — from any device.',
    color: '#0D9488',
  },
];

// Directional card entry origins
const CARD_DIRS = [
  { x: -55, y: 40 }, { x: 0, y: 65 }, { x: 55, y: 40 },
  { x: -45, y: 45 }, { x: 0, y: 65 }, { x: 45, y: 45 },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  // Canvas / aura
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef({ targetX: 0, targetY: 0 });
  const rafRef     = useRef<number>(0);
  // GSAP drives this proxy — canvas reads it each RAF frame
  const auraProxy  = useRef({ scale: 1, yOffset: 0 });

  // Sections / refs
  const lenisRef      = useRef<Lenis | null>(null);
  const navRef        = useRef<HTMLElement | null>(null);
  const heroRef       = useRef<HTMLElement | null>(null);
  const statsRef      = useRef<HTMLElement | null>(null);
  const featRef       = useRef<HTMLElement | null>(null);
  const demoRef       = useRef<HTMLElement | null>(null);
  const footerRef     = useRef<HTMLElement | null>(null);
  const hintRef       = useRef<HTMLDivElement | null>(null);
  const cardRefs      = useRef<(HTMLDivElement | null)[]>([]);
  const counterRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const demoVideoRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [visible, setVisible]       = useState(false);
  const [typed, setTyped]           = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // ── 1. Theme + cursor CSS vars ───────────────────────────────────────────────
  // Cursor position published as --cx / --cy. Hero <section> consumes them via
  // CSS `translate` (separate property from `transform` — no GSAP conflict).
  useEffect(() => {
    // ThemeProvider (parent) runs its effect after children in React.
    // Use setTimeout(0) to enforce dark AFTER ThemeProvider sets the stored theme.
    const t = setTimeout(() => document.documentElement.setAttribute('data-theme', 'dark'), 0);
    const initCX = window.innerWidth  / 2;
    const initCY = window.innerHeight / 2;
    document.documentElement.style.setProperty('--cx', `${initCX}px`);
    document.documentElement.style.setProperty('--cy', `${initCY}px`);

    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cy', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    setTimeout(() => setVisible(true), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', onMove);
      // Restore user's stored preference when leaving landing page
      const stored = localStorage.getItem('lex-theme') ?? 'dark';
      document.documentElement.setAttribute('data-theme', stored);
    };
  }, []);

  // ── 2. Typing animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const delay = setTimeout(() => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setTyped(i);
        if (i >= FULL_HEADLINE.length) {
          clearInterval(iv);
          setTypingDone(true);
          let b = 0;
          const blink = setInterval(() => {
            setShowCursor(p => !p);
            if (++b >= 6) { clearInterval(blink); setShowCursor(false); }
          }, 250);
        }
      }, 45);
      return () => clearInterval(iv);
    }, 400);
    return () => clearTimeout(delay);
  }, [visible]);

  // ── 3. Lenis smooth scroll + nav pill morph ──────────────────────────────────
  // Physics feel: Lenis applies exponential decay to scroll input (momentum/friction),
  // GSAP scrub:1 adds output lag ("weight") → double-buffered easing = physical mass.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenisRef.current = lenis;

    lenis.on('scroll', ({ scroll }: { scroll: number }) => {
      if (!navRef.current) return;
      const scrollT = Math.min(1, scroll / 220);
      const pillT   = Math.min(1, scroll / 300);

      // Background darken
      navRef.current.style.background = `rgba(5,8,15,${0.75 + 0.2 * scrollT})`;
      navRef.current.style.boxShadow  = scrollT > 0.3
        ? `0 1px 0 rgba(255,255,255,0.04), 0 8px 40px rgba(0,0,0,${0.25 * scrollT})`
        : 'none';

      // Pill morph — margin squeezes nav inward from both sides, borderRadius rounds it
      // position:fixed + left:0 + right:0 + margin:N → pill floating in viewport
      const marginV = Math.round(pillT * 14);
      const marginH = Math.round(pillT * window.innerWidth * 0.075);
      navRef.current.style.margin       = `${marginV}px ${marginH}px 0`;
      navRef.current.style.borderRadius = `${Math.round(pillT * 100)}px`;
      navRef.current.style.padding      = `${(1.1 - pillT * 0.3).toFixed(2)}rem ${(2.5 - pillT * 0.5).toFixed(2)}rem`;
    });

    return () => { lenis.destroy(); };
  }, []);

  // ── 4. GSAP scroll animations ─────────────────────────────────────────────────
  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!heroRef.current || !featRef.current || cards.length === 0) return;

    // Hero parallax — each [data-spd] layer scrolls at a different rate (depth illusion)
    heroRef.current.querySelectorAll('[data-spd]').forEach((el) => {
      const y = parseFloat(el.getAttribute('data-spd') || '0');
      gsap.to(el, {
        y, ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });
    });

    // Stat counters — animate from 0 → value when stats section enters viewport
    counterRefs.current.forEach((el, i) => {
      if (!el) return;
      const stat = STATS[i];
      const obj = { val: 0 };
      gsap.to(obj, {
        val: stat.value,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.val) + stat.suffix; },
        scrollTrigger: {
          trigger: statsRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    });

    // Features — pinned section, directional card entries, scrub:1 weight, snap stops
    cards.forEach((card, i) => {
      const dir = CARD_DIRS[i] ?? { x: 0, y: 60 };
      gsap.set(card, { opacity: 0, x: dir.x, y: dir.y, scale: 0.94 });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: featRef.current,
        start: 'top top',
        end: '+=1400',
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        // Snap: creates gravity wells at start (0) and end (1) of pinned section
        snap: {
          snapTo: 1,
          duration: { min: 0.2, max: 0.6 },
          delay: 0.08,
          ease: 'power1.inOut',
        },
      },
    });

    // Aura grows as cards reveal
    tl.to(auraProxy.current, { scale: 1.12, yOffset: 55, ease: 'none' }, 0);

    // Features heading — clip-path reveal (wipe up from bottom)
    const heading = featRef.current.querySelector('.feat-heading');
    if (heading) {
      gsap.set(heading, { clipPath: 'inset(100% 0 0 0)' });
      tl.to(heading, { clipPath: 'inset(0% 0 0 0)', ease: 'power2.out', duration: 0.4 }, 0);
    }

    // Cards enter from directional origins
    cards.forEach((card, i) => {
      tl.to(card, { opacity: 1, x: 0, y: 0, scale: 1, ease: 'power2.out', duration: 0.65 }, 0.08 + i * 0.10);
    });

    // Demo section — each row scrubs in, clip-reveal on headings
    if (demoRef.current) {
      demoRef.current.querySelectorAll('.demo-row').forEach((row) => {
        gsap.fromTo(row,
          { opacity: 0, y: 50 },
          {
            opacity: 1, y: 0, ease: 'power2.out',
            scrollTrigger: { trigger: row, start: 'top 82%', end: 'top 38%', scrub: 1 },
          },
        );
      });

      demoRef.current.querySelectorAll('.clip-reveal').forEach((el) => {
        gsap.set(el, { clipPath: 'inset(100% 0 0 0)' });
        gsap.to(el, {
          clipPath: 'inset(0% 0 0 0)',
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 52%', scrub: 1 },
        });
      });
    }

    // Footer scrubs in after features unpin
    if (footerRef.current) {
      gsap.set(footerRef.current, { opacity: 0, y: 32 });
      ScrollTrigger.create({
        trigger: footerRef.current,
        start: 'top 86%',
        end: 'top 32%',
        scrub: 1,
        animation: gsap.to(footerRef.current, { opacity: 1, y: 0, ease: 'power2.out' }),
      });
    }

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Scroll hint visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (!typingDone || !hintRef.current) return;
    const el = hintRef.current;
    el.style.opacity = '1';
    const fn = () => { el.style.opacity = window.scrollY > 40 ? '0' : '1'; };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [typingDone]);

  // ── 6. Canvas aura ───────────────────────────────────────────────────────────
  // Reads auraProxy each frame — GSAP features timeline drives scale / yOffset.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const m = mouseRef.current;
    let fcx = W * 0.5, fcy = H * 0.4;
    m.targetX = W * 0.5; m.targetY = H * 0.4;
    const t0 = performance.now();

    // ── Particle field ────────────────────────────────────────────────────────
    const PCOLS = ['#6366f1','#3b82f6','#60a5fa','#a78bfa','#2FE6DE','#818cf8'];
    const pts = Array.from({ length: 200 }, () => {
      const bvx = (Math.random() - 0.5) * 0.28;
      const bvy = (Math.random() - 0.5) * 0.28;
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: bvx, vy: bvy, baseVx: bvx, baseVy: bvy,
        size: 1.1 + Math.random() * 2.0,
        angle: Math.random() * Math.PI * 2,
        color: PCOLS[Math.floor(Math.random() * PCOLS.length)],
        alpha: 0.22 + Math.random() * 0.42,
      };
    });

    const onMove   = (e: MouseEvent) => { m.targetX = e.clientX; m.targetY = e.clientY; };
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize);

    function draw() {
      const t  = (performance.now() - t0) * 0.001;
      const as = auraProxy.current.scale;
      const ay = auraProxy.current.yOffset;
      const dX = W * 0.06 * Math.sin(t * 0.14 + 1.0);
      const dY = H * 0.05 * Math.cos(t * 0.11 + 0.5);
      fcx += ((m.targetX + dX)      - fcx) * 0.007;
      fcy += ((m.targetY + dY + ay) - fcy) * 0.007;
      ctx!.clearRect(0, 0, W, H);
      FIELD_POINTS.forEach(pt => {
        const sp = Math.min(W, H) * 0.30;
        const nx =
          Math.sin(t * 0.30 * pt.spd + pt.phase) * sp
        + Math.cos(t * 0.17 * pt.spd + pt.phase * 1.618) * sp * 0.42
        + Math.sin(t * 0.10 * pt.spd + pt.phase * 2.72 + 0.5) * sp * 0.18;
        const ny =
          Math.cos(t * 0.25 * pt.spd + pt.phase * 0.73) * sp * 0.80
        + Math.sin(t * 0.19 * pt.spd + pt.phase * 2.14) * sp * 0.35
        + Math.cos(t * 0.12 * pt.spd + pt.phase * 1.41 + 1.2) * sp * 0.15;
        const px = fcx + nx, py = fcy + ny;
        const r  = pt.r * as;
        const [cr, cg, cb] = pt.color;
        ctx!.globalCompositeOperation = 'screen';
        const g = ctx!.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0.00, `rgba(${cr},${cg},${cb},0.15)`);
        g.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.07)`);
        g.addColorStop(0.70, `rgba(${cr},${cg},${cb},0.02)`);
        g.addColorStop(1.00, `rgba(${cr},${cg},${cb},0.00)`);
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, W, H);
      });

      // ── Draw particles ────────────────────────────────────────────────────
      ctx!.globalCompositeOperation = 'screen';
      pts.forEach(p => {
        // Mouse repulsion
        const dx = p.x - m.targetX, dy = p.y - m.targetY;
        const dist2 = dx * dx + dy * dy;
        const R = 150;
        if (dist2 < R * R && dist2 > 0) {
          const dist = Math.sqrt(dist2);
          const f = ((R - dist) / R) * 1.1;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
        }
        // Ease back to base drift
        p.vx += (p.baseVx - p.vx) * 0.04;
        p.vy += (p.baseVy - p.vy) * 0.04;
        // Micro turbulence
        p.vx += (Math.random() - 0.5) * 0.012;
        p.vy += (Math.random() - 0.5) * 0.012;
        // Speed cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 3) { p.vx = (p.vx / spd) * 3; p.vy = (p.vy / spd) * 3; }
        p.x += p.vx; p.y += p.vy;
        p.angle += 0.016;
        // Wrap edges
        if (p.x < -15) p.x = W + 15; if (p.x > W + 15) p.x = -15;
        if (p.y < -15) p.y = H + 15; if (p.y > H + 15) p.y = -15;
        // Draw dash
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.angle);
        ctx!.globalAlpha = p.alpha;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size * 2.8, p.size, p.size * 5.6);
        ctx!.restore();
      });
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived headline ─────────────────────────────────────────────────────────
  const vp1 = FULL_HEADLINE.slice(0, Math.min(typed, HEADLINE_PART1.length));
  const vp2 = typed > HEADLINE_PART1.length ? FULL_HEADLINE.slice(HEADLINE_PART1.length, typed) : '';
  const stillTyping = typed < FULL_HEADLINE.length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      overflowX: 'hidden',
    }}>

      {/* Aura canvas — fixed, always behind everything */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Nav — morphs to floating pill on scroll ──────────────────────────── */}
      {/*
        Pill morph technique: nav has left:0 right:0 (full width at rest).
        Lenis scroll handler animates margin to shrink it from both sides,
        borderRadius to round it, and padding to compress it.
        position:fixed + left:0 + right:0 + margin:N px = floating pill.
      */}
      <nav
        ref={(el) => { navRef.current = el; }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 2.5rem',
          background: 'rgba(8,12,20,0.75)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          transition: 'box-shadow 0.4s ease, border-radius 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            boxShadow: '0 0 14px rgba(30,94,255,0.3)',
          }}>
            <svg width="22" height="20" viewBox="0 0 34 30" fill="none">
              <defs>
                <linearGradient id="navlg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
                </linearGradient>
              </defs>
              <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#navlg)"/>
              <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#navlg)"/>
              <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#navlg)"/>
              <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#navlg)"/>
              <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#navlg)"/>
            </svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text-primary)' }}>
            Lex
          </span>
        </div>
        {/* Middle nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {[
            { label: 'Features',     href: '#features' },
            { label: 'How it Works', href: '#how-it-works' },
            { label: 'Pricing',      href: '#pricing' },
            { label: 'For Brokers',  href: '#features' },
          ].map(({ label, href }) => (
            <a key={label} href={href} style={{
              fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)',
              textDecoration: 'none', padding: '0.45rem 0.85rem', borderRadius: '8px',
              transition: 'color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-primary)'; (e.target as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)'; (e.target as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/login" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.45rem 1rem' }}>
            Sign in
          </Link>
          <Link href="/register" style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.8125rem', fontWeight: 700, color: '#fff',
            textDecoration: 'none', padding: '0.45rem 1.1rem',
            background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
            borderRadius: '9px', boxShadow: '0 0 16px rgba(30,94,255,0.35)',
          }}>
            Get started <ArrowRight style={{ width: '13px', height: '13px' }} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      {/*
        Three motion systems, zero conflicts:
        1. CSS `translate` (this <section>): cursor parallax via --cx/--cy vars
        2. CSS `translate` keyframes (.land-float-* wrappers): idle float
        3. GSAP `transform` ([data-spd] elements): scroll parallax at different depths
        CSS `translate` and CSS `transform` are separate properties → they compose.
      */}
      <section
        ref={(el) => { heroRef.current = el; }}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh',
          padding: '8rem 2rem 5rem',
          textAlign: 'center',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease, translate 1.4s cubic-bezier(0.16,1,0.3,1)',
          translate: 'calc((var(--cx, 50vw) - 50vw) * 0.014) calc((var(--cy, 50vh) - 50vh) * 0.014)',
        }}
      >
        {/* Badge — float-a layer, parallax at -100px */}
        <div className="land-float-a" style={{ marginBottom: '2rem' }}>
          <div data-spd="-100" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.35rem 0.9rem', borderRadius: '100px',
            background: 'rgba(30,94,255,0.12)',
            border: '1px solid rgba(30,94,255,0.25)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1E5EFF', boxShadow: '0 0 8px rgba(30,94,255,0.6)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', letterSpacing: '0.04em' }}>
              AI-POWERED REAL ESTATE PLATFORM
            </span>
          </div>
        </div>

        {/* Headline — float-b layer, parallax at -65px */}
        <div className="land-float-b">
          <h1
            data-spd="-65"
            style={{
              fontSize: 'clamp(2.6rem, 6vw, 5rem)',
              fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.05,
              color: 'var(--text-primary)',
              maxWidth: '860px', marginBottom: '1.5rem', minHeight: '1.05em',
            }}
          >
            {vp1}
            {vp2 && (
              <span style={{
                background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #2FE6DE 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {vp2}
              </span>
            )}
            {(stillTyping || (!typingDone && showCursor) || (typingDone && showCursor)) && (
              <span style={{
                display: 'inline-block', width: '3px', height: '0.85em',
                background: '#1E5EFF', borderRadius: '2px', marginLeft: '4px',
                verticalAlign: 'middle', opacity: showCursor ? 1 : 0, transition: 'opacity 80ms',
              }} />
            )}
          </h1>
        </div>

        {/* Subtext — float-c layer, parallax at -35px */}
        <div className="land-float-c">
          <div
            data-spd="-35"
            style={{
              maxWidth: '560px', marginBottom: '2.75rem',
              opacity: typed > 10 ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Lex manages every transaction from contract to closing — deadlines, documents, commissions, and client communication — powered by Claude AI.
            </p>
          </div>
        </div>

        {/* CTA — parallax at -20px (slowest, background) */}
        <div
          data-spd="-20"
          style={{
            display: 'flex', gap: '0.875rem', flexWrap: 'wrap', justifyContent: 'center',
            opacity: typed > 20 ? 1 : 0,
            transition: 'opacity 0.6s ease 0.1s',
          }}
        >
          <Link href="/register" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.85rem 1.75rem',
            background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
            color: '#fff', fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em',
            borderRadius: '12px', textDecoration: 'none',
            boxShadow: '0 0 28px rgba(30,94,255,0.45)',
          }}>
            Start free <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Link>
          <Link href="/login" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.85rem 1.75rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9375rem',
            borderRadius: '12px', textDecoration: 'none', backdropFilter: 'blur(8px)',
          }}>
            Sign in
          </Link>
        </div>

        <p style={{
          marginTop: '2.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.02em',
          opacity: typingDone ? 1 : 0, transition: 'opacity 0.5s ease',
        }}>
          Built for Miami brokers. Works for anyone.
        </p>

        {/* Scroll hint */}
        <div ref={hintRef} style={{
          position: 'absolute', bottom: '2.25rem', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
          opacity: 0, transition: 'opacity 0.5s ease', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Scroll to explore
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-muted)', animation: 'bounce 2s infinite' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </section>

      {/* ── Stats — animated counters, triggered on scroll ───────────────────── */}
      <section
        ref={(el) => { statsRef.current = el; }}
        style={{
          position: 'relative', zIndex: 10,
          maxWidth: '900px', margin: '0 auto',
          padding: '5rem 2rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {STATS.map((stat, i) => (
            <div key={stat.label} style={{ flex: '1 1 200px', textAlign: 'center', padding: '1.5rem' }}>
              <div style={{
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 900, letterSpacing: '-0.05em',
                color: 'var(--text-primary)', lineHeight: 1,
              }}>
                <span ref={(el) => { counterRefs.current[i] = el; }}>
                  0{stat.suffix}
                </span>
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features — GSAP pinned + scrub:1 + snap stops ───────────────────── */}
      {/*
        scrub:1 = animation lags scroll by 1 second (output weight).
        Combined with Lenis exponential decay on input = double-buffered physics.
        snap: gravity wells at 0 and 1 — section snaps fully open or closed.
      */}
      <section
        id="features"
        ref={(el) => { featRef.current = el; }}
        style={{
          position: 'relative', zIndex: 10,
          maxWidth: '1080px', margin: '0 auto',
          padding: '5rem 2rem 6rem',
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}
      >
        {/* feat-heading: clip-path reveal driven by pinned timeline */}
        <div className="feat-heading" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
            fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--text-primary)', marginBottom: '0.75rem',
          }}>
            Everything in one place
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '460px', margin: '0 auto' }}>
            Every tool a transaction coordinator needs — no spreadsheets, no missed deadlines.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => { cardRefs.current[i] = el; }}
              style={{
                background: 'rgba(14,20,32,0.60)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '1.5rem',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                willChange: 'transform, opacity',
              }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(30,94,255,0.12)',
                border: '1px solid rgba(30,94,255,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <f.icon style={{ width: '17px', height: '17px', color: '#60a5fa' }} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo section — See it in action ─────────────────────────────────── */}
      {/*
        3 rows with alternating layout (text left/right).
        Each row scrubs in via ScrollTrigger.
        Headings use clip-reveal (clipPath inset wipe).
        Video placeholders are styled mock-UI cards with play button overlays.
      */}
      <section
        id="how-it-works"
        ref={(el) => { demoRef.current = el; }}
        style={{ position: 'relative', zIndex: 10 }}
      >
        {/* Section heading */}
        <div style={{ textAlign: 'center', padding: '6rem 2rem 2rem' }}>
          <h2 className="clip-reveal" style={{
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight: 900, letterSpacing: '-0.05em',
            color: 'var(--text-primary)', display: 'inline-block',
          }}>
            See it in action
          </h2>
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Real workflows that save brokers 10+ hours a week.
          </p>
        </div>

        {DEMOS.map((demo, i) => {
          const isReversed = i % 2 === 1;
          return (
            <div
              key={demo.title}
              className="demo-row"
              style={{
                display: 'flex',
                flexDirection: isReversed ? 'row-reverse' : 'row',
                gap: '4rem',
                alignItems: 'center',
                minHeight: '88vh',
                padding: '4rem clamp(2rem, 6vw, 7rem)',
                borderBottom: i < DEMOS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              {/* Text side */}
              <div style={{ flex: '0 0 36%' }}>
                <h3 className="clip-reveal" style={{
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  fontWeight: 900, letterSpacing: '-0.05em',
                  color: 'var(--text-primary)', marginBottom: '1.25rem', lineHeight: 1.05,
                  display: 'block',
                }}>
                  {demo.title}
                </h3>
                <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: '380px' }}>
                  {demo.desc}
                </p>
                <div style={{ marginTop: '2rem' }}>
                  <Link href="/register" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.875rem', fontWeight: 700, color: demo.color,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${demo.color}55`,
                    paddingBottom: '2px',
                  }}>
                    Try it free <ArrowRight style={{ width: '14px', height: '14px' }} />
                  </Link>
                </div>
              </div>

              {/* Video placeholder */}
              <div
                ref={(el) => { demoVideoRefs.current[i] = el; }}
                style={{
                  flex: 1,
                  aspectRatio: '16/9',
                  borderRadius: '20px',
                  background: 'rgba(10,16,28,0.92)',
                  border: `1px solid ${demo.color}33`,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 0 100px ${demo.color}22, 0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`,
                  willChange: 'transform, opacity',
                }}
              >
                {/* Simulated dashboard skeleton */}
                <div style={{ position: 'absolute', inset: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    {[{ w: '60px', bg: demo.color, op: 0.55 }, { w: '40px', bg: 'rgba(255,255,255,0.08)', op: 1 }, { w: '30px', bg: 'rgba(255,255,255,0.05)', op: 1 }].map((b, j) => (
                      <div key={j} style={{ height: '8px', borderRadius: '4px', background: b.bg, width: b.w, opacity: b.op }} />
                    ))}
                  </div>
                  {[0.88, 0.62, 0.76, 0.54, 0.80, 0.45, 0.68].map((w, j) => (
                    <div key={j} style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.055)', width: `${w * 100}%` }} />
                  ))}
                  <div style={{ marginTop: 'auto', height: '32px', borderRadius: '8px', background: `${demo.color}22`, border: `1px solid ${demo.color}33` }} />
                </div>

                {/* Play button overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.22)',
                }}>
                  <div style={{
                    width: '68px', height: '68px', borderRadius: '50%',
                    background: demo.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 0 12px ${demo.color}22, 0 0 48px ${demo.color}66`,
                  }}>
                    <Play style={{ width: '26px', height: '26px', color: '#fff', marginLeft: '4px' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Footer CTA — scrubs in after features unpin ───────────────────── */}
      <section
        ref={(el) => { footerRef.current = el; }}
        style={{
          position: 'relative', zIndex: 10,
          textAlign: 'center', padding: '4rem 2rem 6rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          willChange: 'transform, opacity',
        }}
      >
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Ready to close more deals?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>
          Get started in minutes. No setup required.
        </p>
        <Link href="/register" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.9rem 2rem',
          background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
          color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
          borderRadius: '12px', textDecoration: 'none',
          boxShadow: '0 0 32px rgba(30,94,255,0.4)',
        }}>
          Create free account <ArrowRight style={{ width: '16px', height: '16px' }} />
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 10,
        background: '#060912',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '3.5rem 2rem 0',
      }}>
        <div style={{
          maxWidth: '1080px', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '2.5rem',
          paddingBottom: '3rem',
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(59,130,246,0.3)',
              }}>
                <svg width="18" height="16" viewBox="0 0 34 30" fill="none">
                  <defs>
                    <linearGradient id="ftlg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
                    </linearGradient>
                  </defs>
                  <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#ftlg)"/>
                  <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#ftlg)"/>
                  <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#ftlg)"/>
                  <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#ftlg)"/>
                  <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#ftlg)"/>
                </svg>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text-primary)' }}>Lex</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Transaction AI
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Features', href: '#features' },
                { label: 'How it Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'For Brokers', href: '#features' },
              ].map(link => (
                <a key={link.label} href={link.href} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
                >{link.label}</a>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link href="/terms" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
              >Terms of Service</Link>
              <Link href="/privacy" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
              >Privacy Policy</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Contact</h4>
            <a href="mailto:support@lexai.com" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
            >support@lexai.com</a>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          padding: '1.25rem 0',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            &copy; 2026 Lex AI. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
