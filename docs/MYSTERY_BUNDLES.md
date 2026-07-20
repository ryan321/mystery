# Mystery Bundles, Registry & Access

**Status:** Implemented (apps/api: `registry.ts`, `bundle.ts`, `access.ts`, `sql/004_mysteries.sql`; upload/publish/grant routes; `pnpm publish-case <caseId>`)
**Date:** 2026-07-20
**Related:** [CASE_AUTHORING.md](./CASE_AUTHORING.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [PLAYER_SURFACES.md](./PLAYER_SURFACES.md)

---

## 1. Terminology

A mystery is packaged and distributed as a **Mystery Bundle** — not a
"case file". A bundle is the definition *plus* its artifacts (cover art,
portraits, location images, and whatever future assets a case ships).

> Naming note: the diegetic briefing form value `case_file` (the
> detective's in-fiction dossier, PLAYER_SURFACES §5.1) is renamed
> **`dossier`** so the phrase "case file" is fully retired.

Code identifiers (`caseId`, `content/cases/`) stay as-is — renaming
symbols buys nothing. "Bundle" is the artifact and product term.

## 2. Bundle format

One zip archive, self-contained by construction (the definition already
references assets by relative path):

```
blackwood-inheritance.mystery          (zip)
├── definition.json                    ← schema-validated MysteryDefinition
├── cover.jpg                          ← shelf/header image
├── portraits/henshaw.jpg …            ← characters[].portrait
└── locations/library.jpg …            ← locations[].image
```

- Everything the case needs is inside; nothing outside is referenced.
- `(caseId, contentVersion)` from `definition.json` identifies the bundle.
- A checksum over the archive detects duplicate uploads.
- The bundle is the **single source of cover art**: the catalog
  (`GET /v1/cases`) and case-detail responses expose it as `coverUrl`,
  pointing at the versioned asset route.

## 3. Storage: database is the runtime source of truth

Filesystem loading at boot is a dev-only convenience. In production,
bundles live in Postgres so that:

1. **Upload = INSERT** — no server restart, works across multiple API
   instances.
2. **Versions are immutable rows** — playthroughs already pin
   `contentVersion`; old runs keep replaying against the exact content
   they started with, forever.
3. **Draft/publish lifecycle** — playtest privately before shelving;
   later, the community-publishing review gate.
4. **Assets are small** (a few MB of images per case): `bytea` keeps
   definition + assets atomic in one transaction, zero new infra. If
   heavy media arrives later, swap to object storage *behind the same
   asset route* — nothing else changes.

```sql
CREATE TABLE mysteries (
  case_id          text NOT NULL,
  content_version  text NOT NULL,
  status           text NOT NULL DEFAULT 'draft',   -- draft | published | retired
  definition       jsonb NOT NULL,
  access           jsonb NOT NULL DEFAULT '{"visibility":"public"}',
  checksum         text NOT NULL,
  created_at       timestamptz DEFAULT now(),
  PRIMARY KEY (case_id, content_version)
);

CREATE TABLE mystery_assets (
  case_id          text NOT NULL,
  content_version  text NOT NULL,
  path             text NOT NULL,                    -- "portraits/vale.jpg"
  mime             text NOT NULL,
  bytes            bytea NOT NULL,
  PRIMARY KEY (case_id, content_version, path)
);

CREATE TABLE mystery_grants (
  case_id    text NOT NULL,
  user_id    text NOT NULL,        -- anonymous session ids now; accounts later
  kind       text NOT NULL,        -- owner | purchased | gifted | playtest
  granted_at timestamptz DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);
```

## 4. Upload & validation pipeline

`POST /v1/mysteries` (multipart zip) — validate **before** storing:

1. `parseMysteryDefinition` (Zod; id cross-references already enforced).
2. **Asset integrity**: every `portrait` / `image` / cover path referenced
   by the definition exists in the archive; no orphan files; size caps;
   image MIME sniffing.
3. **Leak lint** (best-effort): solution text appearing in player-facing
   prose; real names of label-only characters (`nameKnownAtStart: false`)
   appearing anywhere in authored text.
4. Reject duplicate `(caseId, contentVersion)`; require a version bump.

Uploads land as `draft`. `POST /v1/mysteries/:id/:version/publish` flips
status and moves the "latest published" pointer.

## 5. Runtime registry (replaces boot-time loading)

- `getMystery(caseId, version)` → DB fetch → parse once → **in-memory
  cache keyed (caseId, version)**. Versions are immutable, so cached
  entries never invalidate; only the latest-published pointer changes.
- The cache MUST return the same parsed object instance per version:
  `staticCasePackJson` and other prompt-cache memoizations are
  WeakMap-keyed on object identity.
- Asset route: `GET /v1/mysteries/:caseId/:version/assets/<path>` with
  `Cache-Control: immutable` (version is in the URL).

## 6. Access model

Access is **operational policy, not case content** — it lives on the
registry row (`mysteries.access`), never inside `definition.json`:

- Authors don't set pricing; policy changes (premium → free, promo
  weekends) must not require re-upload or a version bump.
- Grants reference user ids, which don't belong in a shareable artifact.
- The engine stays user-blind: access is enforced at the API layer only.

```jsonc
// mysteries.access
{
  "visibility": "public" | "unlisted" | "private",
  // Playability requirements — ANDed, all optional:
  "minTier": "free" | "standard" | "premium",
  "minSolved": 3,
  "requiresSolvedCaseIds": ["blackwood-inheritance"],   // series / sequels
  "grantOnly": true                                     // explicit grants only
}
```

### 6.1 Visibility × playability matrix

Two independent axes. **Visible-but-locked** and **not-visible** are both
first-class:

| `visibility` | On the shelf? | Detail page | Playable |
|---|---|---|---|
| `public` | Yes — locked entries show their lock reason ("Premium", "Solve 3 mysteries first") | Yes | Only if requirements met |
| `unlisted` | No | Via direct link | Only if requirements met |
| `private` | No — **existence hidden**: non-granted users get 404, not 403 (anti-enumeration) | Grant holders only | Grant holders meeting requirements |

- **Visible-but-locked is merchandising**: the catalog returns locked
  entries with `{ locked: true, lockReason, requirement }` so the UI can
  sell the unlock ("Solve 3 mysteries to unlock", tier badge, "Finish
  The Blackwood Inheritance first").
- **Not-visible is absolute**: a `private` mystery without a grant does
  not exist for that user — not in the catalog, not by URL, not via
  assets. Commissioned/personal mysteries use `private` + an `owner`
  grant; share with friends via additional grants or `unlisted`.

### 6.2 Evaluation & enforcement

One server-side function: `canAccess(user, mystery) →
{ visible, playable, lockReason?, requirement? }`, resolved from the
subscription tier (billing), progression (solved playthroughs — already
in the DB), and `mystery_grants`.

Enforcement points:

| Point | Rule |
|---|---|
| Catalog | `public` always listed (with lock state); `unlisted`/`private` omitted (private also omitted from counts) |
| Case detail | `private` without grant → **404** |
| `POST /playthroughs` | **The hard gate.** Not playable → 403 + `lockReason` (UI upsells) |
| Assets | Servable whenever the case is *reachable* (the detail page shows cast portraits as merchandising even when locked); `private` without grant → 404 for everything |
| Existing playthroughs | **Grandfathered** — entitlement is checked at start only; a lapsed subscription never bricks a case mid-run |

### 6.3 What v1 deliberately avoids

No generic conditions DSL for access — four ANDed fields cover tiers,
progression, series, and private commissions. Odd promos are what grants
are for. (The game engine's condition language stays in the game.)

## 7. Authoring workflow (unchanged where it matters)

- Official mysteries stay **git-first** in `content/cases/` (PR review).
- `pnpm publish-case <caseId>` zips and uploads a bundle.
- Dev boot auto-imports `content/cases/` into the local DB, so the local
  loop stays: edit JSON → restart dev → play.
- Community/commissioned bundles skip git entirely: upload → draft →
  playtest grant → publish (`private`/`unlisted`/`public`).

## 8. What does not change

The engine. It receives a parsed `MysteryDefinition` and playthrough
state; it has no concept of users, tiers, grants, or storage. Fair-play
sealing, packs, PlayerView, and prompt caching are all indifferent to
where bundles live and who may play them.

## 9. Build order

1. `case_file` → `dossier` rename in `BriefingSchema` (tiny, do first).
2. Tables + registry service with in-memory cache; port boot loader to
   dev auto-import.
3. Upload endpoint + validation (asset integrity, leak lint).
4. Asset route with immutable caching.
5. `canAccess` + catalog lock states + start-gate + 404 semantics.
6. `publish-case` script; retire direct filesystem serving.
