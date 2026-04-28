import { getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-bb87.up.railway.app';

// ── Types ──────────────────────────────────────────────────────────────────

export type TransactionListItem = {
  id: number;
  address: string;
  property_type: string;
  status: 'active' | 'under_contract' | 'inspection' | 'financing' | 'clear_to_close' | 'closed' | 'cancelled';
  purchase_price?: number | null;
  closing_date?: string | null;
  contract_execution_date?: string | null;
  commission_status?: string | null;
  commission_disbursed_at?: string | null;
  commission_notes?: string | null;
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
  status?: string;
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

export async function register(data: {
  email: string;
  password: string;
  full_name: string;
  brokerage_name?: string;
  turnstile_token?: string;
}): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string, turnstileToken?: string): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, turnstile_token: turnstileToken || null }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export type UserProfile = {
  id: number;
  email: string;
  full_name: string;
  brokerage_name: string | null;
  avatar_url?: string | null;
  role: 'broker' | 'agent';
  broker_id?: number | null;
  created_at: string;
};

// ── Invite types ───────────────────────────────────────────────────────────

export type InviteValidateResult = {
  valid: boolean;
  broker_name: string;
  brokerage_name: string | null;
  invitee_email: string | null;
  expires_at: string;
};

export type InviteCreateResult = {
  token: string;
  link: string;
  invite_url: string;
  email: string | null;
  invitee_email: string | null;
  expires_at: string;
};

export type InviteListItem = {
  id: number;
  email: string | null;
  used: boolean;
  used_at: string | null;
  expires_at: string;
  expired: boolean;
  invite_url: string;
  created_at: string;
};

export async function getMe(): Promise<UserProfile> {
  const res = await authFetch('/auth/me');
  return res.json();
}

