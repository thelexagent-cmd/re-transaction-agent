'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { getAllContacts } from '@/lib/api';
import type { ContactEntry } from '@/lib/api';
import { PARTY_ROLE_LABELS } from '@/lib/utils';
import { Search, Users, Phone, Mail, Building2, MessageCircle } from 'lucide-react';
import Link from 'next/link';

function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  const clean = phone.replace(/\D/g, '');
  const msg = encodeURIComponent(`Hello ${name}, this is regarding your real estate transaction. Please feel free to reach out with any questions.`);
  const url = `https://wa.me/${clean}?text=${msg}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors"
      style={{
        padding: '0.375rem 0.75rem',
        fontSize: '0.75rem', fontWeight: 600,
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(16,185,129,0.25)',
        color: '#34d399',
      }}
      title="Open WhatsApp"
    >
      <MessageCircle className="h-3 w-3" />
      WhatsApp
    </a>
  );
}

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid rgba(148,163,184,0.09)',
  color: '#f1f5f9',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.625rem 0.875rem',
};

export default function ContactsPage() {
  const { data: contactsData, isLoading, error } = useSWR('/transactions/contacts/all', getAllContacts, {
    revalidateOnFocus: false,
  });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const contacts = contactsData?.contacts ?? [];

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchSearch =
        !search ||
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search));
      const matchRole = roleFilter === 'all' || c.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [contacts, search, roleFilter]);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: '#e2e8f0' }}>
            Contacts
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginTop: '4px' }}>All parties across your transactions</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Users className="h-4 w-4" style={{ color: '#60a5fa' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#60a5fa' }}>{filtered.length} contacts</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.875rem', color: '#f87171' }}>
          Failed to load contacts. Please try again later.
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 lex-skeleton rounded-2xl" />
          ))}
        </div>
      )}

      {/* Search & Filter */}
      {!isLoading && (
        <>
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#3d5068' }} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg transition-all duration-150"
                style={{ ...inputStyle, paddingLeft: '2.25rem' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg transition-all duration-150"
              style={{ ...inputStyle, padding: '0.625rem 0.875rem' }}
            >
              <option value="all">All Roles</option>
              {Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Contacts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((contact) => (
              <div
                key={`${contact.id}-${contact.role}`}
                className="rounded-2xl p-5 transition-all duration-150"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid rgba(148,163,184,0.09)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
              >
                {/* Avatar + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                    {contact.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{contact.full_name}</div>
                    <span className="inline-flex mt-1 items-center rounded-full px-2 py-0.5" style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                      {PARTY_ROLE_LABELS[contact.role] ?? contact.role}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 mb-3">
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: '#3d5068' }} />
                      <a href={`mailto:${contact.email}`} className="truncate transition-colors" style={{ fontSize: '0.75rem', color: '#94a3b8' }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#60a5fa'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#94a3b8'; }}
                      >{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: '#3d5068' }} />
                      <a href={`tel:${contact.phone}`} className="transition-colors" style={{ fontSize: '0.75rem', color: '#94a3b8' }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#60a5fa'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#94a3b8'; }}
                      >{contact.phone}</a>
                    </div>
                  )}
                </div>

                {/* Transactions */}
                {contact.transaction_count > 0 && (
                  <div className="pt-3 mb-3" style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                    <p className="mb-1.5" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {contact.transaction_count} transaction{contact.transaction_count !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {contact.transaction_ids.slice(0, 3).map((txId) => (
                        <Link
                          key={txId}
                          href={`/transactions/${txId}`}
                          className="flex items-center gap-1.5 transition-colors"
                          style={{ fontSize: '0.75rem', color: '#3b82f6' }}
                        >
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">Transaction #{txId}</span>
                        </Link>
                      ))}
                      {contact.transaction_ids.length > 3 && (
                        <span style={{ fontSize: '0.75rem', color: '#3d5068' }}>+{contact.transaction_ids.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150"
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.3)'; (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.1)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </a>
                  )}
                  {contact.phone && (
                    <WhatsAppButton phone={contact.phone} name={contact.full_name} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.1)' }}>
                <Users className="h-7 w-7" style={{ color: '#3d5068' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>No contacts found matching your search</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
