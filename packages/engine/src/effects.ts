import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";

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
    next = { ...next, phaseId: String(effect.phaseId) };
    justHappened.push({
      id: `phase_${effect.phaseId}`,
      summary: `Phase → ${effect.phaseId}`,
    });
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
    const outcome = effect.outcome as "success" | "partial" | "failure";
    const status = outcome === "failure" ? "failed" : "solved";
    const ending =
      def.endings.find((e) => e.when === outcome) ??
      def.endings.find((e) => e.when === "success");
    next = {
      ...next,
      status,
      endingId: ending?.id,
      flags: { ...next.flags, case_solved: status === "solved" },
    };
    justHappened.push({
      id: "case_end",
      summary: `Case ${status}`,
      narrationHints: ending?.templateNotes,
    });
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
    const oid = String(effect.objectId);
    const os = next.objectState[oid] ?? {
      stage: "visible" as const,
      locked: false,
    };
    next = {
      ...next,
      objectState: {
        ...next.objectState,
        [oid]: {
          ...os,
          stage: effect.value as typeof os.stage,
        },
      },
    };
  } else if (t === "set_object_locked") {
    const oid = String(effect.objectId);
    const os = next.objectState[oid] ?? {
      stage: "visible" as const,
      locked: true,
    };
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
    const eid = String(effect.evidenceId);
    if (!next.evidenceIds.includes(eid)) {
      next = { ...next, evidenceIds: [...next.evidenceIds, eid] };
      const name = def.evidence.find((e) => e.id === eid)?.name ?? eid;
      justHappened.push({
        id: `ev_${eid}`,
        summary: `Evidence: ${name}`,
        narrationHints: `You obtain: ${name}.`,
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
