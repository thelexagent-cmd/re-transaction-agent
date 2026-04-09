"""Wrap plain-text or HTML email content in a branded HTML shell."""


def wrap_email_html(body: str, subject: str, from_name: str = "Lex Transaction Agent") -> str:
    """
    Wraps a plain-text body in a branded HTML email template.
    If body already contains <html, returns as-is.
    Converts newlines to <br> tags.
    """
    if "<html" in body.lower():
        return body

    # Convert plain text to HTML paragraphs
    html_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    html_body = "<br>".join(html_body.split("\n"))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0D1B4B 0%,#1E3A8A 100%);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;">Lex</span>
                  <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.14em;text-transform:uppercase;display:block;margin-top:2px;">Transaction AI</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="font-size:15px;line-height:1.7;color:#374151;margin:0;">
              {html_body}
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.6;">
              This email was sent by {from_name}. Please do not reply directly to this email.<br>
              If you have questions, contact your agent directly.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