export async function updateMe(data: { full_name?: string; brokerage_name?: string | null; avatar_url?: string | null }): Promise<UserProfile> {
  const res = await authFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
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

export async function deleteTransaction(id: number | string): Promise<void> {
  await authFetch(`/transactions/${id}`, { method: 'DELETE' });
}

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

// ── FIRPTA ─────────────────────────────────────────────────────────────────

export type FirptaAnalysis = {
  is_firpta_applicable: boolean;
  withholding_amount: number;
  withholding_rate: number;
  gross_sales_price: number;
  notes: string[];
  action_items: string[];
};

export async function getFirptaAnalysis(
  txId: number | string,
  buyerPrimaryResidence = false
): Promise<FirptaAnalysis> {
  const res = await authFetch(`/transactions/${txId}/firpta?buyer_primary_residence=${buyerPrimaryResidence}`);
  return res.json();
}

// ── Portal token ────────────────────────────────────────────────────────────

export async function createPortalToken(
  txId: number | string
): Promise<{ token: string; expires_at: string; transaction_id: number }> {
  const res = await authFetch(`/transactions/${txId}/portal-token`, { method: 'POST' });
  return res.json();
}

// ── Party update ────────────────────────────────────────────────────────────

export async function updateParty(
  txId: number | string,
  partyId: number | string,
  data: { preferred_language?: string; is_foreign_national?: boolean }
): Promise<{ id: number; preferred_language: string; is_foreign_national: boolean }> {
  const res = await authFetch(`/transactions/${txId}/parties/${partyId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type ReportSummary = {
  total_transactions: number;
  active: number;
  closed: number;
  cancelled: number;
  avg_days_to_close: number | null;
  total_volume: number;
  monthly_data: Array<{ month: string; created: number; closed: number; volume: number }>;
};

export async function getReportSummary(): Promise<ReportSummary> {
  const res = await authFetch('/reports/summary');
  return res.json();
}

// ── Notes ────────────────────────────────────────────────────────────────────

export type NotesResponse = {
  notes: string | null;
};

export async function getNotes(txId: number | string): Promise<NotesResponse | null> {
  try {
    const res = await authFetch(`/transactions/${txId}/notes`);
    return res.json();
  } catch {
    return null;
  }
}

export async function saveNotes(txId: number | string, content: string): Promise<NotesResponse> {
  const res = await authFetch(`/transactions/${txId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return res.json();
}

// ── Global Contacts ─────────────────────────────────────────────────────────

export type ContactEntry = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  transaction_count: number;
  transaction_ids: number[];
};

export type ContactsResponse = {
  contacts: ContactEntry[];
  total: number;
};

export async function getAllContacts(): Promise<ContactsResponse> {
  const res = await authFetch('/transactions/contacts/all');
  return res.json();
}

// ── Exposed authFetch for direct use ─────────────────────────────────────────

export { authFetch };

// ── Templates ────────────────────────────────────────────────────────────────

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
};

export async function getTemplates(): Promise<EmailTemplate[]> {
  const res = await authFetch('/templates');
  return res.json();
}

export async function createTemplate(data: { name: string; subject: string; body: string; category: string }): Promise<EmailTemplate> {
  const res = await authFetch('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTemplate(id: number, data: { name?: string; subject?: string; body?: string; category?: string }): Promise<EmailTemplate> {
  const res = await authFetch(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTemplate(id: number): Promise<void> {
  await authFetch(`/templates/${id}`, { method: 'DELETE' });
}

// ── Compliance ───────────────────────────────────────────────────────────────

export type ComplianceItem = {
  id: number;
  transaction_id: number;
  section: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
  checked_at: string | null;
  created_at: string;
};

export async function getCompliance(txId: number | string): Promise<ComplianceItem[]> {
  const res = await authFetch(`/transactions/${txId}/compliance`);
  const data = await res.json();
  return data.items ?? data;
}

export async function initializeCompliance(txId: number | string): Promise<ComplianceItem[]> {
  const res = await authFetch(`/transactions/${txId}/compliance/initialize`, { method: 'POST' });
  const data = await res.json();
  return data.items ?? data;
}

export async function toggleComplianceItem(txId: number | string, itemId: number | string, checked: boolean): Promise<ComplianceItem> {
  const res = await authFetch(`/transactions/${txId}/compliance/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ checked }),
  });
  return res.json();
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export type TaskItem = {
  id: number;
  transaction_id: number;
  title: string;
  status: 'pending' | 'completed';
  due_date: string | null;
  assigned_role: string | null;
  sort_order: number;
  created_at: string;
};

export async function getTasks(txId: number | string): Promise<TaskItem[]> {
  const res = await authFetch(`/transactions/${txId}/tasks`);
  return res.json();
}

export async function createTask(txId: number | string, data: { title: string; due_date?: string; assigned_role?: string }): Promise<TaskItem> {
  const res = await authFetch(`/transactions/${txId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTask(txId: number | string, taskId: number | string, data: Partial<{ title: string; status: 'pending' | 'completed'; due_date: string; assigned_role: string }>): Promise<TaskItem> {
  const res = await authFetch(`/transactions/${txId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTask(txId: number | string, taskId: number | string): Promise<void> {
  await authFetch(`/transactions/${txId}/tasks/${taskId}`, { method: 'DELETE' });
}

// ── EMD ──────────────────────────────────────────────────────────────────────

export type EmdData = {
  emd_amount: number | null;
  emd_holder: string | null;
  emd_due_date: string | null;
  emd_received: boolean;
  emd_notes: string | null;
};

export async function updateEmd(txId: number | string, data: EmdData): Promise<unknown> {
  const res = await authFetch(`/transactions/${txId}/emd`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── Inspection ───────────────────────────────────────────────────────────────

export type InspectionItem = {
  id: number;
  transaction_id: number;
  description: string;
  severity: 'minor' | 'major' | 'safety';
  status: 'open' | 'negotiating' | 'repaired' | 'waived' | 'credited';
  repair_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getInspectionItems(txId: number | string): Promise<InspectionItem[]> {
  const res = await authFetch(`/transactions/${txId}/inspection`);
  return res.json();
}

export async function createInspectionItem(txId: number | string, data: {
  description: string;
  severity: string;
  status: string;
  repair_cost?: number | null;
  notes?: string | null;
}): Promise<InspectionItem> {
  const res = await authFetch(`/transactions/${txId}/inspection`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateInspectionItem(txId: number | string, itemId: number | string, data: Partial<{
  description: string;
  severity: string;
  status: string;
  repair_cost: number | null;
  notes: string | null;
}>): Promise<InspectionItem> {
  const res = await authFetch(`/transactions/${txId}/inspection/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteInspectionItem(txId: number | string, itemId: number | string): Promise<void> {
  await authFetch(`/transactions/${txId}/inspection/${itemId}`, { method: 'DELETE' });
}

// ── Lender Portal ────────────────────────────────────────────────────────────

export async function createLenderPortalToken(
  txId: number | string,
  lenderName: string = 'Loan Officer',
  lenderEmail?: string
): Promise<{ token: string; expires_at: string; transaction_id: number; lender_name: string; lender_email: string | null }> {
  const res = await authFetch(`/portal/lender-token/${txId}`, {
    method: 'POST',
    body: JSON.stringify({ lender_name: lenderName, lender_email: lenderEmail ?? null }),
  });
  return res.json();
}

// ── Invites ──────────────────────────────────────────────────────────────────

export async function createInvite(email?: string): Promise<InviteCreateResult> {
  const res = await authFetch('/invites/create', {
    method: 'POST',
    body: JSON.stringify({ email: email ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Failed to create invite');
  }
  return res.json();
}

/** Public — no auth required. Throws if invalid/expired/used. */
export async function validateInvite(token: string): Promise<InviteValidateResult> {
  const res = await fetch(`${API_URL}/invites/validate/${token}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Invalid invite');
  }
  return res.json();
}

/** Public — no auth required. Returns JWT on success. */
export async function acceptInvite(data: {
  token: string;
  email: string;
  password: string;
  full_name: string;
}): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API_URL}/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Failed to accept invite');
  }
  return res.json();
}

export async function listInvites(): Promise<InviteListItem[]> {
  const res = await authFetch('/invites/list');
  if (!res.ok) throw new Error('Failed to load invites');
  return res.json();
}

// ── Market Overview ────────────────────────────────────────────────────────

export type WatchlistEntry = {
  id: number;
  zip_code: string;
  alert_threshold: number;
  status: 'active' | 'paused';
  created_at: string;
  last_scanned_at: string | null;
};

export type MarketProperty = {
  id: number;
  zip_code: string;
  zillow_id: string;
  address: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  living_area: number | null;
  year_built: number | null;
  days_on_market: number | null;
  zestimate: number | null;
  price_reduction_30d: number | null;
  latitude: number | null;
  longitude: number | null;
  img_src: string | null;
  nearest_permit_distance_mi: number | null;
  nearest_permit_type: string | null;
  nearest_permit_date: string | null;
  nearest_permit_address: string | null;
  opportunity_score: number | null;
  score_breakdown: Record<string, number> | null;
  claude_summary: string | null;
  first_seen_at: string;
  last_updated_at: string;
};

export type MarketAlert = {
  id: number;
  property_id: number;
  score_at_alert: number;
  status: 'new' | 'reviewed' | 'interested' | 'passed';
  alerted_via: string;
  fired_at: string;
  property: MarketProperty;
};

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const res = await authFetch('/market/watchlist');
  return res.json();
}

export async function addWatchlistEntry(zip_code: string, alert_threshold = 60): Promise<WatchlistEntry> {
  const res = await authFetch('/market/watchlist', {
    method: 'POST',
    body: JSON.stringify({ zip_code, alert_threshold }),
  });
  return res.json();
}

export async function updateWatchlistEntry(id: number, updates: Partial<{ alert_threshold: number; status: string }>): Promise<WatchlistEntry> {
  const res = await authFetch(`/market/watchlist/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteWatchlistEntry(id: number): Promise<void> {
  await authFetch(`/market/watchlist/${id}`, { method: 'DELETE' });
}

export async function triggerScan(entryId: number): Promise<{ scanned: number; alerted: number; zip_code: string }> {
  const res = await authFetch(`/market/watchlist/${entryId}/scan`, { method: 'POST' });
  if (!res.ok) throw new Error('Scan failed');
  return res.json();
}

export async function getMarketProperties(zipCode: string): Promise<MarketProperty[]> {
  const res = await authFetch(`/market/properties/${zipCode}`);
  return res.json();
}

export async function getMarketAlerts(): Promise<MarketAlert[]> {
  const res = await authFetch('/market/alerts');
  return res.json();
}

export async function updateAlertStatus(id: number, alertStatus: string): Promise<MarketAlert> {
  const res = await authFetch(`/market/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: alertStatus }),
  });
  return res.json();
}
