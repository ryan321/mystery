import type {
  MysteryDefinition,
  PlaythroughState,
  JustHappened,
} from "@mystery/shared";
import {
  buildContextPack,
  directorIntentsToPatch,
  validateAndApplyPatch,
  appendDialogueMemory,
  advancePassiveTime,
  evaluateBeats,
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
    directorLatencyMs: number;
    performerLatencyMs: number;
    intentNotes: string[];
    focusCharacterId?: string;
    beatsFired: string[];
  };
};

/**
 * Two-call turn with simulation tick:
 *  time march → director → engine patch → beats → performer
 */
export async function runTurnPipeline(args: {
  def: MysteryDefinition;
  state: PlaythroughState;
  playerInput: string;
  llmConfig: LlmConfig | null;
}): Promise<TurnPipelineResult> {
  const { def, playerInput, llmConfig } = args;
  let state = advancePassiveTime(def, args.state);

  const directorPack = buildContextPack(def, state);

  const director = await runDirector(llmConfig, {
    contextPack: directorPack,
    playerInput,
  });

  const { patch, focusCharacterId, notes } = directorIntentsToPatch(
    def,
    state,
    director.output,
    playerInput
  );

  // Detect false accusation of Henshaw for beat
  if (
    patch.accuse?.suspectIds?.includes("henshaw") &&
    !patch.accuse.suspectIds.includes("vale")
  ) {
    patch.setFlags = {
      ...(patch.setFlags ?? {}),
      falsely_accused_henshaw: true,
    };
  }

  const { applied, rejected, nextState, evidenceAdded } =
    validateAndApplyPatch(def, state, patch);

  // Story beats cascade after player-caused changes
  const beatResult = evaluateBeats(def, nextState, 3);
  let simState = beatResult.state;

  const justHappened: JustHappened[] = [...beatResult.justHappened];

  if (applied.setLocationId) {
    const loc = def.locations.find((l) => l.id === applied.setLocationId);
    justHappened.push({
      id: "moved",
      summary: `Player moved to ${loc?.name ?? applied.setLocationId}`,
      narrationHints: `You arrive at ${loc?.name ?? "a new place"}.`,
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
  if (applied.accuse) {
    justHappened.push({
      id: "accusation",
      summary: "Player made an accusation",
      narrationHints: "You commit to an accusation.",
    });
  }

  // Ending performance material
  if (simState.status !== "active" && simState.endingId) {
    const ending = def.endings.find((e) => e.id === simState.endingId);
    if (ending) {
      justHappened.push({
        id: "ending",
        summary: `Ending: ${ending.id}`,
        narrationHints: ending.templateNotes,
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
  });

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
      directorLatencyMs: director.latencyMs,
      performerLatencyMs: performer.latencyMs,
      intentNotes: notes,
      focusCharacterId,
      beatsFired: beatResult.fired,
    },
  };
}
