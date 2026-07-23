/**
 * standardTurn — the composable default turn loop.
 *
 * Platform helper, not "the only engine." Games call this with voice/hooks,
 * or replace runTurn entirely when they need a different loop. Either way
 * sealing, closed-world validation, and accuse scoring stay in engine
 * primitives — never reimplemented per game.
 *
 * Flow:
 *  1. Passive time + tick beats + hard cap
 *  2. Game afterTick hook (dawn pressure, custom pacing, …)
 *  3. Director → intents → patch (boundary neutralize)
 *  4. Accuse gate + apply patch + player beats
 *  5. World→player
 *  6. Performer
 *  7. Dressing + dialogue memory + turnCount
 */
import type {
  AccusationExtraction,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
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
  itemReadableText,
  beginFormalAccusation,
} from "@mystery/engine";
import {
  runDirector,
  runPerformer,
  extractAccusationJudgments,
} from "@mystery/llm";
import type {
  Platform,
  StandardTurnOptions,
  TurnRequest,
  TurnResult,
} from "./types.js";

/**
 * Hard ceiling on investigation length. Cost bound, not pacing: every turn
 * is two paid LLM calls. Floored at 500 (and 4× thorough-player band).
 */
export function turnHardCap(def: MysteryDefinition): number {
  return Math.max(500, (def.meta.playtest?.maxTurns ?? 45) * 4);
}

/**
 * Default turn composition. Pass `options.guidance` / `options.afterTick` for
 * per-game voice and pacing without forking this file.
 */
export async function standardTurn(
  req: TurnRequest,
  platform: Platform,
  options: StandardTurnOptions = {}
): Promise<TurnResult> {
  const { def, playerInput } = req;
  const llmConfig = platform.llmConfig;

  if (!isInteractive(req.state)) {
    throw new Error("case_not_interactive");
  }

  let state = advancePassiveTime(def, req.state);

  // --- Beat pass 1: world ticks before the player acts ---
  const tickBeats = evaluateBeats(def, state, 3, { source: "tick" });
  state = tickBeats.state;
  const justHappened: JustHappened[] = [...tickBeats.justHappened];
  const allFired = [...tickBeats.fired];

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

  // --- Game hook: after tick (pacing, dawn, custom clocks) ---
  if (options.afterTick) {
    const hooked = options.afterTick({ def, state, justHappened });
    if (hooked?.state) state = hooked.state;
    if (hooked?.justHappened?.length) {
      justHappened.push(...hooked.justHappened);
    }
  }

  const directorPack = buildContextPack(def, state, { lean: true });
  const staticCaseJson = staticCasePackJson(def);
  const localBoundary = detectBoundaryLocal(playerInput);

  const director = await runDirector(llmConfig, {
    contextPack: directorPack,
    playerInput,
    boundaryHint: localBoundary?.kind ?? null,
    staticCaseJson,
    guidance: options.guidance?.director,
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
    if (boundary.kind === "blocked_abuse") {
      focusCharacterId = undefined;
    }
  }

  if (state.status === "denouement" && patch.accuse) {
    delete patch.accuse;
    notes.push("accuse ignored — denouement");
  }
  if (req.state.status === "active" && state.status === "denouement") {
    delete patch.accuse;
  }

  const gate = boundary
    ? {
        state,
        patch,
        justHappened: [] as JustHappened[],
        notes: [] as string[],
      }
    : applyAccuseGate(def, state, patch, playerInput);
  state = gate.state;
  justHappened.push(...gate.justHappened);
  notes.push(...gate.notes);

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

  const {
    applied,
    rejected,
    nextState,
    evidenceAdded,
    accusation,
    movedThrough,
    itemJustHappened,
  } = validateAndApplyPatch(def, state, gate.patch, undefined, {
    accusationExtraction,
  });

  const playerBeats = evaluateBeats(def, nextState, 3, {
    source: "player",
    discoveredEvidenceIds: evidenceAdded,
    presented: applied.presented,
    talkedToCharacterId: applied.talkToCharacterId,
  });
  let simState = playerBeats.state;
  justHappened.push(...playerBeats.justHappened);
  allFired.push(...playerBeats.fired);

  const worldToPlayer = resolveWorldToPlayer(def, simState, {
    notes,
    applied,
    firedBeatIds: playerBeats.fired,
    justHappenedSoFar: justHappened,
    rejected,
    worldToPlayer: boundary ? undefined : director.output.worldToPlayer,
  });
  simState = worldToPlayer.state;
  justHappened.push(...worldToPlayer.justHappened);

  // Leaving the room breaks a mere grip ("held") — game-agnostic fairness.
  if (
    applied.setLocationId &&
    applied.setLocationId !== req.state.locationId &&
    simState.playerStatus?.control === "held"
  ) {
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
    const body = itemReadableText(def, applied.examineItemId);
    justHappened.push({
      id: `examine_item_${applied.examineItemId}`,
      summary: `Examined ${item?.name ?? applied.examineItemId}`,
      narrationHints: body
        ? `You examine ${item?.name ?? applied.examineItemId}. It can be read. The text reads:\n\n${body}\n\nRender this text faithfully in narration (letter/ledger body).`
        : item
          ? `You examine ${item.name} in your possession. Condition: ${item.condition}. ${item.description}`
          : `You examine ${applied.examineItemId}.`,
    });
  }
  if (applied.useItemId) {
    const item = listInventory(def, simState).find(
      (i) => i.id === applied.useItemId
    );
    const targetNote = applied.useTargetId
      ? ` on ${applied.useTargetId}`
      : "";
    justHappened.push({
      id: `use_item_${applied.useItemId}`,
      summary: `Used ${item?.name ?? applied.useItemId}${targetNote}`,
      narrationHints: item
        ? `You make use of ${item.name}${targetNote} (uses: ${item.timesUsed}). Stage the authored outcome if justHappened lists further effects.`
        : `You use ${applied.useItemId}${targetNote}.`,
    });
  }
  if (itemJustHappened?.length) {
    justHappened.push(...itemJustHappened);
  }

  const enteredDenouementThisTurn =
    req.state.status === "active" && simState.status === "denouement";

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
    } else if (ending && req.state.status === "denouement") {
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
    req.state.status === "denouement" &&
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
    guidance: options.guidance?.performer,
  });

  simState = revealCoPresentCharacters(def, simState).state;

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
    turnCount: req.state.turnCount + 1,
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

