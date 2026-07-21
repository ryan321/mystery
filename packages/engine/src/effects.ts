import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  ObjectRuntimeState,
  PlayerCondition,
  PlayerControl,
  PlayerStatus,
  PlayerThreat,
  PlaythroughState,
} from "@mystery/shared";
import {
  enterResolution,
  finalizeDenouement,
} from "./resolve-case.js";
import { knownAsFor } from "./identity.js";
import {
  ensureObjectState,
  isInInventory,
  removeFromInventory,
  takeIntoInventory,
} from "./inventory.js";

export type EffectResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
};

const THREAT_ORDER = ["none", "watched", "threatened", "assaulted"] as const;
const CONDITION_ORDER = [
  "unharmed",
  "shaken",
  "bruised",
  "injured",
  "incapacitated",
] as const;
/** Physical control severity (release always uses force). */
const CONTROL_ORDER = [
  "free",
  "held",
  "downed",
  "restrained",
  "unconscious",
] as const;

/** Voluntary walk-away is blocked while not free. */
export function playerCannotWalkAway(status?: PlayerStatus | null): boolean {
  const c = status?.control ?? "free";
  return c !== "free";
}

function defaultPlayerStatus(
  partial?: Partial<PlayerStatus>
): PlayerStatus {
  return {
    threat: partial?.threat ?? "none",
    condition: partial?.condition ?? "unharmed",
    control: partial?.control ?? "free",
    controlledBy: partial?.controlledBy,
    safeHavenCompromised: partial?.safeHavenCompromised ?? false,
    tags: partial?.tags ?? [],
    flags: partial?.flags ?? {},
  };
}

function conditionLabel(c: string): string {
  switch (c) {
    case "shaken":
      return "You are shaken";
    case "bruised":
      return "You are bruised";
    case "injured":
      return "You are injured";
    case "incapacitated":
      return "You are incapacitated";
    default:
      return `Condition: ${c}`;
  }
}

function conditionNarration(c: string, custom?: string): string {
  if (custom?.trim()) return custom.trim();
  switch (c) {
    case "shaken":
      return "Shock or fear has hit the player hard. Stage it as something that happens TO them — not a mood adjective only.";
    case "bruised":
      return "The player has been physically handled (shove, grab, blow). Stage the contact in second person. Do not kill them.";
    case "injured":
      return "The player is hurt — blood, pain, a real wound. Stage the injury as an event this turn. They can still act unless the ending says otherwise.";
    case "incapacitated":
      return "The player can no longer effectively fight back. Stage collapse or restraint. If end_case also fired, this is the failure close.";
    default:
      return "The player's bodily condition has changed. Reflect it in second person.";
  }
}

function controlFromEffectType(t: string, effect: Effect): PlayerControl | null {
  if (t === "hold_player") return "held";
  if (t === "knock_down_player") return "downed";
  if (t === "restrain_player") return "restrained";
  if (t === "knock_out_player") return "unconscious";
  if (t === "release_player") return "free";
  if (t === "set_player_control") {
    const raw = String(effect.control ?? effect.value ?? "free");
    if ((CONTROL_ORDER as readonly string[]).includes(raw)) {
      return raw as PlayerControl;
    }
  }
  return null;
}

/** Short labels for AI justHappened — never player-facing HUD chrome. */
function controlLabel(c: PlayerControl, by?: string): string {
  const who = by ? ` (${by})` : "";
  switch (c) {
    case "held":
      return `Seized${who}`;
    case "downed":
      return "Knocked down";
    case "restrained":
      return `Restrained${who}`;
    case "unconscious":
      return "Knocked out";
    case "free":
      return "Released";
    default:
      return `Control ${c}`;
  }
}

function controlNarration(
  c: PlayerControl,
  custom?: string,
  byName?: string
): string {
  if (custom?.trim()) return custom.trim();
  const agent = byName ? byName : "someone";
  switch (c) {
    case "held":
      return `${agent} has a grip on the player — arm, collar, wrist. Stage being held as an event this turn. The player cannot simply walk away. Struggle and speech are still possible.`;
    case "downed":
      return `The player is knocked to the floor. Stage the fall and impact in second person. They are down but conscious — getting up may be hard while danger is present.`;
    case "restrained":
      return `The player is restrained (bound, pinned, locked in a hold). Stage the restraint as something done TO them. They cannot leave the room under their own power until released.`;
    case "unconscious":
      return `The player is knocked out. Stage the blackout in second person. They cannot act, move, or speak until control returns to free (or the case ends).`;
    case "free":
      return `The player is free of physical control. Stage release, escape, or someone letting go — if relevant this turn.`;
    default:
      return "The player's physical control state has changed. Reflect it in second person.";
  }
}

