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
      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
      title="Open WhatsApp"
    >
      <MessageCircle className="h-3 w-3" />
      WhatsApp
    </a>
  );
}

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
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">All parties across your transactions</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">{filtered.length} contacts</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <div className="text-sm text-red-700">Failed to load contacts. Please try again later.</div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16">
          <div className="text-slate-500 text-sm">Loading contacts...</div>
        </div>
      )}

      {/* Search & Filter */}
      {!isLoading && (
        <>
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
            {filtered.map((contact) => (
              <div key={`${contact.id}-${contact.role}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                {/* Avatar + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                    {contact.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{contact.full_name}</div>
                    <span className="inline-flex mt-1 items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {PARTY_ROLE_LABELS[contact.role] ?? contact.role}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 mb-3">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`mailto:${contact.email}`} className="hover:text-blue-600 truncate">{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`tel:${contact.phone}`} className="hover:text-blue-600">{contact.phone}</a>
                    </div>
                  )}
                </div>

                {/* Transactions */}
                {contact.transaction_count > 0 && (
                  <div className="border-t border-slate-100 pt-3 mb-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      {contact.transaction_count} transaction{contact.transaction_count !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {contact.transaction_ids.slice(0, 3).map((txId) => (
                        <Link
                          key={txId}
                          href={`/transactions/${txId}`}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">Transaction #{txId}</span>
                        </Link>
                      ))}
                      {contact.transaction_ids.length > 3 && (
                        <span className="text-xs text-slate-400">+{contact.transaction_ids.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
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
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No contacts found matching your search</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
