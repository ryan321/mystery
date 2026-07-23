import type {
  AccusationExtraction,
  MysteryDefinition,
  PlaythroughState,
  JustHappened,
} from "@mystery/shared";
import {
  applyAccuseGate,
  applyDressing,
  buildContextPack,
  revealCoPresentCharacters,
  directorIntentsToPatch,
  staticCasePackJson,
  validateAndApplyPatch,
  appendDialogueMemory,
  advancePassiveTime,
  enterResolution,
  evaluateBeats,
  accusationNarrationHints,
  finalizeDenouement,
  tickDenouement,
  isInteractive,
  inventoryNarrationHints,
  listInventory,
  detectBoundaryLocal,
  boundaryFromDirectorNotes,
  mergeBoundary,
  neutralizePatchForBoundary,
  boundaryJustHappened,
  resolveWorldToPlayer,
} from "@mystery/engine";
import { runDirector, runPerformer, extractAccusationJudgments, type LlmConfig } from "@mystery/llm";

export type TurnPipelineResult = {
  narration: string;
  dialogue: { characterId: string; characterName: string; text: string }[];
  state: PlaythroughState;
  appliedPatch: unknown;
  rejected: string[];
  evidenceAdded: string[];
  justHappened: JustHappened[];
  debug: {
    directorModel: string;
    performerModel: string;
    directorMock: boolean;
    performerMock: boolean;
    directorDegraded?: boolean;
    performerDegraded?: boolean;
    directorLatencyMs: number;
    performerLatencyMs: number;
    directorAttempts?: number;
    performerAttempts?: number;
    intentNotes: string[];
    focusCharacterId?: string;
    beatsFired: string[];
  };
};

/**
 * Hard ceiling on investigation length. Cost bound, not pacing: every turn
 * is two paid LLM calls, so an endless run is an endless bill. Floored at 500
 * (and 4× the case's thorough-player band, meta.playtest.maxTurns, when a case
 * authors a longer one) — no engaged player meets it; a script or an idler
 * eventually does. The case closes through the normal resolution machinery, so
 * an authored failure ending and wrap-up play out instead of a bare error.
 */
export function turnHardCap(def: MysteryDefinition): number {
  return Math.max(500, (def.meta.playtest?.maxTurns ?? 45) * 4);
}

/**
 * Turn loop:
 *  1. Passive time + clock tick
 *  2. Beats on tick (time_expired, clock_expired — before player acts)
 *  3. Director → engine patch
 *  4. Beats on player events (discover/present/talk/on_turn)
 *  5. Denouement exit/budget
 *  6. Performer
 */
/** Blackwood's own voice, baked into its turn (not a shared param). */
const GUIDANCE = {
  director:
    "Blackwood is a rain-soaked country-house night. Suspects are grieving, " +
    "guarded, and proud — they resist with cold refusal and social pressure, " +
    "never by physically restraining a police inspector over a conversation. " +
    "Reserve hold_player/restrain for a genuine, capable threat.",
  performer:
    "Tone: gothic and candle-lit, the storm against the glass; dry, literate, " +
    "never lurid. Keep NPC replies clipped and class-conscious. The night runs " +
    "toward dawn — let the passage of time press quietly on the scene.",
};

/**
 * In-fiction time slots on the road to dawn (from the definition's schedule).
 * Blackwood is a "solve before first light" case; these are the slots where
 * the night's end starts to bite — Blackwood owns this pacing.
 */
const PRE_DAWN_SLOTS: Record<string, string> = {
  small_hours:
    "It is the small hours now — the house has gone very still, and the night " +
    "is more than half spent. Let a note of tiredness and urgency in.",
  toward_dawn:
    "The dark is thinning toward dawn; the storm is easing. Time is nearly out. " +
    "Let the coming light press hard — this is the last of the night.",
};

