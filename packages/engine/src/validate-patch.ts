import type {
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import { flagsMatch, mergeFlags } from "./flags.js";
import { canRevealBeat } from "./knowledge.js";

export type PatchValidation = {
  applied: StatePatch;
  rejected: string[];
  nextState: PlaythroughState;
  evidenceAdded: string[];
};

function locationById(def: MysteryDefinition, id: string) {
  return def.locations.find((l) => l.id === id);
}

function holdsEvidence(state: PlaythroughState, ids?: string[]): boolean {
  if (!ids?.length) return true;
  return ids.every((id) => state.evidenceIds.includes(id));
}

function exitIsOpen(
  def: MysteryDefinition,
  state: PlaythroughState,
  fromId: string,
  toId: string
): boolean {
  const key = `${fromId}->${toId}`;
  const ls = state.locationState[fromId];
  if (ls?.exitOpen[key] !== undefined) return ls.exitOpen[key];
  const from = locationById(def, fromId);
  const exit = from?.exits.find((e) => e.toLocationId === toId);
  if (!exit) return false;
  return !exit.startsClosed;
}

function legalExit(
  def: MysteryDefinition,
  state: PlaythroughState,
  fromId: string,
  toId: string
): boolean {
  if (fromId === toId) return true;
  const from = locationById(def, fromId);
  if (!from) return false;
  const destState = state.locationState[toId];
  if (destState && !destState.accessible) return false;

  for (const exit of from.exits) {
    if (exit.toLocationId !== toId) continue;
    if (!flagsMatch(state.flags, exit.requiresFlags)) continue;
    if (!holdsEvidence(state, exit.requiresEvidenceIds)) continue;
    if (!exitIsOpen(def, state, fromId, toId)) continue;
    return true;
  }
  return false;
}

function inspectRequirementsMet(
  state: PlaythroughState,
  requiresFlags?: Record<string, unknown>,
  requiresEvidenceIds?: string[]
): boolean {
  if (!flagsMatch(state.flags, requiresFlags as never)) return false;
  if (!holdsEvidence(state, requiresEvidenceIds)) return false;
  return true;
}

function evidenceDiscoverableHere(
  def: MysteryDefinition,
  state: PlaythroughState,
  evidenceId: string
): boolean {
  const item = def.evidence.find((e) => e.id === evidenceId);
  if (!item) return false;
  if (state.evidenceIds.includes(evidenceId)) return false;

  if (!item.discoverableAt) {
    return true;
  }

  const { locationId, inspectableId } = item.discoverableAt;
  if (state.locationId !== locationId) return false;

  const loc = locationById(def, locationId);
  const insp = loc?.inspectables.find((i) => i.id === inspectableId);
  if (!insp) return false;

  if (
    !inspectRequirementsMet(
      state,
      insp.onInspect.requiresFlags,
      insp.onInspect.requiresEvidenceIds
    )
  ) {
    return false;
  }
  if (!flagsMatch(state.flags, insp.hiddenUntilFlags)) return false;

  // Locked container: requiresEvidenceIds already checked above (e.g. key in hand).
  // object.locked is bookkeeping only once requirements are met.

  return insp.onInspect.revealsEvidenceIds?.includes(evidenceId) ?? false;
}

/**
 * Validate and apply a model/director-proposed state patch.
 */
export function validateAndApplyPatch(
  def: MysteryDefinition,
  state: PlaythroughState,
  patch: StatePatch,
  nowIso: string = new Date().toISOString()
): PatchValidation {
  const rejected: string[] = [];
  const applied: StatePatch = {};
  const evidenceAdded: string[] = [];

  let locationId = state.locationId;
  let evidenceIds = [...state.evidenceIds];
  let flags = { ...state.flags };
  let visited = new Set(state.visitedLocationIds);
  let characterMemory = { ...state.characterMemory };
  let characterState = { ...state.characterState };
  let objectState = { ...state.objectState };
  let presented = [...state.presented];
  const notebook = [...state.notebook];
  let status = state.status;
  let endingId = state.endingId;

  const probe = (): PlaythroughState => ({
    ...state,
    locationId,
    evidenceIds,
    flags,
    characterMemory,
    characterState,
    objectState,
    presented,
  });

  if (patch.setLocationId) {
    if (legalExit(def, probe(), locationId, patch.setLocationId)) {
      locationId = patch.setLocationId;
      applied.setLocationId = patch.setLocationId;
      visited.add(locationId);
    } else {
      rejected.push(
        `Illegal move to "${patch.setLocationId}" from "${state.locationId}"`
      );
    }
  }

  if (patch.setFlags) {
    flags = mergeFlags(flags, patch.setFlags);
    applied.setFlags = patch.setFlags;
  }

  if (patch.addEvidenceIds?.length) {
    const added: string[] = [];
    for (const id of patch.addEvidenceIds) {
      if (evidenceIds.includes(id)) continue;
      if (evidenceDiscoverableHere(def, probe(), id)) {
        evidenceIds.push(id);
        added.push(id);
        evidenceAdded.push(id);
        const os = objectState[id];
        if (os) {
          objectState = {
            ...objectState,
            [id]: { ...os, stage: "taken" },
          };
        }
      } else {
        // second chance via inspectable that reveals it with requirements met
        const loc = locationById(def, locationId);
        const viaInspect = loc?.inspectables.some(
          (insp) =>
            inspectRequirementsMet(
              probe(),
              insp.onInspect.requiresFlags,
              insp.onInspect.requiresEvidenceIds
            ) &&
            flagsMatch(flags, insp.hiddenUntilFlags) &&
            !(insp.objectId && objectState[insp.objectId]?.locked) &&
            insp.onInspect.revealsEvidenceIds?.includes(id)
        );
        if (viaInspect) {
          evidenceIds.push(id);
          added.push(id);
          evidenceAdded.push(id);
        } else {
          rejected.push(`Cannot obtain evidence "${id}" here`);
        }
      }
    }
    if (added.length) applied.addEvidenceIds = added;
  }

  if (patch.presented?.length) {
    const ok: { evidenceId: string; characterId: string }[] = [];
    for (const p of patch.presented) {
      if (!evidenceIds.includes(p.evidenceId)) {
        rejected.push(`Cannot present missing evidence "${p.evidenceId}"`);
        continue;
      }
      const ch = characterState[p.characterId];
      if (!ch?.available || ch.willingness === "fled") {
        rejected.push(`Cannot present to unavailable "${p.characterId}"`);
        continue;
      }
      // must be at same location
      if (ch.locationId !== locationId) {
        rejected.push(`Character "${p.characterId}" not here`);
        continue;
      }
      presented.push({
        evidenceId: p.evidenceId,
        characterId: p.characterId,
        turn: state.turnCount + 1,
      });
      ok.push(p);
    }
    if (ok.length) applied.presented = ok;
  }

  if (patch.talkToCharacterId) {
    const cid = patch.talkToCharacterId;
    const cs = characterState[cid];
    if (cs && cs.locationId === locationId && cs.available) {
      characterState = {
        ...characterState,
        [cid]: { ...cs, timesTalked: cs.timesTalked + 1 },
      };
      applied.talkToCharacterId = cid;
    }
  }

  if (patch.revealBeats?.length) {
    const ok: { characterId: string; beatId: string }[] = [];
    for (const rb of patch.revealBeats) {
      if (canRevealBeat(def, probe(), rb.characterId, rb.beatId)) {
        const mem = characterMemory[rb.characterId] ?? {
          revealedBeatIds: [],
          summary: "",
          recentTurns: [],
        };
        if (!mem.revealedBeatIds.includes(rb.beatId)) {
          characterMemory = {
            ...characterMemory,
            [rb.characterId]: {
              ...mem,
              revealedBeatIds: [...mem.revealedBeatIds, rb.beatId],
            },
          };
        }
        ok.push(rb);
      } else {
        rejected.push(
          `Cannot reveal beat "${rb.beatId}" for "${rb.characterId}"`
        );
      }
    }
    if (ok.length) applied.revealBeats = ok;
  }

  if (patch.notebookAppend?.length) {
    applied.notebookAppend = patch.notebookAppend;
    for (const text of patch.notebookAppend) {
      notebook.push({
        id: `note_${notebook.length + 1}`,
        text,
        source: "auto",
        createdAt: nowIso,
      });
    }
  }

  if (patch.accuse && status === "active") {
    applied.accuse = patch.accuse;
    const score = scoreAccusation(def, patch.accuse);
    if (score === "success") {
      status = "solved";
      flags = mergeFlags(flags, { case_solved: true });
      endingId = def.endings.find((e) => e.when === "success")?.id;
    } else if (score === "partial") {
      status = "solved";
      flags = mergeFlags(flags, { case_solved: true });
      endingId = def.endings.find((e) => e.when === "partial")?.id;
    } else {
      status = "failed";
      endingId = def.endings.find((e) => e.when === "failure")?.id;
    }
  } else if (patch.accuse) {
    rejected.push("Cannot accuse when case is not active");
  }

  const nextState: PlaythroughState = {
    ...state,
    status,
    locationId,
    evidenceIds,
    flags,
    notebook,
    characterMemory,
    characterState,
    objectState,
    presented,
    visitedLocationIds: [...visited],
    endingId,
    updatedAt: nowIso,
  };

  return { applied, rejected, nextState, evidenceAdded };
}

export function scoreAccusation(
  def: MysteryDefinition,
  accuse: NonNullable<StatePatch["accuse"]>
): "success" | "partial" | "failure" {
  const text = [
    accuse.summary,
    accuse.method ?? "",
    accuse.motive ?? "",
    ...(accuse.suspectIds ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const facts = def.solution.rubric.requiredFacts;
  if (!facts.length) {
    const guilty = def.solution.guiltyPartyIds.some(
      (id) =>
        text.includes(id.toLowerCase()) ||
        (accuse.suspectIds ?? []).includes(id)
    );
    return guilty ? "success" : "failure";
  }

  let hits = 0;
  for (const fact of facts) {
    const ok = fact.matchHints.some((h) => text.includes(h.toLowerCase()));
    if (ok) hits += 1;
  }

  if (hits === facts.length) return "success";
  if (def.solution.rubric.partialCredit && hits > 0) return "partial";
  return "failure";
}
