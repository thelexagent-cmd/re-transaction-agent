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

// Local template shape for the editor (maps from API shape)
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

// Infer automation trigger label from template name
function inferTrigger(name: string): string {
  if (name === 'Under Contract Congratulations') return 'Auto: Under Contract';
  if (name === 'Inspection Results — Repair Request') return 'Auto: Inspection Done';
  if (name === 'Clear to Close') return 'Auto: Clear to Close';
  if (name === 'Closing Date Reminder') return 'Auto: 3 Days to Close';
  if (name === 'Post-Closing Thank You') return 'Auto: Closed';
  return 'Manual only';
}

// Trigger badge style map
const TRIGGER_STYLES: Record<string, string> = {
  'Manual only': 'bg-slate-100 text-slate-500',
  'Auto: Under Contract': 'bg-blue-100 text-blue-700',
  'Auto: Inspection Done': 'bg-orange-100 text-orange-700',
  'Auto: Clear to Close': 'bg-teal-100 text-teal-700',
  'Auto: 3 Days to Close': 'bg-red-100 text-red-700',
  'Auto: Closed': 'bg-green-100 text-green-700',
};

const DEFAULT_TEMPLATES: TemplateView[] = [
  {
    id: -1,
    name: 'Introduction to Buyer',
    subject: 'Welcome — Your Transaction Is Underway | {{property_address}}',
    category: 'Onboarding',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Welcome! I am thrilled to be working with you on the purchase of {{property_address}}.

Key Contacts:
- Your Agent: {{agent_name}} | {{agent_phone}} | {{agent_email}}
- Title Company: {{title_company}}
- Lender: {{lender_name}}

What Happens Next:
1. Review the contract together and confirm all deadlines
2. Schedule your home inspection within {{inspection_days}} days of contract execution
3. Your lender will begin the financing and appraisal process
4. Title company will begin the title search

Important Deadlines:
- Inspection Deadline: {{inspection_deadline}}
- Financing Contingency: {{financing_deadline}}
- Estimated Closing Date: {{closing_date}}

Please do not hesitate to reach out at any time. I am available 7 days a week.

Warm regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -2,
    name: 'Introduction to Seller',
    subject: "We're Under Contract — What Happens Next | {{property_address}}",
    category: 'Onboarding',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{seller_name}},

Congratulations — you are officially under contract for the sale of {{property_address}}!

Your Action Items:
1. Gather all property disclosures and HOA documents (if applicable)
2. Prepare for the buyer's home inspection on or around {{inspection_date}}
3. Continue maintaining the property in its current condition
4. Vacate the property by {{closing_date}} as agreed

Documents We Will Need From You:
- Seller's disclosure forms
- HOA contact and document package (if applicable)
- Copy of any warranties on appliances or roof
- Survey (if available)

Timeline Overview:
- Inspection Period Ends: {{inspection_deadline}}
- Appraisal Expected: {{appraisal_date}}
- Estimated Closing: {{closing_date}}

I will keep you updated every step of the way.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -3,
    name: 'Inspection Reminder',
    subject: 'ACTION REQUIRED: Schedule Your Home Inspection | {{property_address}}',
    category: 'Milestones',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

This is a reminder that your home inspection must be scheduled and completed by {{inspection_deadline}}.

Why the Inspection Matters:
The home inspection is one of the most important steps in your purchase. A licensed inspector will evaluate the property's condition — roof, foundation, electrical, plumbing, HVAC, and more.

Recommended Inspectors:
- {{inspector_name_1}} | {{inspector_phone_1}}
- {{inspector_name_2}} | {{inspector_phone_2}}

What to Expect:
- Inspections typically take 2-4 hours depending on property size
- You are encouraged to attend
- You will receive a full written report within 24 hours
- We can then negotiate repairs or credits based on findings

Please contact me immediately once your inspection is scheduled.

Best,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -4,
    name: 'Under Contract Congratulations',
    subject: "Congratulations — You're Under Contract! | {{property_address}}",
    category: 'Milestones',
    trigger: 'Auto: Under Contract',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Congratulations! Your offer on {{property_address}} has been accepted and you are now officially under contract.

Immediate Next Steps:
1. Earnest Money Deposit (EMD) of {{emd_amount}} is due by {{emd_due_date}}
2. Schedule your home inspection before {{inspection_deadline}}
3. Notify your lender to begin processing your loan

Coming Up:
- Home inspection
- Appraisal (ordered by lender)
- Title search and insurance
- Final loan approval
- Final walkthrough
- CLOSING — estimated {{closing_date}}

I will be with you every step of the way.

Warmly,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -5,
    name: 'Closing Date Reminder',
    subject: 'Your Closing Is in 3 Days | {{property_address}}',
    category: 'Milestones',
    trigger: 'Auto: 3 Days to Close',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Your closing is scheduled for {{closing_date}} — just 3 days away!

What to Bring to Closing:
- Government-issued photo ID (driver's license or passport)
- Cashier's check or confirmation of wire transfer for {{cash_to_close}}
- Proof of homeowner's insurance

WIRE FRAUD WARNING:
NEVER wire funds based solely on email instructions. Always call our office at {{agent_phone}} to verbally verify wiring instructions before sending any money.

Closing Details:
- Date: {{closing_date}}
- Time: {{closing_time}}
- Location: {{closing_location}}
- Closing Agent: {{closing_agent_name}}

Plan to arrive 10-15 minutes early. Closing typically takes 1-2 hours.

Congratulations — you are almost a homeowner!

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -6,
    name: 'Post-Closing Thank You',
    subject: 'Congratulations on Your New Home! | {{property_address}}',
    category: 'Follow-Up',
    trigger: 'Auto: Closed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Congratulations — you are officially a homeowner! It has been an absolute pleasure working with you on the purchase of {{property_address}}.

A Few Reminders Now That You Are Home:
- Change the locks as soon as possible
- Register your address for mail forwarding if you have not already
- File for Homestead Exemption (if applicable in your county) — the deadline is typically March 1st
- Keep your closing documents in a safe place

If you had a great experience working with me, I would truly appreciate a review:
{{review_link}}

Wishing you many years of happiness in your new home!

Warmly,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -7,
    name: 'Document Request — Buyer',
    subject: 'Documents Needed to Keep Your Transaction on Track | {{property_address}}',
    category: 'Milestones',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

To keep your transaction on track, we need the following documents from you by {{document_deadline}}:

Documents Needed:
- {{document_1}}
- {{document_2}}
- {{document_3}}

How to Submit:
You can upload documents directly through your secure client portal:
{{portal_link}}

Alternatively, you may email them to {{agent_email}} or bring them to our office.

Missing this deadline could delay your closing or put your contract at risk.

Thank you for your prompt attention to this matter.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -8,
    name: 'Document Request — Lender',
    subject: 'Documents Needed from Your Lending Team | {{property_address}}',
    category: 'Milestones',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{lender_name}},

I am following up on the transaction for {{property_address}} with our buyer {{buyer_name}}.

To keep this transaction on schedule for closing on {{closing_date}}, we need the following from your team by {{document_deadline}}:

Documents Needed:
- Commitment Letter
- Clear to Close (CTC) confirmation
- Closing Disclosure (CD) — at least 3 business days before closing
- Final loan approval documentation

Lender Portal:
{{lender_portal_link}}

Please let me know immediately if there are any issues or conditions that need to be resolved.

Thank you for your attention to this.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -9,
    name: 'FIRPTA Notice',
    subject: 'Important: FIRPTA Withholding Notice | {{property_address}}',
    category: 'Compliance',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{seller_name}},

