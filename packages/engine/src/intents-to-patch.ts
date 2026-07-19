import type {
  DirectorIntent,
  DirectorOutput,
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import { flagsMatch } from "./flags.js";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(hay: string, needle: string): number {
  const h = norm(hay);
  const n = norm(needle);
  if (!n) return 0;
  if (h === n) return 100;
  if (h.includes(n) || n.includes(h)) return 60;
  const parts = n.split(" ").filter((p) => p.length > 2);
  let hit = 0;
  for (const p of parts) if (h.includes(p)) hit += 1;
  return hit * 15;
}

function resolveLocationId(
  def: MysteryDefinition,
  state: PlaythroughState,
  intent: Extract<DirectorIntent, { type: "move" }>
): string | undefined {
  if (intent.toLocationId) {
    const exists = def.locations.some((l) => l.id === intent.toLocationId);
    if (exists) return intent.toLocationId;
  }
  const loc = def.locations.find((l) => l.id === state.locationId);
  if (!loc) return undefined;

  const hint = intent.exitHint ?? intent.toLocationId ?? "";
  let best: { id: string; score: number } | undefined;
  for (const exit of loc.exits) {
    if (!flagsMatch(state.flags, exit.requiresFlags)) continue;
    const dest = def.locations.find((l) => l.id === exit.toLocationId);
    const score = Math.max(
      scoreMatch(exit.label ?? "", hint),
      scoreMatch(exit.toLocationId, hint),
      scoreMatch(dest?.name ?? "", hint)
    );
    if (!best || score > best.score) {
      best = { id: exit.toLocationId, score };
    }
  }
  return best && best.score >= 15 ? best.id : undefined;
}

function resolveInspectable(
  def: MysteryDefinition,
  state: PlaythroughState,
  intent: Extract<DirectorIntent, { type: "inspect" | "use" }>
) {
  const loc = def.locations.find((l) => l.id === state.locationId);
  if (!loc) return undefined;

  if ("inspectableId" in intent && intent.inspectableId) {
    const found = loc.inspectables.find((i) => i.id === intent.inspectableId);
    if (found && flagsMatch(state.flags, found.hiddenUntilFlags)) return found;
  }

  const hint =
    ("targetHint" in intent ? intent.targetHint : undefined) ??
    ("inspectableId" in intent ? intent.inspectableId : undefined) ??
    "";

  let best: { insp: (typeof loc.inspectables)[0]; score: number } | undefined;
  for (const insp of loc.inspectables) {
    if (!flagsMatch(state.flags, insp.hiddenUntilFlags)) continue;
    const score = Math.max(
      scoreMatch(insp.id, hint),
      scoreMatch(insp.name, hint)
    );
    if (!best || score > best.score) best = { insp, score };
  }
  return best && best.score >= 15 ? best.insp : undefined;
}

function resolveCharacterId(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId?: string,
  characterHint?: string
): string | undefined {
  if (characterId && def.characters.some((c) => c.id === characterId)) {
    return characterId;
  }
  const loc = def.locations.find((l) => l.id === state.locationId);
  const present = new Set(
    (loc?.charactersPresent ?? [])
      .filter((p) => flagsMatch(state.flags, p.requiresFlags))
      .map((p) => p.characterId)
  );
  const hint = characterHint ?? characterId ?? "";
  let best: { id: string; score: number } | undefined;
  for (const c of def.characters) {
    if (!present.has(c.id) && present.size > 0) continue;
    const score = Math.max(scoreMatch(c.id, hint), scoreMatch(c.name, hint));
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= 15 ? best.id : undefined;
}

function resolveEvidenceId(
  def: MysteryDefinition,
  state: PlaythroughState,
  evidenceId?: string,
  evidenceHint?: string,
  preferHeld = true
): string | undefined {
  if (evidenceId && def.evidence.some((e) => e.id === evidenceId)) {
    return evidenceId;
  }
  const hint = evidenceHint ?? evidenceId ?? "";
  const pool = preferHeld
    ? def.evidence.filter((e) => state.evidenceIds.includes(e.id))
    : def.evidence;
  let best: { id: string; score: number } | undefined;
  for (const e of pool) {
    const score = Math.max(scoreMatch(e.id, hint), scoreMatch(e.name, hint));
    if (!best || score > best.score) best = { id: e.id, score };
  }
  return best && best.score >= 15 ? best.id : undefined;
}

/** Physical force language (not "knock on the door"). */
export function inputLooksLikeAssault(playerInput: string): boolean {
  const s = playerInput.toLowerCase();
  if (/\bknock\s+on\b/.test(s)) return false;
  return (
    /\b(push|shove|hit|punch|kick|grab|tackle|strike|slap|wrestle|throttle|choke)\b/.test(
      s
    ) ||
    /\bknock\s+(him|her|them|down|over)\b/.test(s) ||
    /\bout of (the |my )?way\b/.test(s) ||
    /\bforce\s+(my way|past|through)\b/.test(s) ||
    /\bthrow\s+(him|her|them)\b/.test(s) ||
    /\bonto the (ground|floor)\b/.test(s)
  );
}

function assaultMannerFromInput(playerInput: string): string {
  const s = playerInput.toLowerCase();
  if (/\bknock\b/.test(s) || /\bground\b/.test(s) || /\bfloor\b/.test(s))
    return "knock_down";
  if (/\bgrab\b/.test(s)) return "grab";
  if (/\b(hit|punch|strike|slap)\b/.test(s)) return "hit";
  if (/\b(shove|push)\b/.test(s)) return "shove";
  if (/\bout of (the |my )?way\b/.test(s) || /\bforce\s+past\b/.test(s))
    return "force_past";
  return "assault";
}

/**
 * Convert director intents into a single StatePatch for engine validation.
 */
export function directorIntentsToPatch(
  def: MysteryDefinition,
  state: PlaythroughState,
  director: DirectorOutput,
  playerInput: string
): { patch: StatePatch; focusCharacterId?: string; notes: string[] } {
  const notes: string[] = [];
  const patch: StatePatch = {};
  const addEvidence = new Set<string>();
  const setFlags: Record<string, boolean | string | number> = {};
  let focusCharacterId = director.focusCharacterId;
  let assaultTarget: string | undefined;
  let assaultManner: string | undefined;

  // Prefer explicit suggested patch pieces that look safe — still validated later
  if (director.suggestedPatch?.setLocationId) {
    patch.setLocationId = director.suggestedPatch.setLocationId;
  }
  if (director.suggestedPatch?.addEvidenceIds) {
    for (const id of director.suggestedPatch.addEvidenceIds) addEvidence.add(id);
  }
  if (director.suggestedPatch?.setFlags) {
    Object.assign(setFlags, director.suggestedPatch.setFlags);
  }
  if (director.suggestedPatch?.accuse) {
    patch.accuse = director.suggestedPatch.accuse;
  }

  for (const intent of director.intents) {
    switch (intent.type) {
      case "move": {
        const to = resolveLocationId(def, state, intent);
        if (to) {
          patch.setLocationId = to;
          notes.push(`move→${to}`);
        } else {
          notes.push("move unresolved");
        }
        break;
      }
      case "inspect":
      case "use": {
        const insp = resolveInspectable(def, state, intent);
        if (insp) {
          const needsFlags = insp.onInspect.requiresFlags;
          const needsEv = insp.onInspect.requiresEvidenceIds;
          const flagOk = flagsMatch(state.flags, needsFlags);
          const evOk =
            !needsEv?.length ||
            needsEv.every((id) => state.evidenceIds.includes(id));
          if (!flagOk || !evOk) {
            notes.push(
              `inspect ${insp.id} requirements not met (still attempting)`
            );
          }
          if (flagOk && evOk) {
            for (const id of insp.onInspect.revealsEvidenceIds ?? []) {
              addEvidence.add(id);
            }
            if (insp.onInspect.setsFlags) {
              Object.assign(setFlags, insp.onInspect.setsFlags);
            }
          } else if (flagOk && needsEv?.length) {
            for (const id of insp.onInspect.revealsEvidenceIds ?? []) {
              addEvidence.add(id);
            }
            if (insp.onInspect.setsFlags) {
              Object.assign(setFlags, insp.onInspect.setsFlags);
            }
          }
          // Using a held key on a container also counts as use of that item
          if (intent.type === "use" && needsEv?.length) {
            const used = needsEv.find((id) => state.evidenceIds.includes(id));
            if (used) patch.useItemId = used;
          }
          notes.push(`inspect→${insp.id}`);
          break;
        }
        // Inventory-only use/examine (no world target)
        if (intent.type === "use") {
          const held = def.evidence.filter((e) =>
            state.evidenceIds.includes(e.id)
          );
          let useId = intent.evidenceId;
          if (!useId && intent.targetHint) {
            const h = intent.targetHint.toLowerCase();
            useId = held.find(
              (e) =>
                e.name.toLowerCase().includes(h) ||
                e.id.includes(h.replace(/\s+/g, "-"))
            )?.id;
          }
          if (useId && state.evidenceIds.includes(useId)) {
            patch.useItemId = useId;
            notes.push(`use ${useId}`);
          } else {
            notes.push("use unresolved");
          }
        } else {
          notes.push("inspect unresolved");
        }
        break;
      }
      case "talk": {
        const cid = resolveCharacterId(
          def,
          state,
          intent.characterId,
          intent.characterHint
        );
        if (cid) {
          focusCharacterId = cid;
          patch.talkToCharacterId = cid;
          notes.push(`talk→${cid}`);
        }
        break;
      }
      case "present": {
        const eid = resolveEvidenceId(
          def,
          state,
          intent.evidenceId,
          intent.evidenceHint,
          true
        );
        const cid = resolveCharacterId(
          def,
          state,
          intent.characterId,
          intent.characterHint
        );
        if (cid) focusCharacterId = cid;
        if (eid && cid) {
          patch.presented = [...(patch.presented ?? []), { evidenceId: eid, characterId: cid }];
          patch.talkToCharacterId = cid;
        }
        notes.push(`present ${eid ?? "?"}→${cid ?? "?"}`);
        break;
      }
      case "look":
        notes.push("look");
        break;
      case "inventory":
        patch.requestInventory = true;
        notes.push("inventory");
        break;
      case "accuse": {
        patch.accuse = {
          summary: intent.summary ?? playerInput,
          suspectIds: intent.suspectIds,
          method: intent.method,
          motive: intent.motive,
        };
        notes.push("accuse");
        break;
      }
      case "assault": {
        const cid = resolveCharacterId(
          def,
          state,
          intent.characterId,
          intent.characterHint
        );
        if (cid) {
          assaultTarget = cid;
          focusCharacterId = cid;
          assaultManner = intent.manner ?? assaultMannerFromInput(playerInput);
          notes.push(`assault→${cid}`);
        } else {
          notes.push("assault unresolved");
        }
        break;
      }
      case "other": {
        const note = intent.note ?? "other";
        notes.push(note);
        if (
          /exit_denouement|leave_case|end_wrap/i.test(note) ||
          /\b(goodbye|i leave|end case)\b/i.test(playerInput)
        ) {
          notes.push("exit_denouement");
        }
        break;
      }
    }
  }

  // Local fallback: director often maps "push X" to talk — catch physical force
  if (!assaultTarget && inputLooksLikeAssault(playerInput)) {
    const inputL = playerInput.toLowerCase();
    const presentIds = Object.entries(state.characterState)
      .filter(
        ([, cs]) =>
          cs.locationId === state.locationId && cs.available !== false
      )
      .map(([id]) => id);

    let best: { id: string; score: number } | undefined;
    for (const id of presentIds) {
      const ch = def.characters.find((c) => c.id === id);
      if (!ch) continue;
      const last = ch.name.split(/\s+/).pop()?.toLowerCase() ?? "";
      let score = Math.max(
        scoreMatch(ch.name, inputL),
        scoreMatch(ch.id, inputL),
        scoreMatch(last, inputL)
      );
      // "him/her/them" with single present adult staff
      if (score < 15 && presentIds.length === 1) score = 20;
      if (score < 15 && /\b(him|her|them|doctor|nurse|orderly)\b/.test(inputL)) {
        // Prefer non-player-friendly authority roles when ambiguous
        if (/more|holt|crane|doctor|orderly|nurse/i.test(ch.name + ch.id))
          score = 25;
        else score = Math.max(score, 18);
      }
      if (!best || score > best.score) best = { id, score };
    }
    if (best && best.score >= 15) {
      assaultTarget = best.id;
      focusCharacterId = best.id;
      assaultManner = assaultMannerFromInput(playerInput);
      notes.push(`assault→${best.id} (heuristic)`);
    }
  }

  if (assaultTarget) {
    const prev = Number(state.flags.assault_attempts ?? 0);
    setFlags.player_assaulted_staff = true;
    setFlags.assault_attempts = prev + 1;
    setFlags.last_assault_target = assaultTarget;
    setFlags.last_assault_manner = assaultManner ?? "assault";
    setFlags[`assaulted_${assaultTarget}`] = true;
    // Trying to leave past someone you just shoved is not a free move this turn
    if (assaultManner === "force_past" || assaultManner === "shove") {
      // keep any move intent only if separate; physical block is case-beat owned
    }
    notes.push(`assault_flags→${assaultTarget}`);
  }

  if (addEvidence.size) patch.addEvidenceIds = [...addEvidence];
  if (Object.keys(setFlags).length) patch.setFlags = setFlags;

  return { patch, focusCharacterId, notes };
}
