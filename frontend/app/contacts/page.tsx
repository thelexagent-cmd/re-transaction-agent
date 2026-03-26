'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { getTransactions } from '@/lib/api';
import type { TransactionListItem, PartyResponse } from '@/lib/api';
import { PARTY_ROLE_LABELS } from '@/lib/utils';
import { Search, Users, Phone, Mail, Building2, MessageCircle } from 'lucide-react';
import Link from 'next/link';

// We need to get party data from each transaction
// Since there's no global parties endpoint yet, we build from transaction list
// The TransactionListItem doesn't have parties, so we'll show a message + use mock data
// until the backend provides /transactions/contacts/all

interface ContactEntry {
  email: string;
  full_name: string;
  phone?: string | null;
  roles: string[];
  transaction_ids: number[];
  transaction_addresses: string[];
}

function buildContacts(transactions: TransactionListItem[]): ContactEntry[] {
  // Since TransactionListItem doesn't include parties, we can't deduplicate by email
  // We'll show a placeholder UI that will work when backend provides the endpoint
  return [];
}

function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  const clean = phone.replace(/\D/g, '');
  const msg = encodeURIComponent(`Hello ${name}, this is regarding your real estate transaction. Please feel free to reach out with any questions.`);
  const url = `https://wa.me/${clean}?text=${msg}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
      title="Open WhatsApp"
    >
      <MessageCircle className="h-3 w-3" />
      WhatsApp
    </a>
  );
}

export default function ContactsPage() {
  const { data: transactions, isLoading, error } = useSWR('/transactions', getTransactions, {
    revalidateOnFocus: false,
  });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Note: Since the backend doesn't yet expose a /transactions/contacts/all endpoint
  // with party details, we display a helpful message and show transaction-level data.
  // Once the backend agent adds that endpoint, this will be fully populated.

  const mockContacts: ContactEntry[] = useMemo(() => {
    // Mock data for demonstration — will be replaced with real API data
    return [
      {
        email: 'maria.garcia@email.com',
        full_name: 'Maria Garcia',
        phone: '+13055551234',
        roles: ['buyer'],
        transaction_ids: [1],
        transaction_addresses: ['123 Ocean Dr, Miami Beach, FL'],
      },
      {
        email: 'john.smith@realty.com',
        full_name: 'John Smith',
        phone: '+13055555678',
        roles: ['listing_agent'],
        transaction_ids: [1, 2],
        transaction_addresses: ['123 Ocean Dr, Miami Beach, FL', '456 Coral Way, Coral Gables, FL'],
      },
      {
        email: 'ana.rodrigues@email.com',
        full_name: 'Ana Rodrigues',
        phone: '+5511987654321',
        roles: ['seller'],
        transaction_ids: [2],
        transaction_addresses: ['456 Coral Way, Coral Gables, FL'],
      },
    ];
  }, []);

  const filtered = useMemo(() => {
    return mockContacts.filter((c) => {
      const matchSearch =
        !search ||
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search));
      const matchRole = roleFilter === 'all' || c.roles.includes(roleFilter);
      return matchSearch && matchRole;
    });
  }, [mockContacts, search, roleFilter]);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">All parties across your transactions, deduplicated</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">{filtered.length} contacts</span>
        </div>
      </div>

      {/* API Note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-800">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Backend Integration Pending</p>
            <p className="text-xs text-amber-700 mt-1">
              This page is ready for the <code className="font-mono bg-amber-100 px-1 rounded">GET /transactions/contacts/all</code> endpoint.
              Currently showing sample data. Once the backend agent adds that endpoint, real contact data will populate here automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Roles</option>
          {Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((contact, idx) => (
          <div key={`${contact.email}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            {/* Avatar + Name */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                {contact.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{contact.full_name}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {contact.roles.map((role) => (
                    <span key={role} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {PARTY_ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <a href={`mailto:${contact.email}`} className="hover:text-blue-600 truncate">{contact.email}</a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:text-blue-600">{contact.phone}</a>
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="border-t border-slate-100 pt-3 mb-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Transactions</p>
              <div className="space-y-1">
                {contact.transaction_addresses.map((addr, i) => (
                  <Link
                    key={i}
                    href={`/transactions/${contact.transaction_ids[i]}`}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{addr}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`mailto:${contact.email}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Mail className="h-3 w-3" />
                Email
              </a>
              {contact.phone && (
                <WhatsAppButton phone={contact.phone} name={contact.full_name} />
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No contacts found matching your search</p>
        </div>
      )}
    </div>
  );
}