As part of your real estate transaction for {{property_address}}, I need to inform you about an important federal tax requirement that may apply to your sale.

What Is FIRPTA?
The Foreign Investment in Real Property Tax Act (FIRPTA) requires buyers to withhold a portion of the sale price when purchasing property from a foreign person or entity.

Withholding Details:
- Standard withholding rate: 15% of the gross sales price
- Applicable sales price: {{purchase_price}}
- Estimated withholding amount: {{firpta_withholding_amount}}

What You Need to Do:
1. Consult with a tax professional or CPA familiar with international tax law
2. Determine if you qualify for a reduced withholding certificate from the IRS
3. Complete IRS Form 8288 (U.S. Withholding Tax Return for Dispositions by Foreign Persons of U.S. Real Property Interests)
4. Provide your ITIN if you do not have a U.S. Social Security Number

Key IRS Forms:
- Form 8288: Withholding tax return
- Form 8288-A: Statement of withholding
- Form 8288-B: Application for withholding certificate (to request reduction)

Please consult with a qualified tax professional as soon as possible.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -10,
    name: 'Earnest Money Deposit Reminder',
    subject: 'EMD Due in 48 Hours | {{property_address}}',
    category: 'Milestones',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

This is an urgent reminder that your Earnest Money Deposit (EMD) is due within 48 hours.

