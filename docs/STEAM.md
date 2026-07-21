# Steam Launch Plan

**Status:** Proposal — no Steamworks account yet
**Date:** 2026-07-21
**Related:** [PRODUCT.md](./PRODUCT.md) (funnel & pricing posture), [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) (web access model this must map onto), [DEPLOY.md](./DEPLOY.md) (the API the Steam build talks to)

---

## 1. Verdict: is Steam a good fit?

**Yes — as the discovery channel, with a different business model than the web app.**
Steam is where this game's exact buyers already are (the *Case of the Golden
Idol* / *Obra Dinn* / *Her Story* audience), and store visibility, wishlists,
and festivals solve the problem the web app cannot solve alone: nobody can buy
a game they never hear about.

Honest calibration from the comps:

| Comp | What happened | Lesson |
|------|---------------|--------|
| *Uncover the Smoking Gun* (Krafton-backed, Metacritic 80) | < 20k owners | Even *good* AI interrogation games have not broken out yet |
| *Doki Doki AI Interrogation* (81% positive) | ~15–25k owners at a low price | Cheap novelty sells a little; it doesn't sustain a catalog |
| *Vaudeville* (49% positive) | Review-bombed for AI slop | The market actively punishes "the AI made it up" — our sealed-solution architecture is the counter-pitch |
| *Golden Idol*, *Obra Dinn* | 500k–1M+ owners | The deduction audience is large; it buys **authored, finishable** mysteries |

So the fit argument is: we are *not* selling "an AI game" — we are selling an
authored deduction game those buyers already pay for, where AI removes the
dialogue tree. Lead the store page with fair-play whodunit; disclose the AI
honestly; never lead with it.

Risks to accept going in: text-first games screenshot poorly (capsule art and
the sample-transcript trailer must carry the page), the game is online-only
(some buyers skip on principle), the "AI" store tag attracts hostility along
with curiosity, and Steam's 2-hour refund window overlaps a fast free-case
finish (mitigated by the base bundle containing 2–3 full cases, §4).

**Sequencing:** prove the loop on the web first (free-case completion rate,
"solution felt fair" rating), then treat Steam as launch #2 with the store
page up early. The worst plan is a quiet Steam launch with one case and no
wishlist ramp.

---

## 2. Technical changes

### 2.1 Packaging — desktop wrapper, UI bundled locally

Valve does not accept a thin shell around a remote website; the shipped build
must contain the game UI. The runtime stays server-side.

