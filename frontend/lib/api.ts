import { getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

export type TransactionListItem = {
  id: number;
  address: string;
  property_type: string;
  status: 'active' | 'closed' | 'cancelled';
  purchase_price?: number | null;
  closing_date?: string | null;
  contract_execution_date?: string | null;
  created_at: string;
  updated_at: string;
};

export type PartyResponse = {
  id: number;
  transaction_id: number;
  role: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  created_at: string;
};

export type DeadlineResponse = {
  id: number;
  transaction_id: number;
  name: string;
  due_date: string;
  status: 'upcoming' | 'warning' | 'missed' | 'completed';
  alert_t3_sent: boolean;
  alert_t1_sent: boolean;
  created_at: string;
};

export type EventResponse = {
  id: number;
  transaction_id: number;
  event_type: string;
  description: string;
  dismissed: boolean;
  created_at: string;
};

export type TransactionDetail = TransactionListItem & {
  parties: PartyResponse[];
  deadlines: DeadlineResponse[];
  events: EventResponse[];
};

export type DocumentResponse = {
  id: number;
  transaction_id: number;
  phase: number;
  name: string;
  status: 'pending' | 'collected' | 'overdue';
  responsible_party_role?: string | null;
  due_date?: string | null;
  collected_at?: string | null;
  storage_key?: string | null;
  last_followup_at?: string | null;
  created_at: string;
};

export type DocumentListResponse = { [phase: string]: DocumentResponse[] };

export type DocumentSummary = {
  total: number;
  collected: number;
  pending: number;
  overdue: number;
  by_phase: {
    [phase: string]: { total: number; collected: number; pending: number; overdue: number };
  };
};

export type AlertListResponse = { alerts: EventResponse[]; total: number };
export type DeadlineListResponse = { deadlines: DeadlineResponse[]; total: number };

export type RecentEventItem = {
  id: number;
  transaction_id: number;
  transaction_address: string;
  event_type: string;
  description: string;
  dismissed: boolean;
  created_at: string;
};

export type CreateTransactionData = {
  address: string;
  property_type: string;
  purchase_price?: number | null;
  closing_date?: string | null;
  contract_execution_date?: string | null;
  parties?: Array<{
    role: string;
    full_name: string;
    email?: string;
    phone?: string;
  }>;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getMe(): Promise<unknown> {
  const res = await authFetch('/auth/me');
  return res.json();
}

// ── Transactions ───────────────────────────────────────────────────────────

export async function getTransactions(): Promise<TransactionListItem[]> {
  const res = await authFetch('/transactions');
  return res.json();
}

export async function getTransaction(id: number | string): Promise<TransactionDetail> {
  const res = await authFetch(`/transactions/${id}`);
  return res.json();
}

export async function createTransaction(data: CreateTransactionData): Promise<TransactionListItem> {
  const res = await authFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── Documents ──────────────────────────────────────────────────────────────

export async function getDocuments(id: number | string): Promise<DocumentListResponse> {
  const res = await authFetch(`/transactions/${id}/documents`);
  return res.json();
}

export async function getDocumentSummary(id: number | string): Promise<DocumentSummary> {
  const res = await authFetch(`/transactions/${id}/documents/summary`);
  return res.json();
}

export async function markDocumentCollected(
  txId: number | string,
  docId: number | string,
  notes?: string
): Promise<DocumentResponse> {
  const res = await authFetch(`/transactions/${txId}/documents/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
  return res.json();
}

// ── Deadlines ──────────────────────────────────────────────────────────────

export async function getDeadlines(id: number | string): Promise<DeadlineListResponse> {
  const res = await authFetch(`/transactions/${id}/deadlines`);
  return res.json();
}

// ── Alerts ─────────────────────────────────────────────────────────────────

export async function getAlerts(id: number | string): Promise<AlertListResponse> {
  const res = await authFetch(`/transactions/${id}/alerts`);
  return res.json();
}

export async function dismissAlert(txId: number | string, eventId: number | string): Promise<unknown> {
  const res = await authFetch(`/transactions/${txId}/alerts/${eventId}/dismiss`, {
    method: 'POST',
  });
  return res.json();
}

// ── Contract Parsing ───────────────────────────────────────────────────────

export async function parseContract(
  txId: number | string,
  file: File
): Promise<{ status: string; task_id: string; message: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}/transactions/${txId}/parse-contract`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export type GlobalDeadlineItem = {
  id: number;
  transaction_id: number;
  transaction_address: string;
  name: string;
  due_date: string;
  status: 'upcoming' | 'warning' | 'missed' | 'completed';
  alert_t3_sent: boolean;
  alert_t1_sent: boolean;
  created_at: string;
};

export type GlobalDocumentItem = {
  id: number;
  transaction_id: number;
  transaction_address: string;
  phase: number;
  name: string;
  status: 'pending' | 'collected' | 'overdue';
  responsible_party_role: string | null;
  due_date: string | null;
  created_at: string;
};

export async function getAllDeadlines(): Promise<GlobalDeadlineItem[]> {
  const res = await authFetch('/transactions/deadlines/all');
  return res.json();
}

export async function getAllDocuments(): Promise<GlobalDocumentItem[]> {
  const res = await authFetch('/transactions/documents/all');
  return res.json();
}

export async function getRecentEvents(limit = 15): Promise<{ events: RecentEventItem[]; total: number }> {
  const res = await authFetch(`/transactions/events/recent?limit=${limit}`);
  return res.json();
}

export async function getParseStatus(
  txId: number | string,
  taskId: string
): Promise<{ task_id: string; status: string; result?: unknown }> {
  const res = await authFetch(`/transactions/${txId}/parse-status/${taskId}`);
  return res.json();
}
