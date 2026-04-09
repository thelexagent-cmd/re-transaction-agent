"""Message templates for all outbound communications.

Each template is stored as a dict with 'subject', 'html', and 'text' keys.
Variables use Python {var_name} format syntax.

Usage:
    from app.services.templates import render_template
    subject, html, text = render_template("intro_buyer", buyer_name="Jane", ...)

Missing variables are left in place (e.g. {broker_name}) rather than raising KeyError.
"""

from __future__ import annotations

WIRE_FRAUD_WARNING_HTML = (
    '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0;">'
    '<strong style="color:#92400e;">&#9888;&#65039; WIRE FRAUD WARNING</strong>'
    '<p style="color:#92400e;margin:8px 0 0;font-size:13px;line-height:1.6;">'
    "Wire transfer instructions will NEVER be sent via email. Always verify wire instructions "
    "by calling your escrow or title officer directly at a phone number you independently verified. "
    "Do NOT use contact information from any email."
    "</p>"
    "</div>"
)

WIRE_FRAUD_WARNING_TEXT = (
    "\n⚠ WIRE FRAUD WARNING: Wire instructions will only come directly from "
    "{title_company}. Never wire funds based on instructions received via email "
    "without first calling the title company to confirm. "
    "Wire fraud is the #1 scam in real estate.\n"
)

# ---------------------------------------------------------------------------
# Helper: safe dict for format_map (missing keys render as {key} verbatim)
# ---------------------------------------------------------------------------

class _SafeDict(dict):
    def __missing__(self, key: str) -> str:  # type: ignore[override]
        return "{" + key + "}"


def render_template(name: str, **vars: str) -> tuple[str, str, str]:
    """Render a named template with the given variables.

    Args:
        name: Template key in TEMPLATES.
        **vars: Substitution variables.

    Returns:
        Tuple of (subject, html_body, text_body).

    Raises:
        KeyError: If the template name is not found.
    """
    tmpl = TEMPLATES[name]
    ctx = _SafeDict(vars)
    subject = tmpl["subject"].format_map(ctx)
    html = tmpl["html"].format_map(ctx)
    text = tmpl["text"].format_map(ctx)
    return subject, html, text


# ---------------------------------------------------------------------------
# Shared layout helpers
# ---------------------------------------------------------------------------

def _html_wrap(body: str) -> str:
    return (
        '<!DOCTYPE html>'
        '<html lang="en">'
        '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
        '<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">'
        '<tr><td align="center">'
        '<table width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
        # Header
        '<tr><td style="background:linear-gradient(135deg,#0D1B4B 0%,#1E3A8A 100%);padding:28px 32px;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr><td>'
        '<span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;">Lex</span>'
        '<span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.14em;text-transform:uppercase;display:block;margin-top:2px;">Transaction AI</span>'
        '</td></tr></table>'
        '</td></tr>'
        # Body
        '<tr><td style="padding:32px 32px 24px;font-size:15px;line-height:1.7;color:#374151;">'
        + body
        + '</td></tr>'
        # Divider
        '<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>'
        # Footer
        '<tr><td style="padding:20px 32px 28px;">'
        '<p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.6;">'
        'This email was sent by Lex Transaction Agent. Please do not reply directly to this email.<br>'
        'If you have questions, contact your agent directly.'
        '</p></td></tr>'
        '</table>'
        '</td></tr></table>'
        '</body></html>'
    )


def _sig() -> str:
    return (
        "<p style=\"margin-top:32px;\">Best regards,<br>"
        "<strong>{broker_name}</strong><br>"
        "{brokerage_name}</p>"
    )


def _sig_text() -> str:
    return "\nBest regards,\n{broker_name}\n{brokerage_name}\n"


