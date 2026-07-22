# Subscription Tier Strategy

**Status:** Decided (rationale); implementation partial — see [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md)
**Date:** 2026-07-22
**Related:** [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) (technical implementation), [PRODUCT.md](./PRODUCT.md)

This doc records *why* the tier structure is what it is — including the ideas
that were tested and rejected. The "why nots" are as load-bearing as the "whys."

---

## 1. The decision

A generous free taster, then a three-rung ladder gated on **difficulty**, with an
earned, invitation-only top tier.

| Tier | Internal id | Access | Gated on |
|------|-------------|--------|----------|
| **Free** | `free` | One taster case (currently The Blackwood Inheritance). Sign-in required to play even this. | — |
| **Sleuth** | `standard` | All **Easy + Medium** mysteries. | Nothing beyond subscribing. The generous base. |
| **Master Detective** | `premium` | Everything Sleuth has, **plus Difficult** mysteries. Priced higher. | Difficulty. |
| **Genius** | `elite` | The most difficult / most exclusive mysteries, **plus status/identity**. Invisible and unpurchasable until earned. | Invitation, **earned by solving 3 Difficult mysteries.** |

Internal tier ids stay `standard/premium/elite` (plumbing: DB, env vars, Stripe
price map). Only the display names are Sleuth / Master Detective / Genius.

---

## 2. The business context that drives every decision

Four facts about this specific business frame all the tiering logic:

1. **It's a publishing model, not an AI-utility model.** High fixed cost to
   author a mystery once (~2 hrs), near-zero marginal cost to serve it to one
   more player. Economics of a book or a game, not a metered API.
2. **Config-over-runtime architecture.** The authored mystery config does the
   heavy lifting; the AI narrates and enforces rather than improvising the story.
   This keeps runtime AI cost **low** *and* quality/coherence **high** at the same
   time — the cost story and the quality story are the same story. A cheap model
   runs it just as well as an expensive one.
3. **Content is abundant.** Hundreds of quality mysteries are planned, each
   generated/audited/test-played/refined in ~2 hours. Authoring is not the
   bottleneck.
4. **The moat is dual:** (a) the *architecture* to do interactive mysteries at
   low cost and high coherence, and (b) the *content craft* — knowing what makes a
   good mystery and producing them fast at quality. The value is at the
   intersection of two rare competences; either alone is insufficient.

---

## 3. Why difficulty is the tiering axis

We can't tier on the two axes most SaaS/AI products use, and difficulty is the
honest one that remains.

- **Not "quality/better mysteries."** If premium = "the better mysteries," you've
  branded the base tier as "the worse mysteries" and poisoned your largest paying
  segment. Every case is good; you never tell a paying subscriber they bought the
  inferior version.
- **Not "resources / a better AI."** The platform is architected so a cheap model
  is just as good (see §2.2). Better AI ≠ better experience here, so AI-Dungeon-style
  capability tiering delivers no value and can't justify a price.
- **Difficulty is not quality.** A Medium and a Hard case can both be excellent;
  one is simply a bigger challenge. "You get great Easy/Medium mysteries; Hard ones
  are a harder challenge" is a fair thing to say to the base. This is the key move
  that makes tiering feel legitimate rather than punitive.
- **Difficulty self-selects the hardcore** (second-degree price discrimination):
  the players who want a challenge — the most engaged, highest willingness-to-pay
  — opt into the higher tier. And it happens to align with cost (Hard cases run
  more turns; see §5).

---

## 4. The cost / whale reasoning (and its correction)

Cost is **not** the main driver — but it matters at the margin and it makes the
difficulty gate feel principled.

- Difficult mysteries consume more turns → cost more to serve → charging more for
  them is cost-aligned.
- **Whale economics.** A heavy player's *daily* turn appetite (~200/day) is roughly
  fixed. On Master Detective those turns land on fewer, harder cases — so per-day
  cost is roughly tier-independent while the price is higher. Margin-positive.
- **Correction to that logic:** a *content-hungry* whale (plays all the time) is
  content-limited, not time-limited, so Hard access is **additive**, not a reshuffle
  — he does those turns *on top*. So price the tier to cover additive Hard-case
  turns, not as a cost-neutral swap.
- **Exposure is structurally capped anyway.** Cheap model + one-and-done content +
  finite catalog means a whale can only cost you as fast as *you ship content*. He
  can't run up an unbounded bill; his spend is throttled by your release cadence.

**Takeaway:** price the tiers on **willingness-to-pay**, and treat cost-alignment
as the garnish that makes it feel fair — not the engine. The value case sets the
price; the cost case just keeps it honest.

---

## 5. Why Genius is earned, whispered, and about status

Genius is the velvet-rope tier, and it is a *different kind* of thing than Sleuth
and Master Detective — those sell content; Genius sells **identity**.

- **Earned, not just bought.** Unlocked by solving **3 Difficult mysteries**. "Can't
  be bought, must be earned" creates aspiration, word-of-mouth ("there's a *secret
  tier*?"), and a retention grind. It also pre-qualifies engaged, skilled players
  who will love it.
- **Whispered, not invisible.** A tier nobody knows exists can't create aspiration
  or anchor prices. Known-but-unattainable — *"There is a tier above this. It cannot
  be purchased."* — keeps the mystique *and* the aspiration *and* lets its existence
  make Master Detective feel reasonable (price anchoring).
- **Its value is renewable status, not depletable content.** "It becomes their
  thing; proof they're top-notch." Content is one-and-done and depletes between
  releases; status/identity/ranking renews every day. Build the tier around
  persistent proof of mastery (rank, track record, recognition), so it keeps giving
  value on the ~27 days a month you didn't ship a new case.
