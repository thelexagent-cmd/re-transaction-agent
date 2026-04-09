'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Mail, Plus, Edit3, Trash2, Eye, Copy, Save, X, ChevronRight, Zap } from 'lucide-react';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate as apiDeleteTemplate,
} from '@/lib/api';
import type { EmailTemplate as ApiTemplate } from '@/lib/api';

interface TemplateView {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  trigger: string;
  createdAt: string;
  updatedAt: string;
}

function toView(t: ApiTemplate): TemplateView {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    category: t.category,
    trigger: inferTrigger(t.name),
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function inferTrigger(name: string): string {
  if (name === 'Under Contract Congratulations') return 'Auto: Under Contract';
  if (name === 'Inspection Results — Repair Request') return 'Auto: Inspection Done';
  if (name === 'Clear to Close') return 'Auto: Clear to Close';
  if (name === 'Closing Date Reminder') return 'Auto: 3 Days to Close';
  if (name === 'Post-Closing Thank You') return 'Auto: Closed';
  return 'Manual only';
}

const TRIGGER_CFG: Record<string, { color: string; bg: string; border: string }> = {
  'Manual only':              { color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  'Auto: Under Contract':     { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.2)' },
  'Auto: Inspection Done':    { color: '#fb923c', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.2)' },
  'Auto: Clear to Close':     { color: '#34d399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)' },
  'Auto: 3 Days to Close':    { color: '#f87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)' },
  'Auto: Closed':             { color: '#a3e635', bg: 'rgba(132,204,22,0.1)',   border: 'rgba(132,204,22,0.2)' },
};

const DEFAULT_TEMPLATES: TemplateView[] = [
  {
    id: -1, name: 'Introduction to Buyer', subject: 'Welcome — Your Transaction Is Underway | {{property_address}}',
    category: 'Onboarding', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nWelcome! I am thrilled to be working with you on the purchase of {{property_address}}.\n\nKey Contacts:\n- Your Agent: {{agent_name}} | {{agent_phone}} | {{agent_email}}\n- Title Company: {{title_company}}\n- Lender: {{lender_name}}\n\nImportant Deadlines:\n- Inspection Deadline: {{inspection_deadline}}\n- Financing Contingency: {{financing_deadline}}\n- Estimated Closing Date: {{closing_date}}\n\nWarm regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -2, name: 'Introduction to Seller', subject: "We're Under Contract — What Happens Next | {{property_address}}",
    category: 'Onboarding', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{seller_name}},\n\nCongratulations — you are officially under contract for the sale of {{property_address}}!\n\nTimeline Overview:\n- Inspection Period Ends: {{inspection_deadline}}\n- Appraisal Expected: {{appraisal_date}}\n- Estimated Closing: {{closing_date}}\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -3, name: 'Inspection Reminder', subject: 'ACTION REQUIRED: Schedule Your Home Inspection | {{property_address}}',
    category: 'Milestones', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nThis is a reminder that your home inspection must be scheduled and completed by {{inspection_deadline}}.\n\nBest,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -4, name: 'Under Contract Congratulations', subject: "Congratulations — You're Under Contract! | {{property_address}}",
    category: 'Milestones', trigger: 'Auto: Under Contract', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nCongratulations! Your offer on {{property_address}} has been accepted.\n\nImmediate Next Steps:\n1. EMD of {{emd_amount}} is due by {{emd_due_date}}\n2. Schedule home inspection before {{inspection_deadline}}\n3. Notify your lender to begin processing\n\nWarmly,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -5, name: 'Closing Date Reminder', subject: 'Your Closing Is in 3 Days | {{property_address}}',
    category: 'Milestones', trigger: 'Auto: 3 Days to Close', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nYour closing is scheduled for {{closing_date}} — just 3 days away!\n\nWHAT TO BRING:\n- Government-issued photo ID\n- Cashier's check for {{cash_to_close}}\n- Proof of homeowner's insurance\n\nWIRE FRAUD WARNING: NEVER wire funds based solely on email. Always call {{agent_phone}} to verify.\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -6, name: 'Post-Closing Thank You', subject: 'Congratulations on Your New Home! | {{property_address}}',
    category: 'Follow-Up', trigger: 'Auto: Closed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nCongratulations — you are officially a homeowner!\n\nA Few Reminders:\n- Change the locks as soon as possible\n- File for Homestead Exemption (deadline: March 1st)\n- Keep your closing documents safe\n\nIf you enjoyed working with me, I'd appreciate a review:\n{{review_link}}\n\nWarmly,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -7, name: 'Document Request — Buyer', subject: 'Documents Needed to Keep Your Transaction on Track | {{property_address}}',
    category: 'Milestones', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nTo keep your transaction on track, we need the following documents by {{document_deadline}}:\n\n- {{document_1}}\n- {{document_2}}\n- {{document_3}}\n\nUpload here: {{portal_link}}\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -8, name: 'Document Request — Lender', subject: 'Documents Needed from Your Lending Team | {{property_address}}',
    category: 'Milestones', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{lender_name}},\n\nTo keep {{property_address}} on schedule for closing on {{closing_date}}, we need:\n\n- Commitment Letter\n- Clear to Close (CTC) confirmation\n- Closing Disclosure (CD) — at least 3 business days before closing\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -9, name: 'FIRPTA Notice', subject: 'Important: FIRPTA Withholding Notice | {{property_address}}',
    category: 'Compliance', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{seller_name}},\n\nAs a foreign person selling U.S. property, FIRPTA requires withholding of up to 15% of gross sale price.\n\n- Estimated withholding: {{firpta_withholding_amount}}\n- Consult a tax professional and complete IRS Form 8288.\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -10, name: 'Earnest Money Deposit Reminder', subject: 'EMD Due in 48 Hours | {{property_address}}',
    category: 'Milestones', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nYour EMD of {{emd_amount}} is due by {{emd_due_date}}.\n\nPayable to: {{escrow_company}}\n\nIMPORTANT: Call {{agent_phone}} to verify wire instructions before sending any money.\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -11, name: 'Inspection Results — Repair Request', subject: 'Inspection Complete — Repair Negotiations Begin | {{property_address}}',
    category: 'Milestones', trigger: 'Auto: Inspection Done', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nThe inspection for {{property_address}} is complete.\n\nItems Being Negotiated:\n- {{repair_item_1}}\n- {{repair_item_2}}\n\nRepair request deadline: {{repair_request_deadline}}\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -12, name: 'Clear to Close', subject: 'CLEAR TO CLOSE — Final Steps | {{property_address}}',
    category: 'Milestones', trigger: 'Auto: Clear to Close', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nYour lender has issued a Clear to Close for {{property_address}}!\n\nNext Steps:\n1. Review your Closing Disclosure\n2. Final walkthrough: {{walkthrough_date}}\n3. Closing: {{closing_date}} at {{closing_time}}\n4. Bring {{cash_to_close}}\n\nSee you at closing!\n\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -13, name: 'Wire Fraud Warning', subject: 'IMPORTANT: Wire Fraud Warning for Your Closing | {{property_address}}',
    category: 'Compliance', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nWIRE FRAUD WARNING:\n\n1. ALWAYS call to verify — Before wiring ANY funds, call {{agent_phone}}\n2. NEVER click links in emails claiming to have wire instructions\n3. NEVER trust last-minute changes without verbal confirmation\n\nStay safe,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -14, name: 'Title Insurance Explanation', subject: 'Understanding Your Title Insurance | {{property_address}}',
    category: 'Onboarding', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nTitle insurance protects you against problems with the ownership history of {{property_address}}.\n\nTwo Types:\n1. Lender's Policy (required) — protects the lender\n2. Owner's Policy (recommended) — protects you\n\nEstimated Owner's Policy: {{owners_policy_amount}}\n\nBest regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -15, name: 'Foreign National Welcome', subject: 'Welcome — Important Info for International Buyers | {{property_address}}',
    category: 'Compliance', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},\n\nWelcome! As an international buyer, please note:\n\nFIRPTA: When you sell U.S. property, up to 15% withholding may apply.\n\nRequired Documents:\n- Valid passport\n- Proof of funds\n- ITIN or SSN\n- Wire transfer documentation\n\nAtentamente / Best regards,\n{{agent_name}}\n{{brokerage_name}}\n{{agent_phone}} | {{agent_email}}`,
  },
];

function renderPreview(body: string): React.ReactNode {
  const parts = body.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part) ? (
      <span key={i} className="rounded px-0.5 font-mono" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.75rem', border: '1px solid rgba(251,191,36,0.2)' }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const cfg = TRIGGER_CFG[trigger] ?? TRIGGER_CFG['Manual only'];
  const isAuto = trigger.startsWith('Auto:');
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, letterSpacing: '0.03em' }}>
      {isAuto && <Zap className="h-2.5 w-2.5" />}
      {trigger}
    </span>
  );
}

const CATEGORIES = ['All', 'Onboarding', 'Milestones', 'Follow-Up', 'Compliance'];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
  width: '100%',
};

export default function TemplatesPage() {
  const { data: apiTemplates, error, isLoading, mutate } = useSWR('/templates', getTemplates, { revalidateOnFocus: false });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<TemplateView | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [copied, setCopied] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const templates: TemplateView[] = apiTemplates && apiTemplates.length > 0
    ? apiTemplates.map(toView)
    : (!isLoading ? DEFAULT_TEMPLATES : []);

  const filtered = categoryFilter === 'All' ? templates : templates.filter((t) => t.category === categoryFilter);
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function handleSelect(id: number) { setSelectedId(id); setEditing(null); setIsNew(false); setPreview(false); }
  function handleEdit(template: TemplateView) { setEditing({ ...template }); setPreview(false); }
  function handleNew() {
    setEditing({ id: 0, name: 'New Template', subject: '', body: '', category: 'Onboarding', trigger: 'Manual only', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setIsNew(true); setSelectedId(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true); setSaveMsg('');
    try {
      if (isNew) {
        const created = await createTemplate({ name: editing.name, subject: editing.subject, body: editing.body, category: editing.category });
        await mutate(); setSelectedId(created.id);
      } else {
        await updateTemplate(editing.id, { name: editing.name, subject: editing.subject, body: editing.body, category: editing.category });
        await mutate(); setSelectedId(editing.id);
      }
      setEditing(null); setIsNew(false); setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch { setSaveMsg('Save failed'); setTimeout(() => setSaveMsg(''), 3000); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this template?')) return;
    try { await apiDeleteTemplate(id); await mutate(); if (selectedId === id) setSelectedId(null); } catch { /* ignore */ }
  }

  function handleCopy(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); });
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Left: Template List */}
      <div className="w-72 flex-shrink-0 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-surface)', borderRight: '1px solid rgba(148,163,184,0.07)' }}>
        {/* Header */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <Mail className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
              </div>
              <h1 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Email Templates</h1>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-1 rounded-lg transition-all duration-150"
              style={{ padding: '0.3125rem 0.625rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 6px rgba(59,130,246,0.3)' }}
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="rounded-full px-2 py-0.5 transition-all duration-150"
                style={{
                  fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  background: categoryFilter === cat ? 'rgba(59,130,246,0.15)' : 'rgba(148,163,184,0.06)',
                  color: categoryFilter === cat ? '#60a5fa' : '#3d5068',
                  border: categoryFilter === cat ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(148,163,184,0.08)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-center" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No templates</div>
          )}
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelect(tpl.id)}
              className="w-full text-left px-4 py-3 transition-all duration-150"
              style={{
                borderBottom: '1px solid rgba(148,163,184,0.05)',
                borderLeft: selectedId === tpl.id ? '2px solid #3b82f6' : '2px solid transparent',
                background: selectedId === tpl.id ? 'rgba(59,130,246,0.07)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (selectedId !== tpl.id) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)'; }}
              onMouseLeave={(e) => { if (selectedId !== tpl.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{tpl.name}</div>
                  <div className="truncate mt-0.5" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{tpl.subject}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: '0.625rem', fontWeight: 600, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', color: 'var(--text-muted)' }}>
                      {tpl.category}
                    </span>
                    <TriggerBadge trigger={tpl.trigger} />
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Editor / Preview */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
        {editing ? (
          <div className="flex flex-col h-full">
            {/* Edit header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isNew ? 'New Template' : `Edit: ${editing.name}`}
              </h2>
              <div className="flex items-center gap-2">
                {saveMsg && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: saveMsg === 'Saved!' ? '#34d399' : '#f87171' }}>{saveMsg}</span>}
                <button
                  onClick={() => { setEditing(null); setIsNew(false); }}
                  className="inline-flex items-center gap-1 rounded-lg transition-all duration-150"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg transition-all duration-150 disabled:opacity-50"
                  style={{ padding: '0.375rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: saving ? 'none' : '0 2px 6px rgba(59,130,246,0.3)' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Template Name</label>
                  <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Category</label>
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                  >
                    <option value="Onboarding">Onboarding</option>
                    <option value="Milestones">Milestones</option>
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Subject Line</label>
                <input type="text" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Email subject..." style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
                  Body <span style={{ marginLeft: '8px', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>Use {'{{variable_name}}'} for dynamic values</span>
                </label>
                <textarea
                  value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={18} placeholder="Write your email template here..."
                  className="font-mono resize-none"
                  style={{ ...inputStyle, lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              {/* Variable chips */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Common Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {['{{buyer_name}}','{{seller_name}}','{{agent_name}}','{{property_address}}','{{closing_date}}','{{purchase_price}}','{{portal_link}}','{{brokerage_name}}','{{agent_phone}}','{{agent_email}}','{{inspection_deadline}}','{{emd_amount}}'].map((v) => (
                    <button key={v} onClick={() => setEditing({ ...editing, body: editing.body + v })} className="rounded px-1.5 py-0.5 transition-all duration-150 font-mono" style={{ fontSize: '0.75rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col h-full">
            {/* View header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'var(--bg-surface)' }}>
              <div>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selected.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: '0.625rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                    {selected.category}
                  </span>
                  <TriggerBadge trigger={selected.trigger} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { label: preview ? 'Raw' : 'Preview', icon: <Eye className="h-3.5 w-3.5" />, action: () => setPreview((v) => !v), active: preview },
                  { label: copied === selected.id ? 'Copied!' : 'Copy', icon: <Copy className="h-3.5 w-3.5" />, action: () => handleCopy(selected.body, selected.id), active: copied === selected.id },
                  { label: 'Edit', icon: <Edit3 className="h-3.5 w-3.5" />, action: () => handleEdit(selected), active: false },
                ].map(({ label, icon, action, active }) => (
                  <button key={label} onClick={action} className="inline-flex items-center gap-1.5 rounded-lg transition-all duration-150"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)', border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(148,163,184,0.1)', color: active ? '#60a5fa' : '#94a3b8' }}>
                    {icon} {label}
                  </button>
                ))}
                {selected.id > 0 && (
                  <button onClick={() => handleDelete(selected.id)} className="inline-flex items-center gap-1.5 rounded-lg transition-all duration-150"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                {/* Email header */}
                <div className="px-6 py-4" style={{ background: 'rgba(148,163,184,0.03)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Subject</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {preview ? <span>{renderPreview(selected.subject)}</span> : selected.subject}
                  </div>
                </div>
                {/* Body */}
                <div className="px-6 py-5">
                  {preview ? (
                    <pre style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body, inherit)', lineHeight: 1.7 }}>
                      {renderPreview(selected.body)}
                    </pre>
                  ) : (
                    <pre style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
                      {selected.body}
                    </pre>
                  )}
                </div>
              </div>

              {/* Variables used */}
              {(() => {
                const vars = [...new Set([...selected.body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[0]))];
                if (vars.length === 0) return null;
                return (
                  <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Variables in this template</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map((v) => (
                        <span key={v} className="rounded px-2 py-0.5 font-mono" style={{ fontSize: '0.75rem', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid var(--border)' }}>
                <Mail className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Select a template to view it</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
