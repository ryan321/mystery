# Email

One branded design for every platform email, in `apps/api/src/email.ts`:

- `renderEmailLayout({ eyebrow, title, paragraphs, cta?, ctaHint?, note?, preheader? })` —
  the night-navy/candle-gold HTML shell (same design as the magic-link email).
  Callers pass **plain text only**; all escaping happens in the layout.
- `renderEmailText({ title, paragraphs, cta?, note? })` — the matching plain-text
  version. Every send includes both.
- `sendEmail({ to, subject, html, text })` — the Resend transport. Throws
  `EmailSendError` (carrying upstream status/body) when `RESEND_API_KEY` is
  missing or Resend rejects the send.

## Adding a transactional email

Build the content on the layout, then send. Sketch of a welcome email:

```ts
import { renderEmailLayout, renderEmailText, sendEmail } from "./email.js";

const paragraphs = [
  "Your account is ready. The gallery is open whenever you are.",
];
const cta = { label: "Enter the Gallery", href: "https://mysterytrove.com/gallery" };

await sendEmail({
  to: user.email,
  subject: "Welcome to Mystery Trove",
  html: renderEmailLayout({ eyebrow: "Welcome", title: "The door is open", paragraphs, cta }),
  text: renderEmailText({ title: "The door is open", paragraphs, cta }),
});
```

The magic-link email in `auth.ts` (`magicLinkEmailHtml` / `magicLinkEmailText`)
is the reference implementation.

## Ad hoc sends (CLI)

Hand-triggered, customer-service style sends — dry-run by default:

```
# Preview for one player (prints text, writes an HTML preview to a temp file)
pnpm send-email -- --to player@example.com \
    --subject "Your case awaits" \
    --body-text "Line one.\n\nLine two." \
    --cta "Step Inside|https://mysterytrove.com/gallery"

# Actually send it
pnpm send-email -- --to player@example.com --subject "…" --body-text "…" --send

# Broadcast to a tier (or --all-users); body paragraphs from a file
pnpm send-email -- --tier premium --subject "A new mystery" \
    --body ./announcement.txt --send
```

- `--body` files are split into paragraphs on blank lines; `--body-text`
  accepts literal `\n` sequences.
- `--send` with more than 5 recipients asks you to type the recipient count
  to confirm. Sends go out sequentially with a short pause between each.
- Required env (repo-root `.env`): `RESEND_API_KEY`, `MAIL_FROM`, and
  `DATABASE_URL` (only for `--all-users` / `--tier`).

Ad hoc sends have **no opt-out mechanism** — reserve them for account- and
service-related messages, never marketing.
