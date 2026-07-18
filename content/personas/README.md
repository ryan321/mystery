# Recurring personas (future)

Mysteries already embed a full `player` block. Optional **`personaId`** is the hook for shared identities that appear in more than one mystery (Miss Marple, Poirot, Inspector Cross, Can’t Trick Rick, …).

## Today

- Each `content/cases/<id>/definition.json` owns its `player` object (role, appearance, authority, …).
- If `personaId` is set, the engine freezes that id on the playthrough and the AI is told this may be a recurring detective.
- There is **no** central catalog merge yet — copy is still per mystery.

## Planned

```
content/personas/
  miss-marple.json      # shared appearance, pronouns, background, voice
  henri-poirot.json
  inspector-cross.json
  cant-trick-rick.json
```

A mystery would then either:

1. **Inline** (current): full `player` on the definition, optional `personaId`, or  
2. **Reference + override**:

```json
"player": {
  "personaId": "miss-marple",
  "role": "Guest at the Bantry house party",
  "authority": "guest",
  "startingLocationId": "drawing-room",
  "startingKnowledge": "…",
  "objective": "…"
}
```

At playthrough start, resolve: `catalog[personaId]` ← overridden by mystery `player` fields → snapshot on `state.playerPersona`.

## Authored fields (see PlayerPersonaSchema)

| Field | Purpose |
|-------|---------|
| `personaId` | Stable recurring handle |
| `displayName` / `fullName` / `addressAs` | Names for UI and NPC dialogue |
| `pronouns` | Narration consistency |
| `role` | **This mystery’s** social role |
| `authority` | `civilian` \| `guest` \| `professional` \| `official` |
| `gender` / `age` / `appearance` / `clothing` | Optional look |
| `background` / `publicPerception` | What the world knows / assumes |
| `voiceNotes` / `performanceNotes` | Performer guidance |
| `objective` / `startingKnowledge` | Briefing + AI knowledge |
