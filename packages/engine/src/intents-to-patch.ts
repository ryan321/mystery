import type {
  DirectorIntent,
  DirectorOutput,
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import { authoredFlagKeys, flagsMatch, stripReservedFlags } from "./flags.js";
import { accusableSuspectIds } from "./accusation.js";

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
  if (best && best.score >= 15) return best.id;

  // No adjacent exit matched — the player may have named a far room ("go to the
  // conservatory" from the lodge). Match the hint against every location; the
  // engine path-routes there (or rejects if it's gated/unreachable).
  let far: { id: string; score: number } | undefined;
  for (const l of def.locations) {
    if (l.id === state.locationId) continue;
    const score = Math.max(scoreMatch(l.id, hint), scoreMatch(l.name, hint));
    if (!far || score > far.score) far = { id: l.id, score };
  }
  return far && far.score >= 15 ? far.id : undefined;
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
  const violenceVerb =
    /\b(push|shove|hit|punch|kick|knee|elbow|headbutt|grab|tackle|strike|slap|smack|wrestle|throttle|choke|strangle|attack|fight|pummel|beat|stomp|slam|clobber|whack)\b/.test(
      s
    ) ||
    /\bknock\s+(him|her|them|down|over)\b/.test(s) ||
    /\bout of (the |my )?way\b/.test(s) ||
    /\bforce\s+(my way|past|through)\b/.test(s) ||
    /\bthrow\s+(him|her|them)\b/.test(s) ||
    /\bonto the (ground|floor)\b/.test(s) ||
    /\bfight me\b/.test(s) ||
    /\bin the (nuts|groin|balls|face|gut|stomach)\b/.test(s);
  // "knee him" / "kick them" style even if verb is thin
  const bodyAttack =
    /\b(knee|kick|elbow|headbutt)\s+\w+/.test(s) ||
    /\b\w+\s+(him|her|them|hium)\s+in the\b/.test(s);
  return violenceVerb || bodyAttack;
}

/**
 * Disruptive / gross / self-sabotage acts that institutions and households
 * react to — not sexual abuse, not magic. Universal across mysteries.
 */
export function inputLooksLikeMisconduct(playerInput: string): boolean {
  const s = playerInput.toLowerCase();
  // Avoid matching "file" investigations etc.
  return (
    /\b(pee|piss|urinate|defecat|shit on|crap on|spit on|vomit|puke|strip naked|take off my clothes|scream at|trash the|destroy the|smash the|set fire|start a fire)\b/.test(
      s
    ) || /\b(pee|piss)\s+on\b/.test(s)
  );
}

function assaultMannerFromInput(playerInput: string): string {
  const s = playerInput.toLowerCase();
  if (/\bknock\b/.test(s) || /\bground\b/.test(s) || /\bfloor\b/.test(s))
    return "knock_down";
  if (/\bgrab\b/.test(s)) return "grab";
  if (/\b(knee|kick|nuts|groin|balls)\b/.test(s)) return "kick";
  if (/\b(hit|punch|strike|slap|smack|elbow|headbutt)\b/.test(s)) return "hit";
  if (/\b(shove|push)\b/.test(s)) return "shove";
  if (/\bout of (the |my )?way\b/.test(s) || /\bforce\s+past\b/.test(s))
    return "force_past";
  if (/\b(attack|fight)\b/.test(s)) return "attack";
  return "assault";
}

function misconductKindFromInput(playerInput: string): string {
  const s = playerInput.toLowerCase();
  if (/\b(pee|piss|urinate)\b/.test(s)) return "urinate";
  if (/\b(shit|defecat|crap)\b/.test(s)) return "defecate";
  if (/\bspit\b/.test(s)) return "spit";
  if (/\b(vomit|puke)\b/.test(s)) return "vomit";
  if (/\bstrip\b|\btake off my clothes\b/.test(s)) return "strip";
  if (/\bscream\b/.test(s)) return "scream";
  if (/\b(trash|destroy|smash)\b/.test(s)) return "vandalize";
  if (/\bfire\b|\bburn\b/.test(s)) return "arson_attempt";
  return "disrupt";
}

