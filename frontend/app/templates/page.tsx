'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Mail, Plus, Edit3, Trash2, Eye, Copy, Save, X, ChevronRight } from 'lucide-react';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate as apiDeleteTemplate,
} from '@/lib/api';
import type { EmailTemplate as ApiTemplate } from '@/lib/api';

// Local template shape for the editor (maps from API shape)
interface TemplateView {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
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
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

const DEFAULT_TEMPLATES: TemplateView[] = [
  {
    id: -1,
    name: 'Introduction to Buyer',
    subject: 'Welcome — Your Real Estate Transaction Is Underway',
    category: 'Onboarding',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Welcome! I'm thrilled to be working with you on the purchase of {{property_address}}.

I wanted to reach out to introduce myself formally and let you know what to expect over the coming weeks.

**What happens next:**
1. We will review the contract together and ensure all deadlines are clear
2. You will need to schedule a home inspection within {{inspection_days}} days
3. Your lender will begin the financing process

Please don't hesitate to reach out at any time. My direct line is {{agent_phone}} and I'm available 7 days a week.

Looking forward to a smooth transaction!

Warm regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}}
{{agent_email}}`,
  },
];

// Highlight template variables like {{variable_name}}
function renderPreview(body: string): React.ReactNode {
  const parts = body.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part) ? (
      <span key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5 font-mono text-xs">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const CATEGORIES = ['All', 'Onboarding', 'Milestones', 'Follow-Up'];

export default function TemplatesPage() {
  const { data: apiTemplates, error, isLoading, mutate } = useSWR('/templates', getTemplates, {
    revalidateOnFocus: false,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<TemplateView | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [copied, setCopied] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Use API templates, or default templates as fallback if API fails or returns empty
  const templates: TemplateView[] = apiTemplates && apiTemplates.length > 0
    ? apiTemplates.map(toView)
    : (!isLoading ? DEFAULT_TEMPLATES : []);

  const filtered = categoryFilter === 'All'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function handleSelect(id: number) {
    setSelectedId(id);
    setEditing(null);
    setIsNew(false);
    setPreview(false);
  }

  function handleEdit(template: TemplateView) {
    setEditing({ ...template });
    setPreview(false);
  }

  function handleNew() {
    const newT: TemplateView = {
      id: 0,
      name: 'New Template',
      subject: '',
      body: '',
      category: 'Onboarding',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditing(newT);
    setIsNew(true);
    setSelectedId(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveMsg('');
    try {
      if (isNew) {
        const created = await createTemplate({
          name: editing.name,
          subject: editing.subject,
          body: editing.body,
          category: editing.category,
        });
        await mutate();
        setSelectedId(created.id);
      } else {
        await updateTemplate(editing.id, {
          name: editing.name,
          subject: editing.subject,
          body: editing.body,
          category: editing.category,
        });
        await mutate();
        setSelectedId(editing.id);
      }
      setEditing(null);
      setIsNew(false);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setSaveMsg('Save failed');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this template?')) return;
    try {
      await apiDeleteTemplate(id);
      await mutate();
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch {
      // ignore
    }
  }

  function handleCopy(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-0px)] items-center justify-center">
        <div className="text-slate-500 text-sm">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Left: Template List */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <h1 className="text-sm font-semibold text-slate-900">Email Templates</h1>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>
          {/* Category filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-slate-400 text-center">No templates</div>
          )}
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelect(tpl.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                selectedId === tpl.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{tpl.name}</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{tpl.subject}</div>
                  <span className="inline-flex mt-1 items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tpl.category}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 mt-1 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Editor / Preview */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {editing ? (
          // Edit mode
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
              <h2 className="text-sm font-semibold text-slate-900">
                {isNew ? 'New Template' : `Edit: ${editing.name}`}
              </h2>
              <div className="flex items-center gap-2">
                {saveMsg && <span className={`text-xs font-medium ${saveMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>}
                <button
                  onClick={() => { setEditing(null); setIsNew(false); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Template Name</label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Onboarding">Onboarding</option>
                    <option value="Milestones">Milestones</option>
                    <option value="Follow-Up">Follow-Up</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Subject Line</label>
                <input
                  type="text"
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Body
                  <span className="ml-2 text-slate-400 font-normal">Use &#123;&#123;variable_name&#125;&#125; for dynamic values</span>
                </label>
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={20}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
                  placeholder="Write your email template here..."
                />
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-800 mb-2">Common Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '{{buyer_name}}', '{{seller_name}}', '{{agent_name}}', '{{property_address}}',
                    '{{closing_date}}', '{{purchase_price}}', '{{portal_link}}', '{{brokerage_name}}',
                    '{{agent_phone}}', '{{agent_email}}'
                  ].map((v) => (
                    <button
                      key={v}
                      onClick={() => setEditing({ ...editing, body: editing.body + v })}
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800 hover:bg-amber-200 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : selected ? (
          // View / preview mode
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700 mt-1">
                  {selected.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreview((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    preview ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {preview ? 'Raw' : 'Preview'}
                </button>
                <button
                  onClick={() => handleCopy(selected.body, selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === selected.id ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleEdit(selected)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Email header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Subject</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {preview ? (
                      <span>{renderPreview(selected.subject)}</span>
                    ) : selected.subject}
                  </div>
                </div>
                {/* Body */}
                <div className="px-6 py-5">
                  {preview ? (
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {renderPreview(selected.body)}
                    </pre>
                  ) : (
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">
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
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Variables in this template</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map((v) => (
                        <span key={v} className="rounded bg-yellow-100 border border-yellow-200 px-2 py-0.5 text-xs font-mono text-yellow-800">
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
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Select a template to view it</p>
              <p className="text-xs mt-1">or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
