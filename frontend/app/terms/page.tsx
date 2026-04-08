'use client';

import Link from 'next/link';

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '2.5rem' }}>
          Last updated: April 7, 2026
        </p>

        <Section title="1. Acceptance of Terms">
          By accessing or using Lex Transaction AI ("Lex", "the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
        </Section>

        <Section title="2. Description of Service">
          Lex is a real estate transaction management platform powered by artificial intelligence. The Service assists licensed real estate professionals in managing transactions, documents, deadlines, contacts, and communications.
        </Section>

        <Section title="3. Eligibility">
          You must be at least 18 years of age and a licensed real estate professional or otherwise authorized representative to use the Service. By creating an account, you represent and warrant that you meet these requirements.
        </Section>

        <Section title="4. Account Registration">
          You agree to provide accurate, current, and complete information when creating your account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at support@lexai.com of any unauthorized use of your account.
        </Section>

        <Section title="5. Acceptable Use">
          You agree not to:
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
            <li>Upload or transmit any content that is fraudulent, misleading, or violates third-party rights</li>
            <li>Attempt to gain unauthorized access to any portion of the Service or its related systems</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
            <li>Use automated scripts or bots to access the Service without written permission</li>
            <li>Share your account credentials with any third party</li>
          </ul>
        </Section>

        <Section title="6. Document Processing and AI Features">
          Lex uses AI to analyze real estate documents and extract information. While we strive for accuracy, AI-generated summaries, extracted data, and recommendations are provided for informational purposes only and do not constitute legal or financial advice. You are responsible for verifying all AI-extracted information before relying on it for any transaction.
        </Section>

        <Section title="7. Data and Privacy">
          Your use of the Service is also governed by our Privacy Policy, incorporated herein by reference. By using the Service, you consent to the collection, use, and sharing of your data as described in the Privacy Policy.
        </Section>

        <Section title="8. Intellectual Property">
          All content, features, and functionality of the Service — including but not limited to text, graphics, logos, and software — are owned by Lex AI and protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written consent.
        </Section>

        <Section title="9. Confidentiality of Client Data">
          You acknowledge that transaction files may contain sensitive personal data belonging to your clients. You are solely responsible for obtaining all necessary consents and complying with applicable data protection laws before uploading client information to the Service.
        </Section>

        <Section title="10. Limitation of Liability">
          To the maximum extent permitted by law, Lex AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, even if we have been advised of the possibility of such damages. Our total liability shall not exceed the amount paid by you for the Service in the twelve months preceding the claim.
        </Section>

        <Section title="11. Disclaimers">
          The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.
        </Section>

        <Section title="12. Termination">
          We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion, with or without notice. Upon termination, your right to access the Service ceases immediately.
        </Section>

        <Section title="13. Changes to Terms">
          We may update these Terms at any time. We will notify you of material changes by posting the new Terms with an updated effective date. Continued use of the Service after changes constitutes acceptance of the new Terms.
        </Section>

        <Section title="14. Governing Law">
          These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions. Any disputes shall be resolved exclusively in the courts located in Miami-Dade County, Florida.
        </Section>

        <Section title="15. Contact">
          For questions about these Terms, contact us at{' '}
          <a href="mailto:support@lexai.com" style={{ color: '#1E5EFF' }}>support@lexai.com</a>.
        </Section>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem' }}>
          <Link href="/privacy" style={{ color: '#1E5EFF', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}>
            Privacy Policy
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
