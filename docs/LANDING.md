# Landing page notes

**Location:** [`../web/`](../web/)  
**Goal:** Visitor instantly gets it and wants to play a **murder mystery**.

## Lead with murder

The engine can do other mystery types later. The **landing page leads with murder** only — body, suspects, killer, accusation. Don’t explain the full platform surface area.

## Player-facing message hierarchy

1. **Headline question** — “Can you solve the murder mystery?”  
2. **What it is** — Rich, carefully crafted whodunits you investigate  
3. **What you do** — Interact with characters · explore locations · investigate objects & clues · catch the killer  
4. **Why AI (benefit, not thesis)** — adaptable conversations, immersion  
5. **Hook case** — Specific free murder (e.g. Pier at Low Tide)  
6. **Offer** — Free case → more mysteries on subscription  

## What we do *not* lead with

- “Various types of mysteries” / Nancy Drew / genre flexibility  
- Vision / platform language  
- AI architecture  
- Community publishing  
- Everything the product *could* be  

Those live in `PRODUCT.md` / `WHAT.md`, not the homepage.

## CTAs

| Priority | CTA | Current state |
|----------|-----|----------------|
| Primary | Send me the free case (email) | `localStorage` in `web/main.js` |
| Secondary | Show me a taste (dossier + dialogue snippet) | In-page |

## When play goes live

- Primary buttons → actual free case URL  
- Keep email for “new case” alerts if useful  
- Wire list to Formspree / Loops / Resend / etc.

## Sample case on page

**The Pier at Low Tide** is placeholder flavor — replace when the real free mystery is written. Keep the dialogue snippet style; it’s the “why play” in 4 lines.

## Design

Night desk + manila **case dossier**. Tone: invitation to play, not pitch deck.
