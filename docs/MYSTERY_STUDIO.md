# Mystery Studio

Local-only webapp for **reading, reviewing, and authoring** mystery
definitions. It runs against the working copy — `content/cases/<dir>/`
on the filesystem — with no database and no API dependency.

**Never deployed.** There is no auth and every page shows sealed truth
(guilty party, canon timeline, secrets). It exists so an author can read
a case like a writer's outline instead of a 1,500-line JSON file.

## Run

```bash
pnpm dev:studio    # http://localhost:3100
```

## Views

| View | What it shows |
|---|---|
| The Shelf (home) | Every case dir: cover, schema validity, character/location/beat counts, hidden-character chip. Plus **New case** scaffolding. |
| Story | Premise, player role, opening package, opening narration; **the sealed truth** — guilty ids resolved to character names, critical evidence resolved to item names, success policy explained in plain language, rubric truth facets with match hints; endings; phases. |
| Characters | Portrait cards with the knowledge ladder (public / private / secret) and gate chips (`needs evidence-x · trust ≥ 2`), entrances for hidden characters, defenses. |
| Relationships | Directed SVG graph — gold solid = public edge, dashed = private, ◉ = known to player at start — plus an edges table. |
| World | Sketch map drawn from `locations[].map` coords, exits, inspectables, evidence table (critical / red-herring), time schedule, hazards, accuse policy. |
| Beats | Triggered beats and synthetic entrance beats rendered as plot language ("when the player first enters the vault → reveal…"). |
| Art | Everything visual in one place: art direction (`meta.artStyle`), cover, portrait grid, location art — with **missing-asset callouts** for anything referenced-but-absent or absent-but-expected. |
| Edit JSON | Raw definition editor with live schema validation; **Save is disabled until the definition parses**. |

Every image (cover, portraits, location art) is click-to-zoom — a
lightbox shows it full-scale with its file path.

## Guarantees

- **The studio never writes a broken definition.** Save validates via
  `parseMysteryDefinition` server-side before touching the file; the
  editor shows Zod errors live while typing.
- **New case** scaffolds a minimal *valid* definition plus a
  `portraits/` directory, so a fresh case starts green.
- Asset serving is path-traversal-safe and read-only from the case dir.

## Relationship to bundles

A case directory is an unzipped bundle (`definition.json` + `cover.*` +
`portraits/` + `locations/` — see
[MYSTERY_BUNDLES.md](./MYSTERY_BUNDLES.md)). The dev API auto-imports
`content/cases/*` at boot; `pnpm publish-case` pushes a bundle to a
running API without a restart. The studio is the editing surface for
that source material — it never talks to the registry itself.
