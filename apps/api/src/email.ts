/**
 * Branded transactional email (docs/EMAIL.md).
 *
 * One shared design for every platform email — magic links, receipts,
 * case releases, ad hoc customer-service sends: night-navy ground, a
 * candle-gold bordered panel, serif headline, mono uppercase eyebrows,
 * and the ornamental divider from the landing page. Email-safe: table
 * layout, inline styles, solid-color fallbacks under every gradient, and
 * web fonts (Cinzel) that degrade to Georgia/serif in Gmail & Outlook.
 *
 * Callers pass plain text only — paragraphs, CTA hrefs, and notes are
 * HTML-escaped here so escaping stays centralized. Every send includes a
 * plain-text version (`renderEmailText`) alongside the HTML layout.
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailCta = { label: string; href: string };

export function renderEmailLayout(args: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  cta?: EmailCta;
  /** Dim mono line directly under the CTA button (e.g. an expiry warning). */
  ctaHint?: string;
  /** Italic dim line at the foot of the panel. */
  note?: string;
  /** Hidden inbox-preview snippet. */
  preheader?: string;
}): string {
  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  // Email-safe logo: the transparent webp gets mangled by image proxies
  // (Gmail rasterizes the alpha to a black box), so we serve a PNG with
  // the panel color (#0b1018) baked in — it blends in by construction.
  const logoUrl = `${webOrigin}/brand/logo-email.png`;

  const candle = "#d4b56a";
  const candleDim = "#8a7348";
  const fog = "#9aafc4";
  const serif = `Cinzel, 'Playfair Display', Georgia, 'Times New Roman', serif`;
  const mono = `'Courier New', Courier, monospace`;

  // Outlook enforces a minimum cell height, so a background-colored cell
  // becomes a thick bar; a 1px bottom border stays a hairline everywhere.
  const divider = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="220" align="center" style="margin:0 auto;">
        <tr>
          <td style="font-size:1px;line-height:1px;border-bottom:1px solid ${candleDim};">&nbsp;</td>
          <td width="28" align="center" style="color:${candle};font-size:10px;line-height:1;">&#9670;</td>
          <td style="font-size:1px;line-height:1px;border-bottom:1px solid ${candleDim};">&nbsp;</td>
        </tr>
      </table>`;

  const preheaderRow = args.preheader
    ? `  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(args.preheader)}
  </div>
`
    : "";

  const paragraphRows = args.paragraphs
    .map(
      (p) => `          <tr>
            <td align="center" style="padding:16px 48px 0;">
              <p style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:15px;line-height:1.7;color:${fog};">
                ${escapeHtml(p)}
              </p>
            </td>
          </tr>`
    )
    .join("\n");

  const ctaRows = args.cta
    ? `          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" bgcolor="${candle}"
                    style="border:1px solid #e8cd8a;background:${candle};background:linear-gradient(180deg,#e3c47e 0%,${candle} 55%,#b8985a 100%);">
                    <a href="${escapeHtml(args.cta.href)}"
                      style="display:inline-block;padding:13px 36px;font-family:${serif};font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#12161c;text-decoration:none;">
                      ${escapeHtml(args.cta.label)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
`
    : "";

  const ctaHintRow = args.ctaHint
    ? `          <tr>
            <td align="center" style="padding:18px 40px 0;">
              <p style="margin:0;font-family:${mono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${candleDim};">${escapeHtml(args.ctaHint)}</p>
            </td>
          </tr>
`
    : "";

  const ctaUrlRow = args.cta
    ? `          <tr>
            <td align="center" style="padding:20px 48px 0;">
              <a href="${escapeHtml(args.cta.href)}" style="font-family:Georgia, 'Times New Roman', serif;font-size:11px;line-height:1.6;color:#5a6a7c;word-break:break-all;">${escapeHtml(args.cta.href)}</a>
            </td>
          </tr>
`
    : "";

  const noteRow = args.note
    ? `          <tr>
            <td align="center" style="padding:16px 48px 36px;">
              <p style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:12px;font-style:italic;line-height:1.6;color:#5a6a7c;">
                ${escapeHtml(args.note)}
              </p>
            </td>
          </tr>
`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(args.eyebrow)}</title>
  <!--[if !mso]><!-->
  <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');</style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#05080e;">
${preheaderRow}  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#05080e;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#0b1018;border:1px solid #2a3a4a;border-top:2px solid ${candle};">
          <tr>
            <td align="center" style="padding:40px 40px 8px;">
              <img src="${logoUrl}" alt="MYSTERY TROVE" width="180"
                style="display:block;border:0;width:180px;max-width:60%;height:auto;margin:0 auto;color:${candle};font-family:${serif};font-size:18px;letter-spacing:6px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 40px 0;">
              <p style="margin:0;font-family:${mono};font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${candle};">${escapeHtml(args.eyebrow)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 40px 0;">
              <h1 style="margin:0;font-family:${serif};font-size:26px;font-weight:700;line-height:1.3;letter-spacing:1px;text-transform:uppercase;color:#e8dfd0;">${escapeHtml(args.title)}</h1>
            </td>
          </tr>
${paragraphRows}
${ctaRows}${ctaHintRow}          <tr>
            <td style="padding:28px 48px 0;">
              ${divider}
            </td>
          </tr>
${ctaUrlRow}${noteRow}        </table>
        <p style="margin:20px 0 0;font-family:${mono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${candleDim};" align="center">
          MysteryTrove.com &middot; mysteries you step inside and solve
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText(args: {
  title: string;
  paragraphs: string[];
  cta?: EmailCta;
  note?: string;
}): string {
  const lines = [args.title, "", args.paragraphs.join("\n\n")];
  if (args.cta) lines.push("", `${args.cta.label}: ${args.cta.href}`);
  if (args.note) lines.push("", args.note);
  lines.push("", "— MysteryTrove.com · mysteries you step inside and solve");
  return lines.join("\n");
}

/**
 * One email via the Resend API. Throws EmailSendError on a missing key or
 * a non-2xx from the API (e.g. an unverified/misconfigured MAIL_FROM
 * sender, which Resend rejects with 403); the error carries the upstream
 * status/body so callers can log the real cause instead of an opaque 500.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailSendError("resend_not_configured");
  const from =
    process.env.MAIL_FROM ?? "Mystery <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmailSendError(
      `resend_failed_${res.status}`,
      res.status,
      body.slice(0, 500)
    );
  }
}
