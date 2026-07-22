#!/usr/bin/env tsx
/**
 * Send an ad hoc branded email to players (docs/EMAIL.md).
 *
 *   pnpm send-email -- --to player@example.com [--to other@example.com]
 *       --subject "…" [--body path/to/body.txt] [--body-text "…"]
 *       [--cta "Label|https://…"] [--eyebrow "…"]
 *       [--all-users | --tier premium] [--send]
 *
 * Dry-run by default: prints the recipients, subject, and plain-text body,
 * and writes the rendered HTML to a temp file for eyeballing. Nothing is
 * sent unless --send is passed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { config as loadEnv } from "dotenv";
import { TIER_ORDER, type Tier } from "../src/access.js";
import { createPool, databaseUrl } from "../src/db.js";
import { renderEmailLayout, renderEmailText, sendEmail } from "../src/email.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// Same .env the API reads (RESEND_API_KEY, MAIL_FROM, DATABASE_URL).
loadEnv({ path: join(repoRoot, ".env"), quiet: true });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function usage(): never {
  console.error(`usage: pnpm send-email -- --to a@example.com [--to b@example.com]
    --subject "…" [--body file.txt | --body-text "…"]
    [--cta "Label|https://…"] [--eyebrow "…"]
    [--all-users | --tier <${TIER_ORDER.join("|")}>] [--send]`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const to: string[] = [];
  let allUsers = false;
  let tier: Tier | null = null;
  let subject: string | null = null;
  let bodyFile: string | null = null;
  let bodyText: string | null = null;
  let cta: { label: string; href: string } | null = null;
  let eyebrow: string | null = null;
  let send = false;

  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      console.error(`missing value for ${flag}`);
      usage();
    }
    return v;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--":
        // pnpm forwards the "--" separator itself; ignore it.
        break;
      case "--to":
        to.push(value(i, arg));
        i++;
        break;
      case "--all-users":
        allUsers = true;
        break;
      case "--tier": {
        const t = value(i, arg);
        if (!TIER_ORDER.includes(t as Tier)) {
          console.error(`unknown tier "${t}" (expected one of ${TIER_ORDER.join(", ")})`);
          process.exit(1);
        }
        tier = t as Tier;
        i++;
        break;
      }
      case "--subject":
        subject = value(i, arg);
        i++;
        break;
      case "--body":
        bodyFile = value(i, arg);
        i++;
        break;
      case "--body-text":
        bodyText = value(i, arg);
        i++;
        break;
      case "--cta": {
        const raw = value(i, arg);
        const sep = raw.indexOf("|");
        if (sep < 1 || sep === raw.length - 1) {
          console.error(`--cta must be "Label|URL", got "${raw}"`);
          process.exit(1);
        }
        cta = { label: raw.slice(0, sep), href: raw.slice(sep + 1) };
        i++;
        break;
      }
      case "--eyebrow":
        eyebrow = value(i, arg);
        i++;
        break;
      case "--send":
        send = true;
        break;
      default:
        console.error(`unknown argument: ${arg}`);
        usage();
    }
  }

  for (const addr of to) {
    if (!EMAIL_RE.test(addr)) {
      console.error(`invalid email address: "${addr}"`);
      process.exit(1);
    }
  }
  if (allUsers && tier) {
    console.error("--all-users and --tier are mutually exclusive");
    process.exit(1);
  }
  if (to.length === 0 && !allUsers && !tier) {
    console.error("no recipients: pass --to, --all-users, or --tier");
    usage();
  }
  if (!subject) {
    console.error("--subject is required");
    usage();
  }
  if (bodyFile && bodyText) {
    console.error("--body and --body-text are mutually exclusive");
    process.exit(1);
  }
  if (!bodyFile && !bodyText) {
    console.error("a body is required: --body <file> or --body-text \"…\"");
    usage();
  }

  return { to, allUsers, tier, subject, bodyFile, bodyText, cta, eyebrow, send };
}

function bodyParagraphs(opts: { bodyFile: string | null; bodyText: string | null }): string[] {
  const raw = opts.bodyFile
    ? readFileSync(opts.bodyFile, "utf8")
    // Shells pass "\n" through as two literal characters; honor both.
    : opts.bodyText!.replace(/\\n/g, "\n");
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    console.error("body is empty");
    process.exit(1);
  }
  return paragraphs;
}

async function resolveRecipients(opts: {
  to: string[];
  allUsers: boolean;
  tier: Tier | null;
}): Promise<string[]> {
  if (!opts.allUsers && !opts.tier) return opts.to;
  const pool = createPool(databaseUrl());
  try {
    const res = opts.tier
      ? await pool.query<{ email: string }>(
          `SELECT email FROM users WHERE tier = $1 ORDER BY created_at`,
          [opts.tier]
        )
      : await pool.query<{ email: string }>(
          `SELECT email FROM users ORDER BY created_at`
        );
    const emails = [...opts.to, ...res.rows.map((r) => r.email)];
    return [...new Set(emails)];
  } finally {
    await pool.end();
  }
}

function confirm(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const opts = parseArgs(process.argv.slice(2));
const paragraphs = bodyParagraphs(opts);
const recipients = await resolveRecipients(opts);
if (recipients.length === 0) {
  console.error("recipient list is empty");
  process.exit(1);
}

const eyebrow = opts.eyebrow ?? "Mystery Trove";
const html = renderEmailLayout({
  eyebrow,
  title: opts.subject!,
  paragraphs,
  cta: opts.cta ?? undefined,
});
const text = renderEmailText({
  title: opts.subject!,
  paragraphs,
  cta: opts.cta ?? undefined,
});

console.log(`Subject: ${opts.subject}`);
console.log(`Recipients (${recipients.length}):`);
for (const r of recipients) console.log(`  ${r}`);
console.log(`\n--- text ---\n${text}\n------------`);

if (!opts.send) {
  const preview = join(tmpdir(), `mystery-email-preview-${Date.now()}.html`);
  writeFileSync(preview, html);
  console.log(`\nDry run — nothing sent. HTML preview written to:\n  ${preview}`);
  console.log(`Re-run with --send to deliver.`);
  process.exit(0);
}

if (recipients.length > 5) {
  const answer = await confirm(
    `About to email ${recipients.length} recipients. Type ${recipients.length} to confirm: `
  );
  if (answer !== String(recipients.length)) {
    console.error("confirmation did not match — aborted");
    process.exit(1);
  }
}

let failed = 0;
for (const to of recipients) {
  try {
    await sendEmail({ to, subject: opts.subject!, html, text });
    console.log(`ok      ${to}`);
  } catch (err) {
    failed++;
    console.error(`failed  ${to}: ${err instanceof Error ? err.message : err}`);
  }
  await sleep(200);
}
if (failed > 0) {
  console.error(`${failed} of ${recipients.length} sends failed`);
  process.exit(1);
}
console.log(`Sent ${recipients.length} email(s).`);