EMD Details:
- Amount Due: {{emd_amount}}
- Due Date: {{emd_due_date}}
- Payable To: {{escrow_company}}

How to Submit Your EMD:
Option 1 — Wire Transfer:
  Bank: {{escrow_bank}}
  Account: {{escrow_account}}
  Routing: {{escrow_routing}}

Option 2 — Cashier's Check:
  Made payable to: {{escrow_company}}
  Deliver to: {{escrow_address}}

IMPORTANT: Before wiring any funds, call {{agent_phone}} to verbally verify the wire instructions. Never rely on email instructions alone — wire fraud is real.

Failure to deliver the EMD on time may put your contract at risk.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -11,
    name: 'Inspection Results — Repair Request',
    subject: 'Inspection Complete — Repair Negotiations Begin | {{property_address}}',
    category: 'Milestones',
    trigger: 'Auto: Inspection Done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

The home inspection for {{property_address}} has been completed. Here is a summary of the findings and our next steps.

Items Being Negotiated:
- {{repair_item_1}}
- {{repair_item_2}}
- {{repair_item_3}}

Our Approach:
We have several options:
1. Request the seller to repair specific items before closing
2. Request a credit at closing in lieu of repairs
3. Accept the property as-is and negotiate price reduction

Timeline:
- We must submit our repair request by: {{repair_request_deadline}}
- Seller has until {{seller_response_deadline}} to respond

I will be sending our formal repair request to the seller's agent shortly.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -12,
    name: 'Clear to Close',
    subject: 'CLEAR TO CLOSE — Final Steps | {{property_address}}',
    category: 'Milestones',
    trigger: 'Auto: Clear to Close',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

Excellent news — your lender has issued a Clear to Close (CTC) for your loan on {{property_address}}!

This means your financing has been fully approved and we are ready to move to the final steps.

What Happens Now:
1. You will receive your Closing Disclosure (CD) — review it carefully and confirm your cash-to-close amount
2. Final walkthrough is scheduled for {{walkthrough_date}} at {{walkthrough_time}}
3. Closing is confirmed for {{closing_date}} at {{closing_time}}
4. Arrange your cashier's check or wire transfer for {{cash_to_close}}

Closing Location:
{{closing_location}}
{{closing_agent_name}} — {{closing_agent_phone}}

REMINDER: Always call to verify wire instructions before transferring funds.

See you at closing!

{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -13,
    name: 'Wire Fraud Warning',
    subject: 'IMPORTANT: Wire Fraud Warning for Your Closing | {{property_address}}',
    category: 'Compliance',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

As your closing date approaches, I want to share an extremely important warning about wire fraud — one of the fastest-growing scams targeting homebuyers.

WHAT IS WIRE FRAUD?
Criminals monitor real estate email communications and send fake wire instructions that appear to come from your agent, title company, or lender. If you wire money to the wrong account, it is nearly impossible to recover.

HOW TO PROTECT YOURSELF:
1. ALWAYS call to verify — Before wiring ANY funds, call our office directly at {{agent_phone}} using a number you find independently (not from an email)
2. NEVER click links in emails claiming to have wire instructions
3. NEVER trust a last-minute change in wire instructions without verbal confirmation
4. Confirm the FULL routing and account number verbally before wiring

OUR OFFICIAL CONTACT INFORMATION:
- Agent: {{agent_name}} | {{agent_phone}}
- Title Company: {{title_company}} | {{title_phone}}

If you ever receive wire instructions via email that seem off — even slightly — STOP and call us immediately.

Stay safe,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -14,
    name: 'Title Insurance Explanation',
    subject: 'Understanding Your Title Insurance | {{property_address}}',
    category: 'Onboarding',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}},