export async function runBlackwoodTurn(args: {
  def: MysteryDefinition;
  state: PlaythroughState;
  playerInput: string;
  llmConfig: LlmConfig | null;
}): Promise<TurnPipelineResult> {
  const { def, playerInput, llmConfig } = args;
  if (!isInteractive(args.state)) {
    throw new Error("case_not_interactive");
  }

  let state = advancePassiveTime(def, args.state);

  // --- Beat pass 1: world ticks (clocks/time) fire before the player acts ---
  const tickBeats = evaluateBeats(def, state, 3, { source: "tick" });
  state = tickBeats.state;
  const justHappened: JustHappened[] = [...tickBeats.justHappened];
  const allFired = [...tickBeats.fired];

  // Turn ceiling: judged exactly like a tick-fired ending — the world moves
  // on without the player's answer, and the accuse window closes below.
  if (state.status === "active" && state.turnCount >= turnHardCap(def)) {
    const capped = enterResolution(def, state, { outcome: "failure" });
    state = capped.state;
    justHappened.push({
      id: "investigation_expired",
      summary: "The investigation runs out of time",
      narrationHints:
        "The case will not wait any longer. Events overtake the investigation and the matter is decided without the player's answer. Narrate the world closing the question, not a rule.",
    });
  }

  // If tick ended the investigation (e.g. murdered on clock), still allow
  // denouement interaction with this input — strip investigate-only intents later.

  // --- Blackwood mechanic: the night presses toward dawn ---
  // Blackwood is "solve before first light." As the clock crosses into its
  // final slots, feed the narrator a pressure cue so the player feels dawn
  // coming before it ends the case. Owned here, not in the shared engine.
  const slotId = state.time?.slotId ?? "";
  if (state.status === "active" && PRE_DAWN_SLOTS[slotId]) {
    justHappened.push({
      id: "dawn_pressure",
      summary: "The night presses toward dawn",
      narrationHints: PRE_DAWN_SLOTS[slotId],
    });
  }

  // Director gets the lean pack — it never reads the heavy acting-detail
  // fields, and it runs first on the serial path, so trimming its prompt is
  // the biggest per-turn cost+latency win. The performer keeps the full pack.
  const directorPack = buildContextPack(def, state, { lean: true });
  // Byte-identical every turn — enables provider prompt-prefix caching.
  const staticCaseJson = staticCasePackJson(def);

  // High-precision local boundary scan (jailbreak, solution fishing, abuse, powers…)
  const localBoundary = detectBoundaryLocal(playerInput);

  const director = await runDirector(llmConfig, {
    contextPack: directorPack,
    playerInput,
    boundaryHint: localBoundary?.kind ?? null,
    staticCaseJson,
    guidance: GUIDANCE.director,
  });

  let { patch, focusCharacterId, notes } = directorIntentsToPatch(
    def,
    state,
    director.output,
    playerInput
  );

  const directorBoundary = boundaryFromDirectorNotes(
    notes,
    director.output.intents.map((i) => ({
      type: i.type,
      note: "note" in i ? i.note : undefined,
    }))
  );
  const boundary = mergeBoundary(localBoundary, directorBoundary);

  if (boundary) {
    patch = neutralizePatchForBoundary(patch);
    notes.push(`boundary:${boundary.kind}`);
    justHappened.push(boundaryJustHappened(boundary));
    // No focus on victims of abuse attempts as "conversation targets"
    if (boundary.kind === "blocked_abuse") {
      focusCharacterId = undefined;
    }
  }

  if (state.status === "denouement" && patch.accuse) {
    delete patch.accuse;
    notes.push("accuse ignored — denouement");
  }

  // If tick already judged the case into denouement, block new accuse
  if (args.state.status === "active" && state.status === "denouement") {
    delete patch.accuse;
  }

  // Accusation confirmation gate: informal accusations go pending and must be
  // confirmed (or worded formally) before they are scored. Also records
  // generic accused_<id> flags for definition-driven reactions.
  // Skip accuse gate entirely when boundary already neutralized the turn.
  const gate = boundary
    ? {
        state,
        patch,
        justHappened: [] as typeof justHappened,
        notes: [] as string[],
      }
    : applyAccuseGate(def, state, patch, playerInput);
  state = gate.state;
  justHappened.push(...gate.justHappened);
  notes.push(...gate.notes);

  // Accusation scoring: on an accuse turn, the LLM extracts WHAT the
  // accusation claims (who it names, which rubric facts it affirms) and
  // the engine decides the verdict from that structure — no regex on
  // player prose. Extraction failure falls back to the legacy matcher.
  let accusationExtraction: AccusationExtraction | undefined;
  if (gate.patch.accuse && state.status === "active") {
    const a = gate.patch.accuse;
    accusationExtraction =
      (await extractAccusationJudgments(llmConfig, {
        accuse: {
          summary: a.summary,
          method: a.method,
          motive: a.motive,
          suspectNames: (a.suspectIds ?? []).map(
            (id) => def.characters.find((c) => c.id === id)?.name ?? id
          ),
        },
        characters: def.characters.map((c) => ({
          id: c.id,
          name: c.name,
          introducedAs: c.introducedAs,
        })),
        facts: def.solution.rubric.requiredFacts.map((f) => ({
          id: f.id,
          description: f.description,
          role: f.role,
          matchHints: f.matchHints,
        })),
      })) ?? undefined;
    notes.push(accusationExtraction ? "accuse:extract" : "accuse:regex");
  }

  const { applied, rejected, nextState, evidenceAdded, accusation, movedThrough } =
    validateAndApplyPatch(def, state, gate.patch, undefined, {
      accusationExtraction,
    });

  // --- Beat pass 2: player-caused unlocks ---
  const playerBeats = evaluateBeats(def, nextState, 3, {
    source: "player",
    discoveredEvidenceIds: evidenceAdded,
    presented: applied.presented,
    talkedToCharacterId: applied.talkToCharacterId,
  });
  let simState = playerBeats.state;
  justHappened.push(...playerBeats.justHappened);
  allFired.push(...playerBeats.fired);

  // ── WORLD → PLAYER (core engine phase) ─────────────────────────────────
  // Force, seizure, eject, hazard, blocked escape, enter-location dangers.
  // Authored beat effects already live in justHappened; defaults fill gaps.
  const worldToPlayer = resolveWorldToPlayer(def, simState, {
    notes,
    applied,
    firedBeatIds: playerBeats.fired,
    justHappenedSoFar: justHappened,
    rejected,
    // On a boundary turn (jailbreak / solution-fishing / abuse) the director's
    // proposed world→player effects are untrusted — drop them so they can't
    // bypass patch neutralization. Engine defaults still resolve normally.
    worldToPlayer: boundary ? undefined : director.output.worldToPlayer,
  });
  simState = worldToPlayer.state;
  justHappened.push(...worldToPlayer.justHappened);

  // Leaving the room breaks any hold — whoever had a grip on the player is in
  // the room they just left. Clears a "held" state (even one re-applied by this
  // turn's world→player effects) so a grabbed sleeve can never trap the player
  // across turns. Genuine incapacitation (restrained/downed/unconscious) blocks
  // the move upstream, so this only fires when a move actually succeeded.
  if (applied.setLocationId && simState.playerStatus?.control === "held") {
    simState = {
      ...simState,
      playerStatus: {
        ...simState.playerStatus,
        control: "free",
        controlledBy: undefined,
      },
    };
    justHappened.push({
      id: "broke_free",
      summary: "You break free and leave",
      narrationHints:
        "The player pulls out of the grip and leaves the room. Narrate breaking away briefly; do not stage a successful hold or block the exit.",
    });
  }

  // Far-room move: the player named a destination that wasn't an adjacent
  // exit and the engine walked them there through connecting rooms. Tell the
  // performer to narrate the transit and land the scene at the destination —
  // never to stage a block (the old failure mode).
  if (movedThrough && movedThrough.length > 1) {
    const names = movedThrough.map(
      (id) => def.locations.find((l) => l.id === id)?.name ?? id
    );
    const dest = names[names.length - 1];
    const through = names.slice(0, -1).join(", ");
    justHappened.push({
      id: "traveled",
      summary: `Traveled to ${dest}`,
      narrationHints: `The player walks to ${dest}, passing through ${through} on the way. Narrate the journey briefly and land the scene in ${dest}. Do NOT block or refuse the move; they arrive.`,
    });
  }

  if (evidenceAdded.length) {
    const names = evidenceAdded
      .map((id) => def.evidence.find((e) => e.id === id)?.name ?? id)
      .join(", ");
    justHappened.push({
      id: "evidence_gained",
      summary: `Gained evidence: ${names}`,
      narrationHints: `You obtain: ${names}.`,
    });
  }
  if (applied.presented?.length) {
    for (const p of applied.presented) {
      justHappened.push({
        id: `presented_${p.evidenceId}_${p.characterId}`,
        summary: `Presented ${p.evidenceId} to ${p.characterId}`,
        narrationHints: `You present evidence to them.`,
      });
    }
  }
  if (applied.accuse && accusation) {
    justHappened.push({
      id: "accusation",
      summary: `Accusation ${accusation.score} (${accusation.path})`,
      narrationHints: accusationNarrationHints(def, accusation),
    });
  } else if (applied.accuse) {
    justHappened.push({
      id: "accusation",
      summary: "Player made an accusation",
      narrationHints: "You commit to an accusation.",
    });
  }
  if (applied.requestInventory || notes.includes("inventory")) {
    justHappened.push({
      id: "inventory",
      summary: "Player checks inventory",
      narrationHints: inventoryNarrationHints(def, simState),
    });
  }
  if (applied.examineItemId) {
    const item = listInventory(def, simState).find(
      (i) => i.id === applied.examineItemId
    );
    justHappened.push({
      id: `examine_item_${applied.examineItemId}`,
      summary: `Examined ${item?.name ?? applied.examineItemId}`,
      narrationHints: item
        ? `You examine ${item.name} in your possession. Condition: ${item.condition}. ${item.description}`
        : `You examine ${applied.examineItemId}.`,
    });
  }
  if (applied.useItemId) {
    const item = listInventory(def, simState).find(
      (i) => i.id === applied.useItemId
    );
    justHappened.push({
      id: `use_item_${applied.useItemId}`,
      summary: `Used ${item?.name ?? applied.useItemId}`,
      narrationHints: item
        ? `You make use of ${item.name} (uses: ${item.timesUsed}).`
        : `You use ${applied.useItemId}.`,
    });
  }

  const enteredDenouementThisTurn =
    args.state.status === "active" && simState.status === "denouement";

  if (simState.status === "denouement" && simState.endingId) {
    const ending = def.endings.find((e) => e.id === simState.endingId);
    if (ending && enteredDenouementThisTurn) {
      justHappened.push({
        id: "denouement_start",
        summary: `Wrap-up begins: ${ending.title ?? ending.id}`,
        narrationHints: [
          ending.templateNotes,
          def.wrapUp?.performanceNotes,
          "Judgment is in. Stay with the household for the aftermath — confessions, reactions, consequences. Still interactive.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } else if (ending && args.state.status === "denouement") {
      justHappened.push({
        id: "denouement_continue",
        summary: "Aftermath continues",
        narrationHints:
          "Still in wrap-up. Characters remain in the fallout of the judgment.",
      });
    }
  } else if (
    (simState.status === "solved" || simState.status === "failed") &&
    simState.endingId
  ) {
    const ending = def.endings.find((e) => e.id === simState.endingId);
    if (ending) {
      justHappened.push({
        id: "ending",
        summary: `Ending: ${ending.id}`,
        narrationHints: ending.templateNotes,
      });
    }
  }

  const exitWrapUp =
    simState.status === "denouement" &&
    def.wrapUp?.allowEarlyExit !== false &&
    (notes.some((n) => /exit_denouement/i.test(n)) ||
      /\b(i('m| am)? (done|leaving)|goodbye|good night|end (the )?case|close the case|that('s| is) enough|i leave)\b/i.test(
        playerInput
      ));
  if (exitWrapUp) {
    simState = finalizeDenouement(def, simState, "player_exit");
    justHappened.push({
      id: "denouement_end",
      summary: "You leave the aftermath",
      narrationHints:
        "The player steps away. Close the wrap-up with a final image; case fully closed.",
    });
  } else if (
    args.state.status === "denouement" &&
    simState.status === "denouement"
  ) {
    const before = simState;
    simState = tickDenouement(def, simState);
    if (before.status === "denouement" && simState.status !== "denouement") {
      justHappened.push({
        id: "denouement_end",
        summary: "Wrap-up time runs out",
        narrationHints:
          "The aftermath has run its course. Give a final closing image.",
      });
    }
  }

  const performerPack = buildContextPack(def, simState, {
    focusCharacterId,
    justHappened,
    resolvedIntents: notes,
  });

  const performer = await runPerformer(llmConfig, {
    contextPack: performerPack,
    playerInput,
    justHappened,
    resolvedNotes: notes,
    staticCaseJson,
    guidance: GUIDANCE.performer,
  });

  // Meeting someone reveals them: characters sharing the player's location
  // become known (existence fog lifts on co-presence).
  simState = revealCoPresentCharacters(def, simState).state;

  // Persist improvised scene dressing (validated: closed-world, caps,
  // dedupe). Accepted facts appear in every future pack for their target.
  const dressed = applyDressing(def, simState, performer.output.dressing ?? []);
  simState = dressed.state;
  if (dressed.rejected.length) {
    notes.push(...dressed.rejected.map((r) => `dressing rejected: ${r}`));
  }

  let committed = appendDialogueMemory(simState, playerInput, {
    narration: performer.output.narration,
    dialogue: performer.output.dialogue,
    patch: applied,
  });
  committed = {
    ...committed,
    turnCount: args.state.turnCount + 1,
    updatedAt: new Date().toISOString(),
  };

  return {
    narration: performer.output.narration,
    dialogue: performer.output.dialogue ?? [],
    state: committed,
    appliedPatch: applied,
    rejected,
    evidenceAdded,
    justHappened,
    debug: {
      directorModel: director.model,
      performerModel: performer.model,
      directorMock: director.mock,
      performerMock: performer.mock,
      directorDegraded: director.degraded,
      performerDegraded: performer.degraded,
      directorLatencyMs: director.latencyMs,
      performerLatencyMs: performer.latencyMs,
      directorAttempts: director.attempts?.length,
      performerAttempts: performer.attempts?.length,
      intentNotes: notes,
      focusCharacterId,
      beatsFired: allFired,
    },
  };
}
