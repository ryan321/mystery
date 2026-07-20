import type {
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
import { runDirector, runPerformer, type LlmConfig } from "@mystery/llm";

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
 * Turn loop:
 *  1. Passive time + clock tick
 *  2. Beats on tick (time_expired, clock_expired — before player acts)
 *  3. Director → engine patch
 *  4. Beats on player events (discover/present/talk/on_turn)
 *  5. Denouement exit/budget
 *  6. Performer
 */
export async function runTurnPipeline(args: {
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

  // If tick ended the investigation (e.g. murdered on clock), still allow
  // denouement interaction with this input — strip investigate-only intents later.

  const directorPack = buildContextPack(def, state);
  // Byte-identical every turn — enables provider prompt-prefix caching.
  const staticCaseJson = staticCasePackJson(def);

  // High-precision local boundary scan (jailbreak, solution fishing, abuse, powers…)
  const localBoundary = detectBoundaryLocal(playerInput);

  const director = await runDirector(llmConfig, {
    contextPack: directorPack,
    playerInput,
    boundaryHint: localBoundary?.kind ?? null,
    staticCaseJson,
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

  const { applied, rejected, nextState, evidenceAdded, accusation } =
    validateAndApplyPatch(def, state, gate.patch);

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
    worldToPlayer: director.output.worldToPlayer,
  });
  simState = worldToPlayer.state;
  justHappened.push(...worldToPlayer.justHappened);

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