- **Wrapper:** Electron + [`steamworks.js`](https://github.com/ceifa/steamworks.js) (recommended — mature Steamworks bindings, `electron-builder` pipeline). Tauri + `steamworks-rs` is the lighter alternative if download size matters more than integration effort.
- **Frontend:** bundle `apps/web` into the wrapper. The player-facing pages are client-rendered against `NEXT_PUBLIC_API_URL`, so a static `next build` export should work; the server-only pieces (per-case OG images, server metadata) are irrelevant inside the wrapper. Verify the export, or embed a minimal local server if any route resists it.
- **Backend:** unchanged — the wrapper calls `https://api.mysterytrove.com` exactly like the browser does. Playthroughs already live server-side, so "your investigation continues on any device" is free and worth saying on the store page.
- **Build flag:** a `STEAM_BUILD` env baked at build time to switch auth UI (§2.2), hide web-billing surfaces (§3), and enable Steamworks calls.
- **Desktop hygiene:** proper window/quit handling, external links open in the system browser, a real offline/API-down error state ("The line to the mainland is down") instead of a hung spinner.
- **Steam Deck:** Electron runs fine under Proton; ship a native Linux depot if cheap. Target **Playable** (typed input via on-screen keyboard), don't chase Verified at launch. Deck is a genuinely good reading device for this genre.

### 2.2 Accounts — Steam auth, invisible

Steam buyers punish signup walls in reviews, and we don't need one:

1. Client calls `GetAuthTicketForWebApi` via Steamworks.
2. New API route `POST /v1/auth/steam {ticket}` verifies it server-side with the `AuthenticateUserTicket` Web API (publisher key in Fly secrets).
3. First sight of a `steamid` creates a user row (no email) and issues the same `mystery_session` cookie/session the web uses.

No magic link, no Google, no visible account creation — the Steam identity
*is* the account. Optionally offer account linking later ("play your Steam
cases on the web") but it is not launch-blocking. Because there is no separate
credential signup, no third-party-account disclosure is needed on the store
page — but the privacy policy must cover the server-side account.

### 2.3 Entitlements — DLC appids mapped onto the existing access model

- One Steam DLC per paid case; the base app includes the launch bundle (§4).
- Backend keeps a `steam_appid → caseId[]` table. On session start (or purchase webhook-less poll), the API checks ownership server-side via the `ISteamApps`/publisher ownership Web API — **never trust client-side `BIsDlcInstalled` alone**.
- Ownership becomes a **grant** in the existing access-policy layer (MYSTERY_BUNDLES §6 / SUBSCRIPTIONS §2) — same mechanism as playtester grants. Tiers (`standard/premium/elite`) stay web-only concepts; Steam access is per-case grants. `hiddenBelowTier` elite cases simply don't exist on Steam.

### 2.4 Store-page compliance

- **AI disclosure (mandatory):** the content survey requires disclosing both *pre-generated* AI content (the portrait/cover art, if AI-generated — the `artStyle` prompts say yes) and *live-generated* content, with a description of guardrails. Ours is strong and true: *"Every mystery is hand-authored with a fixed solution. AI generates character dialogue and scene descriptions at runtime, constrained by the authored case: it cannot change the solution, invent evidence, or produce content outside the investigation."* The disclosure shows on the store page — write it as a feature, because for this product it is one.
- **Online-required** disclosure; content warnings already exist per case (`contentWarnings`).
- $100 app fee (recouped at $1k revenue), standard review lead time; DLC pages need their own capsules.

---

## 3. How payment works

**Inside the Steam build, all money goes through Steam. No Stripe, no links to
the web subscription, no "cheaper on our site" — Valve forbids steering, and
it would tank the relationship that makes the channel valuable.**

- **Model: paid base game + DLC cases.** Chosen over the in-game MTX API because DLC gets store pages, wishlists, sale participation, and launch-visibility events for free, with zero payment code on our side. Chosen over free-to-play because F2P attracts an audience that reviews harshly when asked to pay, and a paid base filters for buyers while funding inference.
- **Steam's cut:** 30% (25% past $10M lifetime, 20% past $50M). Net of cut, refunds, and regional/VAT effects, expect roughly **55–65% of list price** as actual revenue per unit.
- **Refunds:** automatic under 2 hours played / 14 days. A buyer can finish nothing in 2 hours of a 3-case bundle — front-loading the base game with real volume (below) is the defense.
- **Subscription:** does not exist on Steam (the tooling is effectively unavailable to indies, and Steam buyers hate it). The web app remains the subscription channel; the two price books never appear in the same surface.
- **Ongoing inference cost:** a sold unit carries LLM cost for every future playthrough, but cases are *bounded* (a thorough Blackwood run is ~50–70 turns, then the case ends). Compute cost-per-completed-case from OpenRouter logs and keep regional price floors above it — override Valve's suggested prices for the lowest-price regions if the math demands.

### Launch price book (directional)

| SKU | Contents | Price |
|-----|----------|-------|
| Base game | Free case + Blackwood + Pier (+ 1 more if ready) | **$12.99** (launch discount 10%) |
| Case DLC | One full new case each | **$4.99–5.99** |
| Demo (separate app) | The free case, full vertical slice | Free — this is the Next Fest vehicle |
| Complete-your-set bundle | Base + all DLC | Rolling ~15% off |
| Soundtrack DLC | The ambience/score already in the repo | $2.99 (marginal but free to make) |

---

## 4. Maximizing revenue on this channel

**Pre-launch (the wishlist ramp is the whole game):**
1. Store page live **months** before launch — Steam's launch-week visibility is a function of wishlists at launch (several thousand is the threshold where the algorithm starts helping; under ~2k, expect silence).
2. **Next Fest** with the demo (= free case). This is the single biggest free visibility event available to an unknown indie, and a demo of a mystery game *is* the conversion asset — same logic as the web funnel.
3. Capsule art is the ad. Budget real money for it. Tags: Detective, Mystery, Investigation, Interactive Fiction, Text-Based, Choices Matter. Trailer = the sample transcript animated in the real UI with the ambience audio, 60–90 seconds, a contradiction caught on screen.
4. Announce → wishlist call-to-action everywhere the web product already reaches (site footer, post-case-solved screen on the web app: "Playing on Steam? Wishlist the launch").

**Launch:**
5. 10% launch discount (triggers discovery-queue and follower emails), press/curator keys 2 weeks early via Keymailer/Curator Connect targeted at deduction-game YouTubers — the Golden Idol/Obra Dinn coverage channels, not AI channels.
6. **Review velocity beats review count**: the first ~10 positive reviews fast decide the "Positive" badge. Prompt in-game after a *solved* case (the emotional peak), never at quit.
7. Fair-play messaging front and center; the AI disclosure framed as the guarantee. The failure mode to pre-empt is one viral "the AI contradicted itself" clip — which is also an argument for finishing the playtest sweeps (see the case reviews) *before* the Steam audience, which clips everything, arrives.

**Post-launch (cadence = visibility):**
8. Every case DLC is a marketing event: owners get notified, the base game gets a "New DLC" discovery slot, and each drop justifies a base-game discount round. A steady drumbeat of 1 case every 6–8 weeks outperforms 3 cases at once.
9. Participate in every seasonal sale (base at 20–35% off by year one; DLC discounts shallower). Apply for Daily Deals once review count supports it.
10. Achievements per case (solved, earned ending, no-false-accusation) — cheap engagement and completion signaling; the engine's ending buckets map directly.
11. Franchise/creator page once ≥2 SKUs exist, so every store page cross-sells the shelf.
12. Localization later: store page + UI first (cheap, expands reach markedly), performed-dialogue localization only when a market proves out — the LLM can perform in other languages but QA cost is real.

**Cross-channel discipline:** Steam owners who arrive at mysterytrove.com should
be able to link and play what they own (goodwill, retention), but the web
subscription is never marketed inside the Steam build, and Steam pricing is
never visibly undercut on the web.

### Realistic revenue bands (year one on Steam, base $12.99)

| Scenario | Units (base) | DLC attach | Net revenue (~60% of gross) |
|----------|--------------|------------|------------------------------|
| Quiet launch, <2k wishlists | 1–3k | 20% | ~$10–30k |
| Solid launch, Next Fest traction, 5–10k wishlists | 5–15k | 30% | ~$50–150k |
| Breakout (festival + streamer moment) | 25k+ | 40% | $250k+ |

The middle row is the honest target and it exceeds the web-subscription base
case — which is the argument for doing this at all.

---

## 5. Prerequisites before any of this

1. Playtest sweeps green at current case versions (the Steam audience is less forgiving than a waitlist audience).
2. Web free-case funnel proving completion + "felt fair" numbers — those metrics are the go/no-go for spending the wrapper effort.
3. Steamworks account, appid, and the store page shell — cheap to start early even if launch is quarters away, because the wishlist clock only starts when the page exists.