As part of your purchase of {{property_address}}, you will be purchasing title insurance. I want to make sure you fully understand what it covers and why it matters.

What Is Title Insurance?
Title insurance protects you against problems with the ownership history (title) of the property — things that may not be discovered during the title search.

Two Types of Title Insurance:

1. Lender's Title Insurance (required)
   - Protects your lender against title defects
   - Required by virtually all mortgage lenders
   - Does NOT protect you as the buyer

2. Owner's Title Insurance (strongly recommended)
   - Protects YOU as the property owner
   - One-time premium paid at closing
   - Covers you for as long as you own the property

What It Covers:
- Unknown liens or encumbrances on the property
- Forged documents or fraud in the chain of title
- Errors in public records
- Unknown heirs claiming ownership
- Boundary disputes

Your Premium:
- Estimated Owner's Policy: {{owners_policy_amount}}
- Estimated Lender's Policy: {{lenders_policy_amount}}

I strongly recommend purchasing the owner's title insurance policy. It is a small one-time cost for permanent peace of mind.

Best regards,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
  },
  {
    id: -15,
    name: 'Foreign National Welcome',
    subject: 'Welcome — Informacion Importante Para Compradores Internacionales | {{property_address}}',
    category: 'Compliance',
    trigger: 'Manual only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: `Dear {{buyer_name}} / Estimado/a {{buyer_name}},

--- ENGLISH ---

Welcome and congratulations on your decision to purchase property in the United States! I am honored to represent you in the purchase of {{property_address}}.

FIRPTA (Foreign Investment in Real Property Tax Act):
When you eventually sell U.S. property, federal law requires withholding of up to 15% of the gross sale price for tax purposes.

ITIN (Individual Taxpayer Identification Number):
If you do not have a U.S. Social Security Number, you will need an ITIN for tax reporting purposes (IRS Form W-7).

Required Documents for This Transaction:
- Valid passport (all buyers)
- Proof of funds or financing approval
- ITIN or SSN for tax reporting
- Wire transfer documentation from your financial institution

--- ESPANOL ---

Bienvenido/a y felicidades por su decision de comprar propiedad en los Estados Unidos.

FIRPTA: La ley federal requiere la retencion de hasta el 15% del precio de venta bruto para efectos fiscales cuando venda la propiedad.

ITIN: Si no tiene numero de Seguro Social de EE.UU., necesitara un ITIN (Formulario IRS W-7).

Documentos Requeridos:
- Pasaporte valido (todos los compradores)
- Comprobante de fondos o aprobacion de financiamiento
- ITIN o SSN para declaracion de impuestos
- Documentacion de transferencia bancaria

Atentamente,
{{agent_name}}
{{brokerage_name}}
{{agent_phone}} | {{agent_email}}`,
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

function TriggerBadge({ trigger }: { trigger: string }) {
  const style = TRIGGER_STYLES[trigger] ?? 'bg-slate-100 text-slate-500';
  const isAuto = trigger.startsWith('Auto:');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {isAuto && <Zap className="h-2.5 w-2.5" />}
      {trigger}
    </span>
  );
}

const CATEGORIES = ['All', 'Onboarding', 'Milestones', 'Follow-Up', 'Compliance'];

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
      trigger: 'Manual only',
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
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{tpl.name}</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{tpl.subject}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {tpl.category}
                    </span>
                    <TriggerBadge trigger={tpl.trigger} />
                  </div>
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
                    <option value="Compliance">Compliance</option>
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
                    '{{agent_phone}}', '{{agent_email}}', '{{inspection_deadline}}', '{{emd_amount}}',
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
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {selected.category}
                  </span>
                  <TriggerBadge trigger={selected.trigger} />
                </div>
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