function recomputeTimeSlot(
  def: MysteryDefinition,
  state: PlaythroughState
): PlaythroughState {
  if (!def.time || !state.time) return state;
  const schedule = [...def.time.schedule].sort(
    (a, b) => a.minutesFromStart - b.minutesFromStart
  );
  let slot = schedule[0]!;
  for (const s of schedule) {
    if (state.time.minutesFromStart >= s.minutesFromStart) slot = s;
  }
  const prev = state.time.slotId;
  const reached = [...state.time.reachedSlotIdsThisTurn];
  if (slot.id !== prev && !reached.includes(slot.id)) {
    reached.push(slot.id);
  }
  return {
    ...state,
    time: {
      ...state.time,
      slotId: slot.id,
      reachedSlotIdsThisTurn: reached,
    },
  };
}

export function applyEffect(
  def: MysteryDefinition,
  state: PlaythroughState,
  effect: Effect
): EffectResult {
  const justHappened: JustHappened[] = [];
  let next = { ...state };
  const t = effect.type;

  if (t === "set_game_flag" || t === "set_game_flag_true") {
    const id = String(effect.id);
    const value = t === "set_game_flag_true" ? true : effect.value;
    next = { ...next, flags: { ...next.flags, [id]: value as never } };
  } else if (t === "set_phase") {
    // Phase is engine/AI context only (caseMeta.phase) — never player-facing.
    next = { ...next, phaseId: String(effect.phaseId) };
  } else if (t === "start_clock") {
    // A non-finite value (e.g. a malformed LLM effect with no `turns`)
    // would persist as JSON null and brick every later state read.
    const turns = Number(effect.turns);
    if (Number.isFinite(turns) && turns >= 0) {
      next = {
        ...next,
        clocks: {
          ...next.clocks,
          [String(effect.clockId)]: turns,
        },
      };
    }
  } else if (t === "queue_beat") {
    const rawDelay = Number(effect.delayTurns ?? 0);
    const fireOnTurn = next.turnCount + (Number.isFinite(rawDelay) ? rawDelay : 0);
    next = {
      ...next,
      beatQueue: [
        ...next.beatQueue,
        { beatId: String(effect.beatId), fireOnTurn },
      ],
    };
  } else if (t === "end_case") {
    // Already hard-closed — no-op unless force
    if (
      (next.status === "solved" ||
        next.status === "failed" ||
        next.status === "abandoned") &&
      !effect.force
    ) {
      // no-op
    } else if (next.status === "denouement" && !effect.force) {
      // Judgment already set; ignore second end_case unless force
    } else {
      const resolved = enterResolution(def, next, {
        endingId: effect.endingId
          ? String(effect.endingId)
          : undefined,
        kind: effect.endingKind
          ? String(effect.endingKind)
          : effect.kind
            ? String(effect.kind)
            : undefined,
        outcome: (effect.outcome as
          | "success"
          | "partial"
          | "failure"
          | "custom") ?? "failure",
        forceHardEnd: Boolean(effect.force && effect.hardEnd),
      });
      next = resolved.state;
      justHappened.push({
        id: resolved.enteredDenouement ? "denouement_start" : "case_end",
        summary: resolved.summary,
        narrationHints: resolved.narrationHints,
      });
    }
  } else if (t === "end_denouement" || t === "finalize_case") {
    if (next.status === "denouement") {
      next = finalizeDenouement(
        def,
        next,
        String(effect.reason ?? "beat") as
          | "turns_exhausted"
          | "player_exit"
          | "beat"
          | "forced"
      );
      justHappened.push({
        id: "denouement_end",
        summary: "Wrap-up ends",
        narrationHints:
          "The aftermath settles. The case is fully closed for this playthrough.",
      });
    }
  } else if (t === "advance_time") {
    if (def.time && next.time) {
      if (effect.toSlotId) {
        const slot = def.time.schedule.find((s) => s.id === effect.toSlotId);
        if (slot) {
          next = {
            ...next,
            time: {
              ...next.time,
              minutesFromStart: slot.minutesFromStart,
              reachedSlotIdsThisTurn: [
                ...next.time.reachedSlotIdsThisTurn,
                slot.id,
              ],
              slotId: slot.id,
            },
          };
          justHappened.push({
            id: `time_${slot.id}`,
            summary: `Time → ${slot.label}`,
            narrationHints: `The evening has moved on — it is now ${slot.label}.`,
          });
        }
      } else if (effect.byMinutes != null) {
        const byMinutes = Number(effect.byMinutes);
        next = {
          ...next,
          time: {
            ...next.time,
            minutesFromStart:
              next.time.minutesFromStart +
              (Number.isFinite(byMinutes) ? byMinutes : 0),
            reachedSlotIdsThisTurn: [...next.time.reachedSlotIdsThisTurn],
          },
        };
        next = recomputeTimeSlot(def, next);
      }
    }
  } else if (t === "set_weather") {
    next = {
      ...next,
      environment: {
        ...next.environment,
        weather: String(effect.weather),
        weatherIntensity: effect.intensity
          ? String(effect.intensity)
          : next.environment.weatherIntensity,
      },
    };
    justHappened.push({
      id: "weather",
      summary: `Weather → ${effect.weather}`,
      narrationHints: `The weather shifts: ${effect.weather}.`,
    });
  } else if (t === "set_light") {
    next = {
      ...next,
      environment: { ...next.environment, light: String(effect.light) },
    };
  } else if (t === "set_crowd") {
    next = {
      ...next,
      environment: { ...next.environment, crowd: String(effect.level) },
    };
    justHappened.push({
      id: "crowd",
      summary: `Crowd → ${effect.level}`,
      narrationHints:
        effect.level === "gathering" || effect.level === "crowd"
          ? "Voices and bodies gather outside."
          : undefined,
    });
  } else if (t === "set_ambient") {
    next = {
      ...next,
      environment: { ...next.environment, ambient: String(effect.ambient) },
    };
  } else if (t === "set_environment_flag") {
    next = {
      ...next,
      environment: {
        ...next.environment,
        flags: {
          ...next.environment.flags,
          [String(effect.id)]: effect.value as never,
        },
      },
    };
  } else if (t === "pulse_environment") {
    const tag = String(effect.tag);
    next = {
      ...next,
      environment: {
        ...next.environment,
        activePulses: [...next.environment.activePulses, tag],
      },
    };
    justHappened.push({
      id: `pulse_${tag}`,
      summary: `Environment pulse: ${tag}`,
      narrationHints:
        tag === "birds_flock"
          ? "A sudden flock of birds erupts into the air."
          : tag === "thunder"
            ? "Thunder cracks over the grounds."
            : `Something shifts in the world: ${tag}.`,
    });
  } else if (t === "set_willingness") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      // LLM effects invent adjectives ("defensive"); an off-enum value
      // persisted here fails every later state read. Coerce to the enum.
      const WILLINGNESS = ["open", "guarded", "hostile", "silent", "fled"];
      const value = WILLINGNESS.includes(String(effect.value))
        ? (effect.value as typeof cs.willingness)
        : "guarded";
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: {
            ...cs,
            willingness: value,
          },
        },
      };
      justHappened.push({
        id: `will_${cid}`,
        summary: `${cid} willingness → ${effect.value}`,
        narrationHints:
          effect.value === "silent"
            ? "They have closed off. Further questions may get nothing."
            : effect.value === "hostile"
              ? "Their manner turns sharp."
              : undefined,
      });
    }
  } else if (t === "set_stance") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: { ...cs, stance: String(effect.value) },
        },
      };
    }
  } else if (t === "add_pressure") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      const prev =
        typeof cs.pressure === "number" && Number.isFinite(cs.pressure)
          ? cs.pressure
          : 0;
      const by = Number(effect.by);
      const delta = Number.isFinite(by) ? by : 0;
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: { ...cs, pressure: prev + delta },
        },
      };
    }
  } else if (t === "add_trust" || t === "set_trust") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      const prevTrust =
        typeof cs.trust === "number" && Number.isFinite(cs.trust)
          ? cs.trust
          : 0;
      const raw = Number(effect.value ?? effect.by ?? (t === "set_trust" ? 0 : 1));
      const n = Number.isFinite(raw) ? raw : 0;
      const trust = t === "set_trust" ? n : prevTrust + n;
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: { ...cs, trust },
        },
      };
    }
  } else if (t === "move_character") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      const rawTo = String(effect.toLocationId ?? "");
      const toLocationId =
        rawTo === "$player" || rawTo === "player" || rawTo === "player_location"
          ? next.locationId
          : rawTo;
      if (toLocationId && def.locations.some((l) => l.id === toLocationId)) {
        next = {
          ...next,
          characterState: {
            ...next.characterState,
            [cid]: { ...cs, locationId: toLocationId },
          },
        };
        const whoLabel = knownAsFor(def, next, cid);
        const where = def.locations.find((l) => l.id === toLocationId);
        justHappened.push({
          id: `move_char_${cid}`,
          summary: `${whoLabel} → ${where?.name ?? toLocationId}`,
          narrationHints: `${whoLabel} is now at ${where?.name ?? "elsewhere"}.`,
        });
      }
    }
  } else if (t === "set_character_available") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: {
            ...cs,
            available: Boolean(effect.value),
            willingness: effect.value ? cs.willingness : "fled",
          },
        },
      };
    }
  } else if (t === "reveal_knowledge") {
    const cid = String(effect.characterId);
    const kid = String(effect.knowledgeId);
    const mem = next.characterMemory[cid] ?? {
      revealedBeatIds: [],
      summary: "",
      recentTurns: [],
    };
    if (!mem.revealedBeatIds.includes(kid)) {
      next = {
        ...next,
        characterMemory: {
          ...next.characterMemory,
          [cid]: {
            ...mem,
            revealedBeatIds: [...mem.revealedBeatIds, kid],
          },
        },
      };
    }
    justHappened.push({
      id: `know_${kid}`,
      summary: `Knowledge unlocked: ${kid}`,
    });
  } else if (t === "set_alibi_status") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: {
            ...cs,
            alibiStatus: effect.value as typeof cs.alibiStatus,
          },
        },
      };
      justHappened.push({
        id: `alibi_${cid}`,
        summary: `Alibi ${effect.value}`,
        narrationHints:
          effect.value === "broken"
            ? "Their alibi no longer holds."
            : undefined,
      });
    }
  } else if (t === "set_object_stage") {
    const oid = String(effect.objectId ?? effect.itemId);
    const os = ensureObjectState(next, oid);
    const stage = effect.value as typeof os.stage;
    next = {
      ...next,
      objectState: {
        ...next.objectState,
        [oid]: {
          ...os,
          stage,
          holder:
            stage === "taken"
              ? (effect.holder as string | undefined) ?? os.holder ?? "player"
              : stage === "given_away"
                ? effect.holder
                  ? String(effect.holder)
                  : os.holder
                : undefined,
        },
      },
    };
    if (stage === "taken" && !next.evidenceIds.includes(oid)) {
      next = takeIntoInventory(next, oid);
    }
  } else if (t === "set_object_locked") {
    const oid = String(effect.objectId ?? effect.itemId);
    const os = ensureObjectState(next, oid, { locked: true });
    next = {
      ...next,
      objectState: {
        ...next.objectState,
        [oid]: { ...os, locked: Boolean(effect.value) },
      },
    };
    justHappened.push({
      id: `lock_${oid}`,
      summary: effect.value ? "Locked" : "Unlocked",
      narrationHints: effect.value
        ? undefined
        : "Something unlocks with a dry click.",
    });
  } else if (t === "grant_evidence") {
    const eid = String(effect.evidenceId ?? effect.itemId);
    if (!next.evidenceIds.includes(eid)) {
      next = takeIntoInventory(next, eid);
      const name = def.evidence.find((e) => e.id === eid)?.name ?? eid;
      justHappened.push({
        id: `ev_${eid}`,
        summary: `Evidence: ${name}`,
        narrationHints: `You obtain: ${name}.`,
      });
    }
  } else if (
    t === "set_item_condition" ||
    t === "set_item_flag" ||
    t === "add_item_tag" ||
    t === "examine_item" ||
    t === "use_item"
  ) {
    const oid = String(effect.itemId ?? effect.objectId ?? effect.evidenceId);
    const os = ensureObjectState(next, oid);
    let updated = { ...os };
    const prevCondition = os.condition ?? "intact";
    if (t === "set_item_condition" || effect.condition != null) {
      updated.condition = String(effect.condition ?? effect.value ?? "intact");
    }
    if (t === "set_item_flag" || effect.id != null) {
      const fid = String(effect.id);
      updated.flags = {
        ...updated.flags,
        [fid]: (effect.value ?? true) as never,
      };
    }
    if (t === "add_item_tag" || effect.tag != null) {
      const tag = String(effect.tag ?? effect.value ?? "");
      if (tag && !updated.tags.includes(tag)) {
        updated.tags = [...updated.tags, tag];
      }
    }
    if (t === "examine_item") {
      updated.timesExamined = updated.timesExamined + 1;
      if (updated.stage === "visible") updated.stage = "examined";
    }
    if (t === "use_item") {
      updated.timesUsed = updated.timesUsed + 1;
    }
    next = {
      ...next,
      objectState: { ...next.objectState, [oid]: updated },
    };
    const name = def.evidence.find((e) => e.id === oid)?.name ?? oid;
    const held = isInInventory(next, oid);
    if (
      (t === "set_item_condition" ||
        (effect.condition != null && t !== "examine_item" && t !== "use_item")) &&
      updated.condition !== prevCondition
    ) {
      const custom = String(effect.text ?? "").trim();
      justHappened.push({
        id: `item_damaged_${oid}`,
        summary: held
          ? `Your ${name} is damaged (${updated.condition})`
          : `${name} is damaged (${updated.condition})`,
        narrationHints:
          custom ||
          (held
            ? `Something the player carries is damaged: ${name} is now ${updated.condition}. Stage this as something that happens TO them (torn, crushed, stained) — not a quiet inventory update.`
            : `${name} is now ${updated.condition}.`),
      });
    }
    if (t === "examine_item" || t === "use_item") {
      justHappened.push({
        id: `${t}_${oid}`,
        summary: t === "examine_item" ? `Examined ${name}` : `Used ${name}`,
        narrationHints:
          t === "examine_item"
            ? `You examine ${name} more closely (condition: ${updated.condition}).`
            : `You use ${name}.`,
      });
    }
  } else if (t === "set_location_accessible") {
    const lid = String(effect.locationId);
    const ls = next.locationState[lid] ?? {
      accessible: true,
      descriptionAppend: "",
      exitOpen: {},
      known: false,
      dressing: [],
    };
    next = {
      ...next,
      locationState: {
        ...next.locationState,
        [lid]: { ...ls, accessible: Boolean(effect.value) },
      },
    };
  } else if (t === "set_exit_open") {
    const from = String(effect.from);
    const to = String(effect.to);
    const key = `${from}->${to}`;
    const ls = next.locationState[from] ?? {
      accessible: true,
      descriptionAppend: "",
      exitOpen: {},
      known: false,
      dressing: [],
    };
    next = {
      ...next,
      locationState: {
        ...next.locationState,
        [from]: {
          ...ls,
          exitOpen: { ...ls.exitOpen, [key]: Boolean(effect.value) },
        },
      },
    };
    justHappened.push({
      id: `exit_${key}`,
      summary: effect.value ? `Exit open ${key}` : `Exit closed ${key}`,
      narrationHints: effect.value
        ? "A way that was closed is open now."
        : undefined,
    });
  } else if (t === "append_location_description") {
    const lid = String(effect.locationId);
    const ls = next.locationState[lid] ?? {
      accessible: true,
      descriptionAppend: "",
      exitOpen: {},
      known: false,
      dressing: [],
    };
    next = {
      ...next,
      locationState: {
        ...next.locationState,
        [lid]: {
          ...ls,
          descriptionAppend: `${ls.descriptionAppend} ${String(effect.text)}`.trim(),
        },
      },
    };
  } else if (t === "reveal_location") {
    // Fog of war: the player learns a place exists without visiting it.
    const lid = String(effect.locationId);
    if (def.locations.some((l) => l.id === lid)) {
      const ls = next.locationState[lid] ?? {
        accessible: true,
        descriptionAppend: "",
        exitOpen: {},
        known: false,
        dressing: [],
      };
      if (!ls.known && !next.visitedLocationIds.includes(lid)) {
        const name = def.locations.find((l) => l.id === lid)?.name ?? lid;
        next = {
          ...next,
          locationState: {
            ...next.locationState,
            [lid]: { ...ls, known: true },
          },
        };
        justHappened.push({
          id: `location_known_${lid}`,
          summary: `You learn of a place: ${name}`,
          narrationHints: `The player now knows ${name} exists (it appears on their map). Convey how they learned of it naturally; do not describe its interior — they have not been there.`,
        });
      }
    }
  } else if (t === "reveal_character") {
    // Existence fog: the player learns this character is part of the story
    // (hearsay or entrance) — cast lists and packs include them from now on.
    const cid = String(effect.characterId);
    const ch = def.characters.find((c) => c.id === cid);
    if (ch) {
      const prev = next.playerKnowledge?.[cid] ?? {
        known: false,
        knownAs:
          (ch.nameKnownAtStart ?? true) ? ch.name : ch.introducedAs ?? ch.name,
        nameKnown: ch.nameKnownAtStart ?? true,
      };
      if (!prev.known) {
        next = {
          ...next,
          playerKnowledge: {
            ...next.playerKnowledge,
            [cid]: { ...prev, known: true },
          },
        };
        justHappened.push({
          id: `character_revealed_${cid}`,
          summary: `Someone new figures in this: ${prev.knownAs}`,
          narrationHints:
            String(effect.text ?? "").trim() ||
            `The player learns that ${prev.knownAs} is part of this story. Convey how they learn of them naturally; do not stage them in the room unless they are actually present.`,
        });
      }
    }
  } else if (t === "reveal_character_name" || t === "set_known_as") {
    // Identity is knowledge: "Orderly" → "Marcus Reed" (PLAYER_SURFACES §5.4).
    const cid = String(effect.characterId);
    const ch = def.characters.find((c) => c.id === cid);
    if (ch) {
      const prev = next.playerKnowledge?.[cid] ?? {
        known: ch.knownAtStart ?? true,
        knownAs:
          (ch.nameKnownAtStart ?? true) ? ch.name : ch.introducedAs ?? ch.name,
        nameKnown: ch.nameKnownAtStart ?? true,
      };
      if (t === "reveal_character_name") {
        if (!prev.nameKnown || prev.knownAs !== ch.name) {
          next = {
            ...next,
            playerKnowledge: {
              ...next.playerKnowledge,
              // Naming someone implies knowing they exist.
              [cid]: { known: true, knownAs: ch.name, nameKnown: true },
            },
          };
          justHappened.push({
            id: `name_revealed_${cid}`,
            summary: `You learn their name: ${ch.name}`,
            narrationHints: `The player now learns that ${prev.knownAs} is named ${ch.name}. Stage the reveal naturally in this scene; from now on the name may be used.`,
          });
        }
      } else {
        const label = String(effect.label ?? effect.value ?? "").trim();
        if (label && label !== prev.knownAs) {
          next = {
            ...next,
            playerKnowledge: {
              ...next.playerKnowledge,
              // Labeling someone implies knowing they exist.
              [cid]: { ...prev, known: true, knownAs: label },
            },
          };
          justHappened.push({
            id: `known_as_${cid}`,
            summary: `You now know them as: ${label}`,
            narrationHints: `The player's label for this person changes to "${label}". Use it from now on.`,
          });
        }
      }
    }
  } else if (t === "move_player" || t === "set_player_location") {
    const toLocationId = String(
      effect.toLocationId ?? effect.locationId ?? ""
    );
    if (toLocationId && def.locations.some((l) => l.id === toLocationId)) {
      const fromId = next.locationId;
      const dest = def.locations.find((l) => l.id === toLocationId);
      const visited = next.visitedLocationIds.includes(toLocationId)
        ? next.visitedLocationIds
        : [...next.visitedLocationIds, toLocationId];
      next = {
        ...next,
        locationId: toLocationId,
        visitedLocationIds: visited,
      };
      if (fromId !== toLocationId) {
        justHappened.push({
          id: `player_moved_${toLocationId}`,
          summary: `You are taken to ${dest?.name ?? toLocationId}`,
          narrationHints:
            String(effect.text ?? "").trim() ||
            `The world moves you — you are now in ${dest?.name ?? toLocationId}. Describe this as something that happens TO the player (escorted, ordered, pulled along), not a free choice. Do not skip the transition.`,
        });
      }
    }
  } else if (t === "set_player_threat") {
    const threat = String(
      effect.threat ?? effect.value ?? "none"
    ) as PlayerThreat;
    const force = Boolean(effect.force);
    const prev = defaultPlayerStatus(next.playerStatus);
    const curIdx = THREAT_ORDER.indexOf(prev.threat as PlayerThreat);
    const nextIdx = THREAT_ORDER.indexOf(threat);
    // Threat only escalates unless force: true
    const applied: PlayerThreat =
      force || nextIdx >= curIdx
        ? (THREAT_ORDER.includes(threat as (typeof THREAT_ORDER)[number])
            ? threat
            : prev.threat)
        : prev.threat;
    next = {
      ...next,
      playerStatus: { ...prev, threat: applied },
    };
    if (applied !== prev.threat) {
      justHappened.push({
        id: `player_threat_${applied}`,
        summary:
          applied === "watched"
            ? "You are being watched"
            : applied === "threatened"
              ? "You have been threatened"
              : applied === "assaulted"
                ? "Violence is directed at you"
                : `Threat: ${applied}`,
        narrationHints:
          applied === "watched"
            ? "Make the player feel watched — a glance, a footstep, the house closing in. This is not polite atmosphere; the investigation is now hunting them too."
            : applied === "threatened"
              ? "A clear threat has been made against the player. Put it in the scene (words or action). The player should feel the danger is personal and immediate."
              : applied === "assaulted"
                ? "Violence has been directed at the player. Stage it as an event that happens TO them (shove, grab, blow), then continue — do not kill them unless an end_case effect already did."
                : undefined,
      });
    }
  } else if (t === "set_player_condition" || t === "harm_player") {
    const raw = String(
      effect.condition ?? effect.value ?? "unharmed"
    ) as PlayerCondition;
    const force = Boolean(effect.force);
    const prev = defaultPlayerStatus(next.playerStatus);
    const curIdx = CONDITION_ORDER.indexOf(
      prev.condition as (typeof CONDITION_ORDER)[number]
    );
    const nextIdx = CONDITION_ORDER.indexOf(
      raw as (typeof CONDITION_ORDER)[number]
    );
    const known = nextIdx >= 0;
    // Condition only escalates unless force: true
    const applied: PlayerCondition =
      !known
        ? prev.condition
        : force || nextIdx >= curIdx
          ? raw
          : prev.condition;
    next = {
      ...next,
      playerStatus: { ...prev, condition: applied },
    };
    const custom = String(effect.text ?? "").trim();
    // harm_player always stages an event; set_player_condition only when changed
    if (t === "harm_player" || applied !== prev.condition) {
      justHappened.push({
        id: `player_harm_${applied}`,
        summary: custom
          ? custom.length > 80
            ? conditionLabel(applied)
            : custom
          : conditionLabel(applied),
        narrationHints: conditionNarration(applied, custom),
      });
    }
  } else if (
    t === "set_player_control" ||
    t === "hold_player" ||
    t === "knock_down_player" ||
    t === "restrain_player" ||
    t === "knock_out_player" ||
    t === "release_player"
  ) {
    const desired = controlFromEffectType(t, effect);
    if (desired) {
      const force = Boolean(effect.force) || t === "release_player" || desired === "free";
      const prev = defaultPlayerStatus(next.playerStatus);
      const curIdx = CONTROL_ORDER.indexOf(
        prev.control as (typeof CONTROL_ORDER)[number]
      );
      const nextIdx = CONTROL_ORDER.indexOf(
        desired as (typeof CONTROL_ORDER)[number]
      );
      const applied: PlayerControl =
        force || nextIdx >= curIdx ? desired : prev.control;

      const byRaw =
        effect.controlledBy != null
          ? String(effect.controlledBy)
          : effect.byCharacterId != null
            ? String(effect.byCharacterId)
            : effect.characterId != null
              ? String(effect.characterId)
              : undefined;
      const controlledBy =
        applied === "free" ? undefined : byRaw ?? prev.controlledBy;

      next = {
        ...next,
        playerStatus: {
          ...prev,
          control: applied,
          controlledBy,
        },
      };

      const byName = controlledBy
        ? def.characters.find((c) => c.id === controlledBy)?.name ?? controlledBy
        : undefined;
      const custom = String(effect.text ?? "").trim();
      const controlChanged =
        applied !== prev.control ||
        (controlledBy ?? "") !== (prev.controlledBy ?? "");
      // Aliases always stage an event; set_player_control only when changed
      if (t !== "set_player_control" || controlChanged) {
        justHappened.push({
          id: `player_control_${applied}`,
          summary: custom
            ? custom.length > 80
              ? controlLabel(applied, byName)
              : custom
            : controlLabel(applied, byName),
          narrationHints: controlNarration(applied, custom, byName),
        });
      }
    }
  } else if (t === "set_safe_haven_compromised") {
    const value = Boolean(effect.value ?? true);
    const prev = defaultPlayerStatus(next.playerStatus);
    next = {
      ...next,
      playerStatus: { ...prev, safeHavenCompromised: value },
    };
    if (value) {
      justHappened.push({
        id: "safe_haven_compromised",
        summary: "Your private space is no longer safe",
        narrationHints:
          "The player's only private refuge has been violated. Make them feel it — even before they see the room — as unease or a servant's urgent word. When they reach the space, the ransack must be vivid.",
      });
    }
  } else if (t === "add_player_tag") {
    const tag = String(effect.tag ?? effect.value ?? "");
    if (tag) {
      const prev = defaultPlayerStatus(next.playerStatus);
      if (!prev.tags.includes(tag)) {
        next = {
          ...next,
          playerStatus: { ...prev, tags: [...prev.tags, tag] },
        };
      }
    }
  } else if (t === "set_player_status_flag") {
    const id = String(effect.id);
    const prev = defaultPlayerStatus(next.playerStatus);
    next = {
      ...next,
      playerStatus: {
        ...prev,
        flags: { ...prev.flags, [id]: effect.value as never },
      },
    };
  } else if (t === "steal_from_player") {
    const except = new Set(
      Array.isArray(effect.exceptItemIds)
        ? effect.exceptItemIds.map(String)
        : []
    );
    const prefer = Array.isArray(effect.preferItemIds)
      ? effect.preferItemIds.map(String)
      : [];
    const specific = effect.itemId
      ? String(effect.itemId)
      : effect.evidenceId
        ? String(effect.evidenceId)
        : effect.objectId
          ? String(effect.objectId)
          : undefined;

    let targetId: string | undefined;
    if (specific && isInInventory(next, specific) && !except.has(specific)) {
      targetId = specific;
    } else {
      for (const id of prefer) {
        if (isInInventory(next, id) && !except.has(id)) {
          targetId = id;
          break;
        }
      }
    }
    if (!targetId && effect.anyHeld) {
      targetId = next.evidenceIds.find((id) => !except.has(id));
    }

    if (targetId && isInInventory(next, targetId)) {
      const toLoc = effect.toLocationId
        ? String(effect.toLocationId)
        : next.locationId;
      const holder = effect.holder ? String(effect.holder) : "unknown";
      const rawStage = effect.stage ? String(effect.stage) : "visible";
      const stage: ObjectRuntimeState["stage"] =
        rawStage === "hidden" ||
        rawStage === "visible" ||
        rawStage === "examined" ||
        rawStage === "destroyed" ||
        rawStage === "given_away"
          ? rawStage
          : "visible";
      next = removeFromInventory(next, targetId, {
        toLocationId: toLoc,
        stage,
        holder,
      });
      const name =
        def.evidence.find((e) => e.id === targetId)?.name ?? targetId;
      const custom = String(effect.text ?? "").trim();
      justHappened.push({
        id: `stolen_${targetId}`,
        summary: `${name} is taken from you`,
        narrationHints:
          custom ||
          `Something is taken FROM the player: ${name}. Stage the theft or loss as an event this turn (snatched, lifted from a pocket, missing after a search) — not a quiet inventory change. Do not invent who took it unless holder or justHappened already names them.`,
      });
      // Tag for case logic / UI
      const prev = defaultPlayerStatus(next.playerStatus);
      if (!prev.tags.includes("robbed")) {
        next = {
          ...next,
          playerStatus: {
            ...prev,
            tags: [...prev.tags, "robbed"],
            flags: { ...prev.flags, last_stolen_item: targetId },
          },
        };
      } else {
        next = {
          ...next,
          playerStatus: {
            ...prev,
            flags: { ...prev.flags, last_stolen_item: targetId },
          },
        };
      }
    }
  } else if (t === "remove_evidence") {
    const eid = String(effect.evidenceId ?? effect.itemId);
    if (next.evidenceIds.includes(eid)) {
      next = removeFromInventory(next, eid, {
        toLocationId: effect.toLocationId
          ? String(effect.toLocationId)
          : undefined,
        stage: "visible",
        holder: effect.holder ? String(effect.holder) : undefined,
      });
      const name = def.evidence.find((e) => e.id === eid)?.name ?? eid;
      const custom = String(effect.text ?? "").trim();
      justHappened.push({
        id: `lost_ev_${eid}`,
        summary: `You no longer have: ${name}`,
        narrationHints:
          custom ||
          `You no longer have: ${name}. If this was theft or seizure, stage it as something that happens TO the player.`,
      });
    }
  } else if (t === "move_object") {
    const oid = String(effect.objectId ?? effect.evidenceId ?? effect.itemId);
    const dest = effect.to != null ? String(effect.to) : undefined;
    const toLoc =
      effect.toLocationIdForObject != null
        ? String(effect.toLocationIdForObject)
        : effect.toLocationId != null
          ? String(effect.toLocationId)
          : dest && dest !== "inventory"
            ? dest
            : undefined;
    if (dest === "inventory") {
      next = takeIntoInventory(next, oid);
    } else if (toLoc) {
      next = removeFromInventory(next, oid, {
        toLocationId: toLoc,
        stage: "visible",
        holder: effect.holder ? String(effect.holder) : undefined,
      });
      justHappened.push({
        id: `move_obj_${oid}`,
        summary: `Object ${oid} moved to ${toLoc}`,
      });
    }
  } else if (t === "notebook_append") {
    const text = String(effect.text ?? "");
    if (text) {
      next = {
        ...next,
        notebook: [
          ...next.notebook,
          {
            id: `auto_${next.notebook.length}_${Date.now()}`,
            text,
            source: "auto" as const,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  } else if (
    t === "set_relationship" ||
    t === "set_relationship_active" ||
    t === "set_relationship_strength" ||
    t === "reveal_relationship" ||
    t === "set_relationship_known"
  ) {
    const rid = String(
      effect.relationshipId ?? effect.id ?? ""
    );
    const defEdge = def.relationships.find((r) => r.id === rid);
    if (rid && defEdge) {
      const prev = next.relationshipState[rid] ?? {
        active: defEdge.startsActive,
        strength: defEdge.strength,
        knownToPlayer: defEdge.knownToPlayerByDefault,
        flags: {},
      };
      let active = prev.active;
      let strength = prev.strength;
      let knownToPlayer = prev.knownToPlayer;
      let labelOverride = prev.labelOverride;
      if (t === "set_relationship_active" || effect.active != null) {
        active = Boolean(
          effect.active ?? effect.value ?? true
        );
      }
      if (t === "set_relationship_strength" || effect.strength != null) {
        strength = Number(effect.strength ?? effect.value ?? strength);
        strength = Math.max(0, Math.min(3, strength));
      }
      if (
        t === "reveal_relationship" ||
        t === "set_relationship_known" ||
        effect.knownToPlayer != null
      ) {
        knownToPlayer = Boolean(
          effect.knownToPlayer ?? effect.value ?? true
        );
      }
      if (effect.label != null) {
        labelOverride = String(effect.label);
      }
      if (t === "set_relationship") {
        if (effect.active != null) active = Boolean(effect.active);
        if (effect.strength != null) strength = Number(effect.strength);
        if (effect.knownToPlayer != null)
          knownToPlayer = Boolean(effect.knownToPlayer);
      }
      next = {
        ...next,
        relationshipState: {
          ...next.relationshipState,
          [rid]: {
            ...prev,
            active,
            strength,
            knownToPlayer,
            labelOverride,
          },
        },
      };
      if (knownToPlayer && !prev.knownToPlayer) {
        justHappened.push({
          id: `rel_reveal_${rid}`,
          summary: `Relationship revealed: ${defEdge.label ?? defEdge.type}`,
          narrationHints: `A bond comes into focus: ${defEdge.fromId} → ${defEdge.toId} (${defEdge.label ?? defEdge.type}). Reveal in story only if natural — no HUD.`,
        });
      }
      if (prev.active && !active) {
        justHappened.push({
          id: `rel_break_${rid}`,
          summary: `Relationship broken: ${rid}`,
          narrationHints: `A bond frays or breaks (${defEdge.label ?? defEdge.type}).`,
        });
      }
    }
  }

  return { state: next, justHappened };
}

export function applyEffects(
  def: MysteryDefinition,
  state: PlaythroughState,
  effects: Effect[]
): EffectResult {
  let current = state;
  const all: JustHappened[] = [];
  for (const effect of effects) {
    const r = applyEffect(def, current, effect);
    current = r.state;
    all.push(...r.justHappened);
  }
  return { state: current, justHappened: all };
}

export { recomputeTimeSlot };