# ---------------------------------------------------------------------------
# All templates
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, dict[str, str]] = {

    # ── Intro: buyer ─────────────────────────────────────────────────────────
    "intro_buyer": {
        "subject": "Your Transaction is Underway — {property_address}",
        "html": _html_wrap(
            "<p>Dear {buyer_name},</p>"
            "<p>Congratulations on your purchase agreement for "
            "<strong>{property_address}</strong>! "
            "My name is {broker_name} with {brokerage_name}, and I will be "
            "coordinating the administrative side of your transaction from "
            "contract to closing.</p>"
            "<p>Here is what you can expect over the coming weeks:</p>"
            "<ul>"
            "<li>I will track all required documents and deadlines on your behalf.</li>"
            "<li>You will receive status updates at each major milestone.</li>"
            "<li>If anything requires your attention, I will reach out directly.</li>"
            "<li>Your agent, <strong>{agent_name}</strong>, will remain your primary "
            "point of contact for negotiation and advisory matters.</li>"
            "</ul>"
            "<p>If you have any questions, please reply to this email or contact "
            "{broker_name} at {broker_email}.</p>"
            + _sig()
        ),
        "text": (
            "Dear {buyer_name},\n\n"
            "Congratulations on your purchase agreement for {property_address}!\n\n"
            "My name is {broker_name} with {brokerage_name}. I will be coordinating "
            "the administrative side of your transaction from contract to closing.\n\n"
            "What to expect:\n"
            "- I will track all required documents and deadlines on your behalf.\n"
            "- You will receive status updates at each major milestone.\n"
            "- If anything requires your attention, I will reach out directly.\n"
            "- Your agent, {agent_name}, will remain your primary point of contact.\n\n"
            "Questions? Reply to this email or contact {broker_name} at {broker_email}.\n"
            + _sig_text()
        ),
    },

    # ── Intro: seller ─────────────────────────────────────────────────────────
    "intro_seller": {
        "subject": "Transaction Underway — {property_address}",
        "html": _html_wrap(
            "<p>Dear {seller_name},</p>"
            "<p>Thank you for entrusting us with the sale of "
            "<strong>{property_address}</strong>. "
            "My name is {broker_name} with {brokerage_name}, and I will be "
            "managing the document and deadline coordination for this transaction.</p>"
            "<p>My role is to ensure the process runs smoothly so you can focus on "
            "your next chapter. Here is what I will handle:</p>"
            "<ul>"
            "<li>Tracking all required seller disclosures and documents.</li>"
            "<li>Monitoring key deadlines and alerting you if action is needed.</li>"
            "<li>Sending you progress updates as the transaction moves forward.</li>"
            "</ul>"
            "<p>Your listing agent will remain your primary point of contact for all "
            "negotiation matters. Please reply here or reach me at {broker_email} "
            "with any questions.</p>"
            + _sig()
        ),
        "text": (
            "Dear {seller_name},\n\n"
            "Thank you for entrusting us with the sale of {property_address}.\n\n"
            "My name is {broker_name} with {brokerage_name}. I will be managing "
            "document and deadline coordination for this transaction.\n\n"
            "What I will handle:\n"
            "- Tracking all required seller disclosures and documents.\n"
            "- Monitoring key deadlines and alerting you if action is needed.\n"
            "- Sending you progress updates as the transaction moves forward.\n\n"
            "Your listing agent remains your primary contact for negotiations.\n"
            "Questions? Reach me at {broker_email}.\n"
            + _sig_text()
        ),
    },

    # ── Intro: agent (both sides) ─────────────────────────────────────────────
    "intro_agent": {
        "subject": "New Transaction File — {property_address}",
        "html": _html_wrap(
            "<p>Dear {agent_name},</p>"
            "<p>I am writing to introduce myself as the transaction coordinator "
            "for <strong>{property_address}</strong> "
            "(Buyer: {buyer_name} / Seller: {seller_name}).</p>"
            "<p>I will be handling the administrative coordination of this deal "
            "including document tracking, deadline monitoring, and party "
            "communications on behalf of {brokerage_name}.</p>"
            "<p>Please feel free to route any document submissions or "
            "deadline-related questions my way. I will keep you updated as "
            "milestones are reached.</p>"
            "<p>Looking forward to a smooth closing.</p>"
            + _sig()
        ),
        "text": (
            "Dear {agent_name},\n\n"
            "I am writing to introduce myself as the transaction coordinator "
            "for {property_address} "
            "(Buyer: {buyer_name} / Seller: {seller_name}).\n\n"
            "I will handle the administrative coordination including document "
            "tracking, deadline monitoring, and party communications on behalf "
            "of {brokerage_name}.\n\n"
            "Please route document submissions or deadline questions my way. "
            "I will keep you updated at each milestone.\n\n"
            "Looking forward to a smooth closing.\n"
            + _sig_text()
        ),
    },

    # ── Intro: lender ─────────────────────────────────────────────────────────
    "intro_lender": {
        "subject": "Lender Introduction — {property_address}",
        "html": _html_wrap(
            "<p>Dear {lender_name},</p>"
            "<p>I am {broker_name} with {brokerage_name}, serving as transaction "
            "coordinator for the purchase of <strong>{property_address}</strong> "
            "by buyer <strong>{buyer_name}</strong>.</p>"
            "<p>I am reaching out to confirm you have received the executed "
            "purchase contract and all required documentation to begin the "
            "loan process.</p>"
            "<p>Please confirm receipt of the contract and let me know "
            "if anything additional is needed from our side. I will be "
            "monitoring the financing timeline and will follow up at key "
            "milestones.</p>"
            + _sig()
        ),
        "text": (
            "Dear {lender_name},\n\n"
            "I am {broker_name} with {brokerage_name}, transaction coordinator "
            "for the purchase of {property_address} by {buyer_name}.\n\n"
            "Please confirm you have received the executed purchase contract "
            "and all required documentation to begin the loan process.\n\n"
            "Let me know if anything additional is needed from our side.\n"
            + _sig_text()
        ),
    },

    # ── Intro: title company ──────────────────────────────────────────────────
    "intro_title": {
        "subject": "Title Company Introduction — {property_address}",
        "html": _html_wrap(
            "<p>Dear {title_name},</p>"
            "<p>I am {broker_name} with {brokerage_name}, transaction coordinator "
            "for the sale of <strong>{property_address}</strong> "
            "(Buyer: {buyer_name} / Seller: {seller_name}).</p>"
            "<p>Please confirm receipt of the executed contract and let me know "
            "once the title search has been ordered. I will monitor the title "
            "timeline and follow up as needed.</p>"
            "<p>As a reminder, please ensure all wire transfer instructions "
            "are communicated directly and verbally confirmed with the buyer "
            "per Florida wire fraud prevention best practices.</p>"
            + _sig()
        ),
        "text": (
            "Dear {title_name},\n\n"
            "I am {broker_name} with {brokerage_name}, transaction coordinator "
            "for {property_address} (Buyer: {buyer_name} / Seller: {seller_name}).\n\n"
            "Please confirm receipt of the executed contract and advise once "
            "the title search has been ordered.\n\n"
            "Reminder: all wire transfer instructions must be verbally confirmed "
            "with the buyer per Florida wire fraud prevention best practices.\n"
            + _sig_text()
        ),
    },

    # ── Document request: initial ─────────────────────────────────────────────
    "document_request_initial": {
        "subject": "Document Required: {document_name} — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>I am following up regarding the transaction for "
            "<strong>{property_address}</strong>.</p>"
            "<p>We are currently awaiting the following document:</p>"
            "<p style=\"font-size:16px;font-weight:bold;\">{document_name}</p>"
            "<p>This document is due by <strong>{deadline_date}</strong>. "
            "Please submit it at your earliest convenience to keep the "
            "transaction on track.</p>"
            "<p>If you have any questions or if this document has already been "
            "submitted, please reply to this email so I can update our records.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "I am following up regarding the transaction for {property_address}.\n\n"
            "We are currently awaiting: {document_name}\n\n"
            "This document is due by {deadline_date}. Please submit at your "
            "earliest convenience.\n\n"
            "If already submitted, please reply so I can update our records.\n"
            + _sig_text()
        ),
    },

    # ── Document follow-up: T-5 (polite reminder) ─────────────────────────────
    "document_followup_t5": {
        "subject": "Reminder: {document_name} Due in {days_until_due} Days — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>This is a friendly reminder that the following document is due "
            "in <strong>{days_until_due} days</strong> for the transaction at "
            "<strong>{property_address}</strong>:</p>"
            "<p style=\"font-size:16px;font-weight:bold;\">{document_name}</p>"
            "<p><strong>Due date: {deadline_date}</strong></p>"
            "<p>Please submit this document as soon as possible. "
            "If you have already submitted it or have any questions, "
            "reply to this email and I will update our records.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Friendly reminder: {document_name} is due in {days_until_due} days "
            "({deadline_date}) for the transaction at {property_address}.\n\n"
            "Please submit this document as soon as possible. "
            "If already submitted, reply and I will update our records.\n"
            + _sig_text()
        ),
    },

    # ── Document follow-up: T-3 (escalated) ──────────────────────────────────
    "document_followup_t3": {
        "subject": "Action Needed: {document_name} Due in {days_until_due} Days — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>I am following up again — "
            "<strong>{document_name}</strong> is due in "
            "<strong>{days_until_due} day(s)</strong> for the transaction at "
            "<strong>{property_address}</strong>.</p>"
            "<p><strong>Due date: {deadline_date}</strong></p>"
            "<p>This deadline is approaching quickly. Failure to submit on time "
            "could jeopardize the transaction. Please prioritize this immediately.</p>"
            "<p>If you have already submitted this document or if there is a "
            "reason for the delay, please reply to this email right away so "
            "I can advise the broker.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "ACTION NEEDED: {document_name} is due in {days_until_due} day(s) "
            "({deadline_date}) for {property_address}.\n\n"
            "This deadline is approaching quickly. Failure to submit on time "
            "could jeopardize the transaction. Please prioritize immediately.\n\n"
            "If already submitted or if there is a delay, please reply right away.\n"
            + _sig_text()
        ),
    },

    # ── Document follow-up: T-1 / overdue (urgent) ────────────────────────────
    "document_followup_t1": {
        "subject": "URGENT: {document_name} — {days_until_due} — {property_address}",
        "html": _html_wrap(
            '<p style="color:#c0392b;font-weight:bold;">URGENT — Immediate Action Required</p>'
            "<p>Dear {party_name},</p>"
            "<p>We have not yet received <strong>{document_name}</strong> for the "
            "transaction at <strong>{property_address}</strong>.</p>"
            "<p><strong>Status: {days_until_due}</strong></p>"
            "<p>This is the final notice before broker escalation. "
            "Please submit this document <strong>immediately</strong> or "
            "contact me right away to discuss the situation.</p>"
            "<p>Failure to respond may result in the transaction being placed "
            "at risk. The broker has been notified.</p>"
            + _sig()
        ),
        "text": (
            "URGENT — Immediate Action Required\n\n"
            "Dear {party_name},\n\n"
            "We have not received: {document_name}\n"
            "Transaction: {property_address}\n"
            "Status: {days_until_due}\n\n"
            "This is the final notice before broker escalation. "
            "Please submit IMMEDIATELY or contact me right away.\n\n"
            "The broker has been notified.\n"
            + _sig_text()
        ),
    },

    # ── Deadline reminder ─────────────────────────────────────────────────────
    "deadline_reminder": {
        "subject": "Deadline Reminder: {deadline_name} on {deadline_date} — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>This is a reminder that the following deadline is approaching "
            "for the transaction at <strong>{property_address}</strong>:</p>"
            "<p style=\"font-size:16px;font-weight:bold;\">{deadline_name}</p>"
            "<p><strong>Due: {deadline_date}</strong></p>"
            "<p>Please ensure all required actions are completed before this date. "
            "Reply to this email with any questions.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Deadline reminder for {property_address}:\n\n"
            "{deadline_name}\nDue: {deadline_date}\n\n"
            "Please ensure all required actions are completed before this date.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: EMD confirmed ──────────────────────────────────────────────
    "milestone_emd_confirmed": {
        "subject": "Earnest Money Deposit Confirmed — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>Great news — your earnest money deposit has been confirmed "
            "as received by the escrow agent for the transaction at "
            "<strong>{property_address}</strong>.</p>"
            "<p>The transaction is moving forward as planned. "
            "I will keep you updated as we reach the next milestones.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Your earnest money deposit has been confirmed for {property_address}.\n\n"
            "The transaction is moving forward. I will keep you updated.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: inspection complete ────────────────────────────────────────
    "milestone_inspection_complete": {
        "subject": "Inspection Complete — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>The home inspection for <strong>{property_address}</strong> "
            "has been completed.</p>"
            "<p>We are now in the inspection review period. Any repair requests "
            "or contingency resolutions will be coordinated through your agent. "
            "I will notify you once the inspection period has been formally "
            "resolved.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "The home inspection for {property_address} has been completed.\n\n"
            "We are now in the inspection review period. Any repair requests "
            "will be coordinated through your agent. "
            "I will notify you once the inspection period is formally resolved.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: loan commitment / financing approved ────────────────────────
    "milestone_loan_commitment": {
        "subject": "Financing Approved — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>Great news — the lender has issued a loan commitment for the "
            "transaction at <strong>{property_address}</strong>.</p>"
            "<p>Your financing has been approved. We are now in the final stages "
            "leading up to closing on <strong>{closing_date}</strong>. "
            "I will continue to monitor all remaining requirements and keep "
            "you informed.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Great news — financing has been approved for {property_address}.\n\n"
            "The lender has issued a loan commitment. "
            "We are in the final stages leading to closing on {closing_date}.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: Clear to Close ─────────────────────────────────────────────
    "milestone_ctc": {
        "subject": "Clear to Close — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>Your lender has issued a <strong>Clear to Close (CTC)</strong> "
            "for the transaction at <strong>{property_address}</strong>.</p>"
            "<p>This means all lender conditions have been satisfied. "
            "Closing is confirmed for <strong>{closing_date}</strong>. "
            "You will receive details about the closing appointment shortly.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Your lender has issued a Clear to Close for {property_address}.\n\n"
            "All lender conditions are satisfied. "
            "Closing is confirmed for {closing_date}.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: Closing Disclosure — WIRE FRAUD WARNING REQUIRED ───────────
    "milestone_closing_disclosure": {
        "subject": "Closing Disclosure Issued — Closing on {closing_date} — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>Your Closing Disclosure has been issued for the transaction at "
            "<strong>{property_address}</strong>.</p>"
            "<p>Closing is confirmed for <strong>{closing_date}</strong>. "
            "The mandatory 3-business-day TRID review period is now underway. "
            "Please review your Closing Disclosure carefully and contact your "
            "lender or agent if you have any questions about the figures.</p>"
            + WIRE_FRAUD_WARNING_HTML
            + "<p>Your closing coordinator will be in touch with final instructions "
            "including the time and location of your closing appointment.</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Your Closing Disclosure has been issued for {property_address}.\n\n"
            "Closing is confirmed for {closing_date}. "
            "The mandatory 3-business-day TRID review period is now underway. "
            "Review your Closing Disclosure carefully.\n"
            + WIRE_FRAUD_WARNING_TEXT
            + "\nYour closing coordinator will be in touch with final instructions.\n"
            + _sig_text()
        ),
    },

    # ── Milestone: closed / congratulations ───────────────────────────────────
    "milestone_closed": {
        "subject": "Congratulations — You're Closed! — {property_address}",
        "html": _html_wrap(
            "<p>Dear {party_name},</p>"
            "<p>Congratulations — your transaction for "
            "<strong>{property_address}</strong> has officially closed!</p>"
            "<p>The deed has been recorded and the property has transferred. "
            "It has been a pleasure working with you to get to this milestone.</p>"
            "<p>A complete summary of your transaction has been archived. "
            "Please don't hesitate to reach out if you need any documentation "
            "from your file.</p>"
            "<p>Wishing you all the best in your new home!</p>"
            + _sig()
        ),
        "text": (
            "Dear {party_name},\n\n"
            "Congratulations — {property_address} has officially closed!\n\n"
            "The deed has been recorded and the property has transferred. "
            "It has been a pleasure coordinating this transaction for you.\n\n"
            "A complete transaction summary has been archived. "
            "Reach out anytime if you need documentation from your file.\n\n"
            "Wishing you all the best!\n"
            + _sig_text()
        ),
    },

    # ── Broker alert email ────────────────────────────────────────────────────
    "broker_alert_email": {
        "subject": "Alert: {alert_subject} — {property_address}",
        "html": _html_wrap(
            '<div style="background-color:#fdecea;border-left:4px solid #c0392b;'
            'padding:16px;margin-bottom:24px;">'
            "<p style=\"margin:0;\"><strong>&#128276; Broker Alert</strong></p>"
            "<p style=\"margin:8px 0 0;\"><strong>Property:</strong> {property_address}</p>"
            "</div>"
            "<p>Dear {broker_name},</p>"
            "<p>{alert_message}</p>"
            "<p>Please log in to your dashboard to review and take action.</p>"
            + _sig()
        ),
        "text": (
            "BROKER ALERT\n"
            "Property: {property_address}\n\n"
            "Dear {broker_name},\n\n"
            "{alert_message}\n\n"
            "Please log in to your dashboard to review and take action.\n"
            + _sig_text()
        ),
    },
}
