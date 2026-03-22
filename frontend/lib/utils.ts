import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { TransactionListItem, DeadlineResponse, EventResponse } from './api';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const target = new Date(dateStr);
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export type DealStatus = 'on_track' | 'at_risk' | 'needs_attention';

export function getDealStatus(
  transaction: TransactionListItem,
  alerts?: EventResponse[],
  deadlines?: DeadlineResponse[]
): DealStatus {
  // Check for missed deadlines or overdue docs
  if (deadlines && deadlines.some((d) => d.status === 'missed')) {
    return 'needs_attention';
  }

  // Check for unread/active alerts
  if (alerts && alerts.some((a) => !a.dismissed)) {
    return 'needs_attention';
  }

  // Check for warning deadlines
  if (deadlines && deadlines.some((d) => d.status === 'warning')) {
    return 'at_risk';
  }

  // Simple heuristic from closing date
  const days = daysUntil(transaction.closing_date);
  if (days !== null) {
    if (days <= 0) return 'needs_attention';
    if (days <= 3) return 'at_risk';
  }

  return 'on_track';
}

export function getSimpleDealStatus(transaction: TransactionListItem): DealStatus {
  const days = daysUntil(transaction.closing_date);
  if (days !== null) {
    if (days <= 0) return 'needs_attention';
    if (days <= 3) return 'at_risk';
  }
  return 'on_track';
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
