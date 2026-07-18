import type {
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import { flagsMatch, mergeFlags } from "./flags.js";
import { canRevealBeat } from "./knowledge.js";
import {
  scoreAccusationDetailed,
  type AccusationResult,
} from "./accusation.js";
import { enterResolution } from "./resolve-case.js";
import { ensureObjectState, takeIntoInventory } from "./inventory.js";

export type { AccusationResult };
export {
  scoreAccusation,
  scoreAccusationDetailed,
  accusationNarrationHints,
} from "./accusation.js";

export type PatchValidation = {
  applied: StatePatch;
  rejected: string[];
  nextState: PlaythroughState;
  evidenceAdded: string[];
  accusation?: AccusationResult;
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

  // Key-in-hand (requiresEvidenceIds) opens the container regardless of locked bookkeeping.
  return insp.onInspect.revealsEvidenceIds?.includes(evidenceId) ?? false;
}

/**
 * When evidence is taken via an inspectable: unlock container objectId,
 * mark stages examined/taken.
 */
function applyInspectObjectEffects(
  def: MysteryDefinition,
  locationId: string,
  evidenceId: string,
  objectState: PlaythroughState["objectState"],
  state: PlaythroughState,
  preferredInspectableId?: string
): PlaythroughState["objectState"] {
  const loc = locationById(def, locationId);
  if (!loc) return objectState;
  let next = { ...objectState };

  const candidates = preferredInspectableId
    ? loc.inspectables.filter((i) => i.id === preferredInspectableId)
    : loc.inspectables.filter((i) =>
        i.onInspect.revealsEvidenceIds?.includes(evidenceId)
      );

  for (const insp of candidates) {
    if (
      !inspectRequirementsMet(
        state,
        insp.onInspect.requiresFlags,
        insp.onInspect.requiresEvidenceIds
      )
    ) {
      continue;
    }
    if (!flagsMatch(state.flags, insp.hiddenUntilFlags)) continue;

    if (insp.objectId) {
      const os = next[insp.objectId] ?? {
        stage: "visible" as const,
        locked: true,
        locationId,
      };
      next = {
        ...next,
        [insp.objectId]: {
          ...os,
          locked: false,
          stage: os.stage === "taken" ? "taken" : "examined",
          locationId: os.locationId ?? locationId,
        },
      };
    }
    for (const eid of insp.onInspect.revealsEvidenceIds ?? []) {
      if (eid === evidenceId || state.evidenceIds.includes(eid)) {
        const os = next[eid];
        if (os) {
          next = {
            ...next,
            [eid]: { ...os, stage: "taken" },
          };
        }
      }
    }
  }
  return next;
}

function inspRequirementsAllowLocked(
  insp: {
    objectId?: string;
    onInspect: {
      requiresFlags?: Record<string, unknown>;
      requiresEvidenceIds?: string[];
    };
  },
  _objectState: PlaythroughState["objectState"],
  state: PlaythroughState
): boolean {
  // If player holds required keys/tools, treat as openable even if locked flag still true
  return inspectRequirementsMet(
    state,
    insp.onInspect.requiresFlags,
    insp.onInspect.requiresEvidenceIds
  );
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
        added.push(id);
        evidenceAdded.push(id);
        // temp state for take
        let tmp: PlaythroughState = {
          ...probe(),
          evidenceIds,
          objectState,
        };
        tmp = takeIntoInventory(tmp, id);
        evidenceIds = tmp.evidenceIds;
        objectState = tmp.objectState;
        objectState = applyInspectObjectEffects(
          def,
          locationId,
          id,
          objectState,
          probe()
        );
      } else {
        const loc = locationById(def, locationId);
        const insp = loc?.inspectables.find(
          (i) =>
            inspectRequirementsMet(
              probe(),
              i.onInspect.requiresFlags,
              i.onInspect.requiresEvidenceIds
            ) &&
            flagsMatch(flags, i.hiddenUntilFlags) &&
            inspRequirementsAllowLocked(i, objectState, probe()) &&
            i.onInspect.revealsEvidenceIds?.includes(id)
        );
        if (insp) {
          added.push(id);
          evidenceAdded.push(id);
          let tmp: PlaythroughState = {
            ...probe(),
            evidenceIds,
            objectState,
          };
          tmp = takeIntoInventory(tmp, id);
          evidenceIds = tmp.evidenceIds;
          objectState = tmp.objectState;
          objectState = applyInspectObjectEffects(
            def,
            locationId,
            id,
            objectState,
            probe(),
            insp.id
          );
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

  if (patch.requestInventory) {
    applied.requestInventory = true;
  }

  if (patch.examineItemId) {
    const id = patch.examineItemId;
    if (!evidenceIds.includes(id)) {
      rejected.push(`Cannot examine item not in inventory: "${id}"`);
    } else {
      const os = ensureObjectState(
        { ...probe(), evidenceIds, objectState },
        id
      );
      objectState = {
        ...objectState,
        [id]: {
          ...os,
          timesExamined: os.timesExamined + 1,
          holder: "player",
          stage: "taken",
        },
      };
      applied.examineItemId = id;
    }
  }

  if (patch.useItemId) {
    const id = patch.useItemId;
    if (!evidenceIds.includes(id)) {
      rejected.push(`Cannot use item not in inventory: "${id}"`);
    } else {
      const os = ensureObjectState(
        { ...probe(), evidenceIds, objectState },
        id
      );
      objectState = {
        ...objectState,
        [id]: {
          ...os,
          timesUsed: os.timesUsed + 1,
          holder: "player",
          stage: "taken",
        },
      };
      applied.useItemId = id;
    }
  }

  if (patch.setItemFlags) {
    applied.setItemFlags = patch.setItemFlags;
    for (const [itemId, flagsMap] of Object.entries(patch.setItemFlags)) {
      if (!evidenceIds.includes(itemId) && !objectState[itemId]) continue;
      const os = ensureObjectState(
        { ...probe(), evidenceIds, objectState },
        itemId
      );
      objectState = {
        ...objectState,
        [itemId]: {
          ...os,
          flags: { ...os.flags, ...flagsMap },
        },
      };
    }
  }

  let accusation: AccusationResult | undefined;
  let resolution = state.resolution;
  let denouement = state.denouement;

  if (patch.accuse && status === "active") {
    applied.accuse = patch.accuse;
    const tempState: PlaythroughState = {
      ...state,
      flags,
      evidenceIds,
      presented,
      status,
    };
    accusation = scoreAccusationDetailed(def, tempState, patch.accuse);
    const score = accusation.score;

    let outcome: "success" | "partial" | "failure";
    let kind: string;
    if (score === "success") {
      outcome = "success";
      kind = accusation.path === "lucky" ? "lucky_solve" : "solved";
    } else if (score === "partial") {
      outcome = "partial";
      kind = "partial";
    } else {
      outcome = "failure";
      kind = "wrong_accusation";
    }

    const resolved = enterResolution(def, tempState, {
      outcome,
      kind,
      path: accusation.path,
    });
    status = resolved.state.status;
    endingId = resolved.state.endingId;
    flags = resolved.state.flags;
    resolution = resolved.state.resolution;
    denouement = resolved.state.denouement;
  } else if (patch.accuse && status === "denouement") {
    rejected.push("Case already judged — talk through the aftermath instead");
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
    resolution,
    denouement,
    updatedAt: nowIso,
  };

  return { applied, rejected, nextState, evidenceAdded, accusation };
}