- **Premium in kind, not just harder.** To justify the grind *and* the price, Genius
  content should be qualitatively special (unique formats, longer arcs, bespoke),
  not merely "even harder cases."
- **Eligibility is permanent** (based on solve history), so a lapsed Genius member
  can re-subscribe without re-earning it.
- **Why it must exist:** difficulty monetizes the *enthusiast*; status monetizes the
  *fanatic*. A one-step difficulty upsell caps top-end ARPU; the earned status tier
  is where the AI-Dungeon-style whale ($250–$1000/mo precedent) hands you more.

---

## 6. Ideas considered and set aside

- **Better-model / resource tiering** (AI Dungeon's model) — killed by the
  architecture: a cheap model is just as good, so there's nothing to sell.
- **Quality-gating** ("premium = the better mysteries") — devalues the base tier;
  never tell paying subscribers they bought the lesser product.
- **Exclusivity-only middle tier** (reserve specific cases regardless of difficulty)
  — viable, and it removes the "skilled-but-broke player blocked from hard cases"
  friction. Set aside because it hides your best *marketing* behind the paywall and
  doesn't align with cost the way difficulty does. Difficulty preferred; keep at
  least one showpiece case visible to the base for word-of-mouth.
- **Metering turns** — kills immersion; a visible turn-counter makes players ration
  play, which destroys the core experience. Keep fair-use caps invisible and only as
  an abuse backstop.
- **Collapsing to a single all-access tier** (early recommendation) — rejected once
  it became clear that (a) this enthusiast/status audience tolerates and likes
  granular tiers, (b) real whales exist, and (c) cheap abundant content can feed all
  tiers without starving any.

---

## 7. Principles to hold while implementing

- **Be generous with the base.** Serving is ~free, so a deep, genuinely-good Sleuth
  tier is your cheapest growth and word-of-mouth engine. Premium tiers sell
  *manufactured scarcity* (difficulty, status, bespoke), never hoarded quality.
- **Every case meets a quality floor.** At hundreds of cases the floor matters more
  than the ceiling — one dud (broken solution, unfair case) poisons trust in the
  whole subscription. The audit/playtest/storycheck gates *are* the product now.
- **Sell the experience, not the machine.** In an AI-saturated market, "it's AI" is
  both a hook and a liability. Market the outcome (a great, endless, fair detective
  game). Claim quality *inside the interactive category* — not against novels/movies,
  which invites the wrong comparison on prose/cinematography.
- **Abundance shifts the risk to pricing power.** When content is near-free to make,
  "access" commoditizes. The premium tiers must sell what stays scarce: challenge,
  earned status, identity, and (abundance-enabled) bespoke/commissioned mysteries.
- **The real frontier is Netflix's problems.** Discovery/curation at catalog scale,
  a maintained quality floor, community/status, and continuous production — not
  authoring. Weight long-term moat investment on content craft + brand + catalog +
  community (which compound) over the architecture (which the rising AI tide will
  eventually match).

---

## 8. Open questions & prerequisites

- **Prices.** Not set. Floor is the fully-loaded cost of one average playthrough —
  compute that number before pricing any tier.
- **Content prerequisites (blocking).** The difficulty gates can't fully switch on
  yet. Today's catalog: **3 Easy, 5 Medium, 1 Hard.** Master Detective currently
  adds only one case; and Genius's "solve 3 Difficult" gate is *impossible* until
  ≥3 Hard cases exist (ideally 5+ so it isn't instantly exhausted). Grow the Hard
  catalog first.
- **Genius pricing model.** Higher-priced "earn the right to pay" (whale capture) vs.
  a near-free loyalty/status perk. Its ROI is loyalty + word-of-mouth more than ARPU
  — but it can also be the top revenue rung. Decide.
- **Genius content-in-kind.** Define what makes Genius cases *qualitatively* special
  beyond difficulty. Consider bespoke/commissioned mysteries (the 2-hr pipeline makes
  "your own custom mystery" a genuinely exclusive, high-WTP product).
- **Demand is unproven.** Every hard problem solved so far is supply-side. Whether
  enough people will *pay* for this at subscription scale is empirical — validate
  with real activation, week-4 retention, and free→paid conversion, not more analysis.

---

## 9. Implementation status & gaps

Implementation contracts live in [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md). Relative to
the decision above:

- **Display names** (`TIER_CARDS` in `apps/api/src/billing.ts`, `tierLabel` in
  `apps/web/src/lib/format.ts`): Sleuth / Master Detective are live. **The top tier
  is currently deployed as "The Inner Circle" and must change to "Genius"** to match
  this decision.
- **Difficulty→tier mapping is NOT yet applied.** All 8 non-free cases are currently
  `minTier: standard` (Sleuth), including the one Hard case (The White Room, which
  should be `minTier: premium`). Apply per-case `minTier` by difficulty; consider
  auto-deriving `minTier` from `meta.difficulty` at publish time.
- **Genius invisibility** uses the existing `hiddenBelowTier` access policy.
- **NET-NEW engine feature required:** progression-gated tier *eligibility*. Today
  the engine gates *playing a case* by solves; it does not gate the *right to
  subscribe to a tier* by solves. Genius needs: count a user's distinct **Hard**
  solves → when ≥3, auto-issue the Genius invitation (reuse existing invitation
  infra), reveal the tier on `/subscribe`, and surface an "you've earned it" moment.
  Simplification: "3 Hard solves *in Master Detective*" reduces to just "3 Hard
  solves," since Hard cases already require Master Detective to play.
