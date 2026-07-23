# Cast portraits — art principles

**Status:** Canonical  
**Date:** 2026-07-23

How cast portraits are authored and generated for MysteryTrove cases.

---

## Principle: no picture frames

**Portraits are the painted subject only — not a painting hanging on a wall.**

| Do | Do not |
|---|---|
| Head-and-shoulders character portrait | Ornate wooden picture frames |
| Canvas / paint edge to the image edge | Brass nameplates on a frame |
| Plain dark painted backdrop (or case artStyle) | Damask wallpaper + candle next to a frame |
| Identity readable at cast-list size | Mat, border, vignette “photo frame” |

UI already provides chrome (cast cards, drawers). Framing the art a second time looks dated, crops the face, and wastes pixels.

**If a generator or ref image includes a frame:** strip it (`pnpm gen-portraits --case <id> --deframe`) so only the oil/illustration subject remains, full-bleed.

---

## Style contract

Each case authors `meta.artStyle` (one sentence). All portraits for that case share:

- Same medium and lighting language  
- Same era of costume  
- Same “artist hand”  

Use one existing deframed portrait as a **style reference** when generating the rest — for likeness of *style*, not for a framed composition.

---

## Pipeline

```bash
# Generate missing portraits (no frames in the prompt)
pnpm gen-portraits --case the-fall-of-alan-thorne

# Strip frames from existing files if an older run left them
pnpm gen-portraits --case the-fall-of-alan-thorne --deframe
```

Script: `apps/api/scripts/gen-portraits.mjs`  
Output: `content/cases/<caseId>/portraits/<characterId>.jpg`  
Definition field: `characters[].portrait` → e.g. `"portraits/margaret-ashmere.jpg"`

---

## Subject rules

- Physical description only (face, age band, hair, clothing era)  
- No spoilers (“the killer”, “secretly evil”) in the paint brief  
- Victims may still have portraits for cast/dossier if they appear in the story world  
- Wheelchair / disability: show with dignity; chair may be partially visible if characterful — still no picture frame around the whole image  

---

## Checklist per case

- [ ] `meta.artStyle` set  
- [ ] Every talkable cast member has a portrait file  
- [ ] No frames, mats, or nameplates in the image  
- [ ] `definition.json` `portrait` paths match files on disk  
- [ ] Spot-check cast list UI at small size (face readable)  