/** Present, available living characters at the player's location. */
export function presentCharacterIds(
  def: MysteryDefinition,
  state: PlaythroughState
): string[] {
  return Object.entries(state.characterState)
    .filter(
      ([id, cs]) =>
        cs.locationId === state.locationId &&
        cs.available !== false &&
        def.characters.find((c) => c.id === id)?.storyRole !== "victim"
    )
    .map(([id]) => id);
}

/**
 * Resolve who the player is directing force at.
 * Tolerates typos (hium→him), pronouns, director focus, and single-person rooms.
 */
export function resolveAssaultTarget(
  def: MysteryDefinition,
  state: PlaythroughState,
  playerInput: string,
  hints?: {
    characterId?: string;
    characterHint?: string;
    focusCharacterId?: string;
  }
): string | undefined {
  const presentIds = presentCharacterIds(def, state);
  if (!presentIds.length) return undefined;

  // Explicit director id if present here
  if (hints?.characterId && presentIds.includes(hints.characterId)) {
    return hints.characterId;
  }
  if (hints?.focusCharacterId && presentIds.includes(hints.focusCharacterId)) {
    return hints.focusCharacterId;
  }

  const inputL = playerInput.toLowerCase();
  // Fuzzy pronoun: him/her/them + common typos (hium, hem, thr)
  const pronounLike =
    /\b(him|her|them|hium|hem|hir|thy|the|doctor|nurse|orderly|sir|ma'am|madam)\b/.test(
      inputL
    ) || /\bh[iu]m\b/.test(inputL);

  let best: { id: string; score: number } | undefined;
  for (const id of presentIds) {
    const ch = def.characters.find((c) => c.id === id);
    if (!ch) continue;
    const last = ch.name.split(/\s+/).pop()?.toLowerCase() ?? "";
    let score = Math.max(
      scoreMatch(ch.name, inputL),
      scoreMatch(ch.id, inputL),
      scoreMatch(last, inputL),
      hints?.characterHint
        ? scoreMatch(ch.name, hints.characterHint)
        : 0
    );
    // Authority / staff bias when pronoun or typo-pronoun
    if (score < 15 && pronounLike) {
      if (
        /doctor|dr\.|nurse|orderly|director|inspector|captain|butler|guard/i.test(
          ch.name + " " + id
        ) ||
        /more|holt|crane|henshaw|vale|briggs/i.test(ch.name + id)
      ) {
        score = 28;
      } else {
        score = Math.max(score, 16);
      }
    }
    // Only one other person in the room
    if (score < 15 && presentIds.length === 1) score = 30;
    if (!best || score > best.score) best = { id, score };
  }

  // Still nothing named — if force words + people present, pick staff-ish or first
  if ((!best || best.score < 15) && presentIds.length >= 1) {
    const staff = presentIds.find((id) => {
      const ch = def.characters.find((c) => c.id === id);
      return /doctor|dr\.|nurse|orderly|director|butler|guard|inspector/i.test(
        (ch?.name ?? "") + id
      );
    });
    return staff ?? presentIds[0];
  }

  return best && best.score >= 15 ? best.id : undefined;
}

/**
 * Convert director intents into a single StatePatch for engine validation.
 */
/** Accept full director output or a partial (tests / degraded paths). */
export type DirectorIntentsInput = {
  intents: DirectorOutput["intents"];
  physical?: DirectorOutput["physical"];
  suggestedPatch?: DirectorOutput["suggestedPatch"];
  focusCharacterId?: string;
  reasoning?: string;
};

