'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      padding: '3rem 1.5rem',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <Link href="/login" style={{ color: '#1E5EFF', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Login
          </Link>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '2.5rem' }}>
          Last updated: April 7, 2026
        </p>

        <Section title="1. Introduction">
          Lex AI ("we", "us", "our") operates the Lex Transaction AI platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read it carefully.
        </Section>

        <Section title="2. Information We Collect">
          <strong style={{ color: 'var(--text-primary)' }}>Account Information:</strong> When you register, we collect your name, email address, brokerage name, and password (stored as a bcrypt hash — we never store plaintext passwords).
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Transaction Data:</strong> Files, documents, contacts, deadlines, notes, and other content you upload or create within the Service.
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Usage Data:</strong> Log data including IP address, browser type, pages visited, and timestamps to operate and improve the Service.
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Communications:</strong> Emails you send through the Service's automated email features and any support correspondence with us.
        </Section>

        <Section title="3. How We Use Your Information">
          <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>To provide, maintain, and improve the Service</li>
            <li>To authenticate your identity and protect account security</li>
            <li>To process and analyze documents you upload using AI</li>
            <li>To send transactional emails (deadline reminders, portal invitations, notifications) on your behalf</li>
            <li>To communicate with you about the Service, including security alerts and support</li>
            <li>To detect and prevent fraud, abuse, and security incidents</li>
            <li>To comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. AI Document Processing">
          Documents you upload are processed by our AI systems to extract transaction data, identify parties, and summarize key terms. This processing occurs on our secure infrastructure. Document contents are not used to train AI models without your explicit consent.
        </Section>

        <Section title="5. Information Sharing">
          We do not sell your personal information. We may share information with:
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Service Providers:</strong> Third-party vendors who assist in operating the Service (cloud hosting, email delivery, analytics) under strict data processing agreements.
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Portal Recipients:</strong> Lenders and clients you invite to transaction portals receive only the specific transaction data you choose to share with them.
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Legal Requirements:</strong> When required by law, court order, or to protect the rights, property, or safety of Lex AI, our users, or the public.
        </Section>

        <Section title="6. Data Security">
          We implement industry-standard security measures including:
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>TLS encryption for all data in transit</li>
            <li>Encrypted storage for sensitive data at rest</li>
            <li>JWT-based authentication with signed access tokens</li>
            <li>Bcrypt password hashing with per-user salt</li>
            <li>Rate limiting and bot detection (Cloudflare Turnstile) on authentication endpoints</li>
            <li>Access controls ensuring users can only access their own data</li>
          </ul>
          No system is 100% secure. We encourage you to use a strong, unique password and to notify us immediately of any suspected unauthorized access.
        </Section>

        <Section title="7. Data Retention">
          We retain your account and transaction data for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days, except where retention is required by law or legitimate business interests (e.g., fraud prevention).
        </Section>

        <Section title="8. Your Rights">
          Depending on your jurisdiction, you may have the right to:
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability (receive your data in a machine-readable format)</li>
          </ul>
          To exercise these rights, contact us at{' '}
          <a href="mailto:privacy@lexai.com" style={{ color: '#1E5EFF' }}>privacy@lexai.com</a>.
        </Section>

        <Section title="9. Cookies and Tracking">
          We use minimal cookies necessary to operate the Service, including authentication session tokens. We do not use third-party advertising cookies. You may disable cookies in your browser, but this may affect Service functionality.
        </Section>

        <Section title="10. Third-Party Services">
          The Service integrates with third-party providers including cloud storage, email delivery services, and AI processing providers. These providers have their own privacy policies, and we encourage you to review them. We are not responsible for third-party privacy practices.
        </Section>

        <Section title="11. Children's Privacy">
          The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a minor has provided personal information, we will delete it promptly.
        </Section>

        <Section title="12. Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a prominent notice on the Service. The updated policy will be effective upon posting with the revised date.
        </Section>

        <Section title="13. Contact Us">
          For privacy-related inquiries or to exercise your rights, contact:
          <br /><br />
          Lex AI<br />
          Miami, Florida<br />
          <a href="mailto:privacy@lexai.com" style={{ color: '#1E5EFF' }}>privacy@lexai.com</a>
        </Section>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem' }}>
          <Link href="/terms" style={{ color: '#1E5EFF', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}>
            Terms of Service
          </Link>
          <Link href="/login" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
