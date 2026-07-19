import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import {
  enterResolution,
  finalizeDenouement,
} from "./resolve-case.js";
import {
  ensureObjectState,
  removeFromInventory,
  takeIntoInventory,
} from "./inventory.js";

export type EffectResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
};

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
    next = {
      ...next,
      clocks: {
        ...next.clocks,
        [String(effect.clockId)]: Number(effect.turns),
      },
    };
  } else if (t === "queue_beat") {
    const fireOnTurn = next.turnCount + Number(effect.delayTurns ?? 0);
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
        next = {
          ...next,
          time: {
            ...next.time,
            minutesFromStart:
              next.time.minutesFromStart + Number(effect.byMinutes),
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
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: {
            ...cs,
            willingness: effect.value as typeof cs.willingness,
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
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: { ...cs, pressure: cs.pressure + Number(effect.by) },
        },
      };
    }
  } else if (t === "add_trust" || t === "set_trust") {
    const cid = String(effect.characterId);
    const cs = next.characterState[cid];
    if (cs) {
      const trust =
        t === "set_trust"
          ? Number(effect.value ?? effect.by ?? 0)
          : cs.trust + Number(effect.by ?? effect.value ?? 1);
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
      next = {
        ...next,
        characterState: {
          ...next.characterState,
          [cid]: { ...cs, locationId: String(effect.toLocationId) },
        },
      };
      const who = def.characters.find((c) => c.id === cid);
      const where = def.locations.find(
        (l) => l.id === String(effect.toLocationId)
      );
      justHappened.push({
        id: `move_char_${cid}`,
        summary: `${who?.name ?? cid} → ${where?.name ?? effect.toLocationId}`,
        narrationHints: `${who?.name ?? "Someone"} is now at ${where?.name ?? "elsewhere"}.`,
      });
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
    if (t === "examine_item" || t === "use_item") {
      const name = def.evidence.find((e) => e.id === oid)?.name ?? oid;
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
  } else if (t === "set_player_threat") {
    const order = ["none", "watched", "threatened", "assaulted"] as const;
    type Threat = (typeof order)[number];
    const threat = String(effect.threat ?? effect.value ?? "none") as Threat;
    const force = Boolean(effect.force);
    const prev = next.playerStatus ?? {
      threat: "none" as Threat,
      safeHavenCompromised: false,
      tags: [] as string[],
      flags: {},
    };
    const curIdx = order.indexOf(prev.threat as Threat);
    const nextIdx = order.indexOf(threat);
    // Threat only escalates unless force: true
    const applied: Threat =
      force || nextIdx >= curIdx ? threat : (prev.threat as Threat);
    next = {
      ...next,
      playerStatus: { ...prev, threat: applied },
    };
    if (applied !== prev.threat) {
      justHappened.push({
        id: `player_threat_${applied}`,
        summary: `Detective threat → ${applied}`,
        narrationHints:
          applied === "watched"
            ? "You have the sense of being watched."
            : applied === "threatened"
              ? "Someone has made a clear threat against you."
              : applied === "assaulted"
                ? "Violence has been directed at you."
                : undefined,
      });
    }
  } else if (t === "set_safe_haven_compromised") {
    const value = Boolean(effect.value ?? true);
    const prev = next.playerStatus ?? {
      threat: "none" as const,
      safeHavenCompromised: false,
      tags: [] as string[],
      flags: {},
    };
    next = {
      ...next,
      playerStatus: { ...prev, safeHavenCompromised: value },
    };
    if (value) {
      justHappened.push({
        id: "safe_haven_compromised",
        summary: "Safe haven compromised",
        narrationHints:
          "Your private space is no longer safe — someone has been through it.",
      });
    }
  } else if (t === "add_player_tag") {
    const tag = String(effect.tag ?? effect.value ?? "");
    if (tag) {
      const prev = next.playerStatus ?? {
        threat: "none" as const,
        safeHavenCompromised: false,
        tags: [] as string[],
        flags: {},
      };
      if (!prev.tags.includes(tag)) {
        next = {
          ...next,
          playerStatus: { ...prev, tags: [...prev.tags, tag] },
        };
      }
    }
  } else if (t === "set_player_status_flag") {
    const id = String(effect.id);
    const prev = next.playerStatus ?? {
      threat: "none" as const,
      safeHavenCompromised: false,
      tags: [] as string[],
      flags: {},
    };
    next = {
      ...next,
      playerStatus: {
        ...prev,
        flags: { ...prev.flags, [id]: effect.value as never },
      },
    };
  } else if (t === "remove_evidence") {
    const eid = String(effect.evidenceId ?? effect.itemId);
    if (next.evidenceIds.includes(eid)) {
      next = removeFromInventory(next, eid, {
        toLocationId: effect.toLocationId
          ? String(effect.toLocationId)
          : undefined,
        stage: "visible",
      });
      const name = def.evidence.find((e) => e.id === eid)?.name ?? eid;
      justHappened.push({
        id: `lost_ev_${eid}`,
        summary: `Evidence lost: ${name}`,
        narrationHints: `You no longer have: ${name}.`,
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