export function directorIntentsToPatch(
  def: MysteryDefinition,
  state: PlaythroughState,
  director: DirectorIntentsInput,
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
    // The director is LLM-driven and prompt-injectable: never let it write
    // engine-owned flags (case_solved/case_failed would leak the solution) or
    // authored story-progress flags (e.g. lantern_found before the player has
    // actually dug it up — that desyncs the world and can skip a gate). Both
    // sets flip only via their authored trigger; the director emits the intent,
    // the engine sets the flag.
    const { flags: safeFlags, dropped } = stripReservedFlags(
      director.suggestedPatch.setFlags
    );
    const authored = authoredFlagKeys(def);
    const droppedAuthored: string[] = [];
    for (const [key, value] of Object.entries(safeFlags)) {
      if (authored.has(key)) droppedAuthored.push(key);
      else setFlags[key] = value;
    }
    if (dropped.length) notes.push(`dropped reserved flags: ${dropped.join(", ")}`);
    if (droppedAuthored.length)
      notes.push(`dropped authored flags: ${droppedAuthored.join(", ")}`);
  }
  if (director.suggestedPatch?.accuse) {
    patch.accuse = director.suggestedPatch.accuse;
  }

  // AI world-pushback classification (primary) — not verb lists
  const physical = director.physical ?? { kind: "none" as const };
  if (physical.kind === "assault") {
    assaultTarget = resolveAssaultTarget(def, state, playerInput, {
      characterId: physical.characterId,
      characterHint: physical.characterHint,
      focusCharacterId,
    });
    assaultManner = physical.manner ?? assaultMannerFromInput(playerInput);
    if (assaultTarget) {
      focusCharacterId = assaultTarget;
      notes.push(`assault→${assaultTarget} (physical.ai)`);
    } else {
      notes.push("assault unresolved (physical.ai, no present target)");
    }
  } else if (
    physical.kind === "misconduct" ||
    physical.kind === "provoke" ||
    physical.kind === "trespass" ||
    physical.kind === "hazard"
  ) {
    const kindLabel =
      physical.kind === "misconduct"
        ? (physical.misconductKind ?? misconductKindFromInput(playerInput))
        : (physical.manner ?? physical.kind);
    if (physical.kind === "misconduct") {
      const prev = Number(state.flags.misconduct_attempts ?? 0);
      setFlags.player_misconduct = true;
      setFlags.misconduct_attempts = prev + 1;
      setFlags.last_misconduct = kindLabel;
    } else {
      setFlags.player_world_push = true;
      setFlags.last_world_push_kind = physical.kind;
      setFlags.last_world_push_manner = kindLabel;
    }
    if (physical.pushback) {
      setFlags.last_pushback = physical.pushback;
    }
    if (physical.ejectToLocationId) {
      setFlags.eject_to_location = physical.ejectToLocationId;
    }
    if (physical.hazardId) {
      setFlags.last_hazard_id = physical.hazardId;
    }
    // Prefer authored hazard fall target if AI omitted one
    if (physical.kind === "hazard" && !physical.ejectToLocationId) {
      const loc = def.locations.find((l) => l.id === state.locationId);
      const h =
        (physical.hazardId
          ? loc?.hazards?.find((x) => x.id === physical.hazardId)
          : undefined) ?? loc?.hazards?.[0];
      if (h?.fallToLocationId) {
        setFlags.eject_to_location = h.fallToLocationId;
      }
      if (h?.id) setFlags.last_hazard_id = h.id;
      if (h?.condition) setFlags.hazard_condition = h.condition;
      if (h?.tag) setFlags.hazard_tag = h.tag;
    }
    if (physical.kind !== "hazard") {
      const witness =
        resolveAssaultTarget(def, state, playerInput, {
          characterId: physical.characterId,
          characterHint: physical.characterHint,
          focusCharacterId,
        }) ?? presentCharacterIds(def, state)[0];
      if (witness) {
        setFlags.misconduct_witness = witness;
        setFlags.world_push_target = witness;
        focusCharacterId = focusCharacterId ?? witness;
      }
    }
    notes.push(`${physical.kind}→${kindLabel} (physical.ai)`);
    if (physical.pushback) {
      notes.push(`pushback→${physical.pushback}`);
    }
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
          // The director may hedge with every surname match, victim
          // included — a dead man cannot stand accused.
          suspectIds: intent.suspectIds
            ? accusableSuspectIds(def, intent.suspectIds)
            : undefined,
          method: intent.method,
          motive: intent.motive,
        };
        notes.push("accuse");
        break;
      }
      case "assault": {
        const cid =
          resolveAssaultTarget(def, state, playerInput, {
            characterId: intent.characterId,
            characterHint: intent.characterHint,
            focusCharacterId,
          }) ??
          resolveCharacterId(
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
        // Director may emit misconduct:<kind>
        const mis = /^misconduct[:\s]+(\w+)/i.exec(note);
        if (mis && !inputLooksLikeAssault(playerInput)) {
          const kind = mis[1]!.toLowerCase();
          const prev = Number(state.flags.misconduct_attempts ?? 0);
          setFlags.player_misconduct = true;
          setFlags.misconduct_attempts = prev + 1;
          setFlags.last_misconduct = kind;
          const witness =
            resolveAssaultTarget(def, state, playerInput, {
              focusCharacterId,
            }) ?? presentCharacterIds(def, state)[0];
          if (witness) {
            setFlags.misconduct_witness = witness;
            focusCharacterId = focusCharacterId ?? witness;
          }
          notes.push(`misconduct→${kind}`);
        }
        break;
      }
    }
  }

  // Assault intent without physical field (older models)
  if (!assaultTarget) {
    // filled by assault intent case in loop below — re-check notes
  }

  // Intent loop may have set assaultTarget via case "assault"
  // (handled in switch). If still unset but we had assault intent earlier...
  // (already handled in switch)

  if (assaultTarget) {
    const prev = Number(state.flags.assault_attempts ?? 0);
    setFlags.player_assaulted_staff = true;
    setFlags.player_assaulted_someone = true;
    setFlags.assault_attempts = prev + 1;
    setFlags.last_assault_target = assaultTarget;
    setFlags.last_assault_manner = assaultManner ?? "assault";
    setFlags[`assaulted_${assaultTarget}`] = true;
    notes.push(`assault_flags→${assaultTarget}`);
  }

  // Offline/degraded only: if AI never set physical, keep a thin safety net
  // for obvious force/misconduct when no API physical classification ran.
  if (
    physical.kind === "none" &&
    !assaultTarget &&
    !setFlags.player_misconduct &&
    inputLooksLikeAssault(playerInput)
  ) {
    const cid =
      resolveAssaultTarget(def, state, playerInput, { focusCharacterId }) ??
      patch.talkToCharacterId;
    if (cid) {
      assaultTarget = cid;
      focusCharacterId = cid;
      assaultManner = assaultMannerFromInput(playerInput);
      const prev = Number(state.flags.assault_attempts ?? 0);
      setFlags.player_assaulted_staff = true;
      setFlags.player_assaulted_someone = true;
      setFlags.assault_attempts = prev + 1;
      setFlags.last_assault_target = cid;
      setFlags.last_assault_manner = assaultManner;
      setFlags[`assaulted_${cid}`] = true;
      notes.push(`assault→${cid} (offline safety net)`);
      notes.push(`assault_flags→${cid}`);
    }
  }
  if (
    physical.kind === "none" &&
    !assaultTarget &&
    !setFlags.player_misconduct &&
    inputLooksLikeMisconduct(playerInput)
  ) {
    const kind = misconductKindFromInput(playerInput);
    const prev = Number(state.flags.misconduct_attempts ?? 0);
    setFlags.player_misconduct = true;
    setFlags.misconduct_attempts = prev + 1;
    setFlags.last_misconduct = kind;
    const witness =
      resolveAssaultTarget(def, state, playerInput, { focusCharacterId }) ??
      presentCharacterIds(def, state)[0];
    if (witness) {
      setFlags.misconduct_witness = witness;
      focusCharacterId = focusCharacterId ?? witness;
    }
    notes.push(`misconduct→${kind} (offline safety net)`);
  }

  if (addEvidence.size) patch.addEvidenceIds = [...addEvidence];
  if (Object.keys(setFlags).length) patch.setFlags = setFlags;

  return { patch, focusCharacterId, notes };
}