/**
 * Accuse-button ceremony: assemble the household, stage the room, wait for
 * freeform charge. No director, no form — one performer call for gathering.
 */
export async function runAccusationStaging(
  req: { def: MysteryDefinition; state: PlaythroughState },
  platform: Platform,
  options: StandardTurnOptions = {}
): Promise<TurnResult> {
  const { def } = req;
  if (!isInteractive(req.state) || req.state.status !== "active") {
    throw new Error("case_not_interactive");
  }

  const begun = beginFormalAccusation(def, req.state);
  if (begun.rejected) {
    throw new Error(begun.rejected);
  }

  let state = begun.state;
  const justHappened = [...begun.justHappened];
  const notes = begun.alreadyActive
    ? ["formal accusation already active"]
    : ["formal accusation scene opened"];

  const staticCaseJson = staticCasePackJson(def);
  const performerPack = buildContextPack(def, state, {
    justHappened,
    resolvedIntents: notes,
  });

  const performer = await runPerformer(platform.llmConfig, {
    contextPack: performerPack,
    playerInput:
      "[The player calls for a formal accusation. They have not yet spoken their charge.]",
    justHappened,
    resolvedNotes: notes,
    staticCaseJson,
    guidance: options.guidance?.performer,
  });

  state = revealCoPresentCharacters(def, state).state;
  const dressed = applyDressing(def, state, performer.output.dressing ?? []);
  state = dressed.state;

  const committed = {
    ...state,
    turnCount: req.state.turnCount + 1,
    updatedAt: new Date().toISOString(),
  };

  return {
    narration: performer.output.narration,
    dialogue: performer.output.dialogue ?? [],
    state: committed,
    appliedPatch: {},
    rejected: begun.rejected ? [begun.rejected] : [],
    evidenceAdded: [],
    justHappened,
    debug: {
      directorModel: "—",
      performerModel: performer.model,
      directorMock: true,
      performerMock: performer.mock,
      performerDegraded: performer.degraded,
      directorLatencyMs: 0,
      performerLatencyMs: performer.latencyMs,
      performerAttempts: performer.attempts?.length,
      intentNotes: notes,
      beatsFired: [],
    },
  };
}

/**
 * @deprecated Prefer `standardTurn(req, platform, opts)`.
 * Thin wrapper for older call sites that pass a flat args object.
 */
export async function runTurnPipeline(args: {
  def: MysteryDefinition;
  state: PlaythroughState;
  playerInput: string;
  llmConfig: import("@mystery/llm").LlmConfig | null;
  guidance?: { director?: string; performer?: string };
}): Promise<TurnResult> {
  return standardTurn(
    {
      def: args.def,
      state: args.state,
      playerInput: args.playerInput,
    },
    {
      llmConfig: args.llmConfig,
      createInitialState: () => {
        throw new Error("runTurnPipeline shim: createInitialState unused");
      },
      buildPlayerView: () => {
        throw new Error("runTurnPipeline shim: buildPlayerView unused");
      },
      computeProgress: () => {
        throw new Error("runTurnPipeline shim: computeProgress unused");
      },
    },
    { guidance: args.guidance }
  );
}
