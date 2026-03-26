'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { getRecentEvents } from '@/lib/api';
import type { RecentEventItem } from '@/lib/api';
import { Bell, X, CheckCheck, AlertCircle, Clock, Upload, Flag, Info } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';

interface NotificationCenterProps {
  onClose?: () => void;
  readIds?: Set<number>;
  onReadIdsChange?: (ids: Set<number>) => void;
}

function eventIcon(eventType: string) {
  if (eventType.includes('document')) return <Upload className="h-3.5 w-3.5" />;
  if (eventType.includes('alert') || eventType.includes('broker')) return <AlertCircle className="h-3.5 w-3.5" />;
  if (eventType.includes('deadline')) return <Clock className="h-3.5 w-3.5" />;
  if (eventType.includes('created')) return <Flag className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
}

const STORAGE_KEY = 'lex_read_events';

function getReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function NotificationCenter({ onClose, readIds: externalReadIds, onReadIdsChange }: NotificationCenterProps) {
  const { data, isLoading } = useSWR('/events/recent', () => getRecentEvents(20), {
    refreshInterval: 60000,
  });

  const [internalReadIds, setInternalReadIds] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalReadIds(getReadIds());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const readIds = externalReadIds ?? internalReadIds;

  function setReadIds(ids: Set<number>) {
    setInternalReadIds(ids);
    onReadIdsChange?.(ids);
  }

  const events = data?.events ?? [];
  const unreadCount = events.filter((e) => !readIds.has(e.id)).length;

  function markAllRead() {
    const all = new Set(events.map((e) => e.id));
    setReadIds(all);
    saveReadIds(all);
  }

  function markRead(id: number) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  }

  return (
    <div
      ref={ref}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{ maxHeight: '400px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">Loading...</div>
        )}
        {!isLoading && events.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications</div>
        )}
        {events.map((event) => {
          const isUnread = !readIds.has(event.id);
          return (
            <div
              key={event.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isUnread ? 'bg-blue-50/40' : ''}`}
              onClick={() => markRead(event.id)}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${isUnread ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                {eventIcon(event.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/transactions/${event.transaction_id}`}
                  className="text-xs font-medium text-blue-600 hover:underline truncate block"
                  onClick={() => markRead(event.id)}
                >
                  {event.transaction_address}
                </Link>
                <p className="text-xs text-slate-700 mt-0.5 leading-snug">{event.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(event.created_at)}</p>
              </div>
              {isUnread && (
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Standalone bell button for use in page headers
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR('/events/recent', () => getRecentEvents(20), {
    refreshInterval: 60000,
  });

  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  useEffect(() => { setReadIds(getReadIds()); }, []);

  const events = data?.events ?? [];
  const unreadCount = events.filter((e) => !readIds.has(e.id)).length;

  function handleReadIdsChange(ids: Set<number>) {
    setReadIds(new Set(ids));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80">
          <NotificationCenter
            onClose={() => setOpen(false)}
            readIds={readIds}
            onReadIdsChange={handleReadIdsChange}
          />
        </div>
      )}
    </div>
  );
}
