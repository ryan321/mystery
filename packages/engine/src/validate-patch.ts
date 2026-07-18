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

function legalExit(
  def: MysteryDefinition,
  fromId: string,
  toId: string,
  flags: PlaythroughState["flags"]
): boolean {
  if (fromId === toId) return true;
  const from = locationById(def, fromId);
  if (!from) return false;
  return from.exits.some(
    (e) => e.toLocationId === toId && flagsMatch(flags, e.requiresFlags)
  );
}

function evidenceDiscoverableHere(
  def: MysteryDefinition,
  state: PlaythroughState,
  evidenceId: string
): boolean {
  const item = def.evidence.find((e) => e.id === evidenceId);
  if (!item) return false;
  if (state.evidenceIds.includes(evidenceId)) return false;

  // Starting evidence is fine if already held — already filtered
  if (!item.discoverableAt) {
    // abstract / awarded by flags only
    return true;
  }

  const { locationId, inspectableId } = item.discoverableAt;
  if (state.locationId !== locationId) return false;

  const loc = locationById(def, locationId);
  const insp = loc?.inspectables.find((i) => i.id === inspectableId);
  if (!insp) return false;

  if (!flagsMatch(state.flags, insp.onInspect.requiresFlags)) return false;
  if (!flagsMatch(state.flags, insp.hiddenUntilFlags)) return false;

  return insp.onInspect.revealsEvidenceIds?.includes(evidenceId) ?? false;
}

/**
 * Validate and apply a model-proposed state patch.
 * Illegal operations are dropped and recorded in `rejected`.
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
  const characterMemory = { ...state.characterMemory };
  const notebook = [...state.notebook];
  let status = state.status;

  // Special: possessing brass-key sets helper flag for desk drawer
  if (evidenceIds.includes("brass-key")) {
    flags = mergeFlags(flags, { has_brass_key: true });
  }

  if (patch.setLocationId) {
    if (legalExit(def, locationId, patch.setLocationId, flags)) {
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
    const known = new Set(def.flags.map((f) => f.id));
    // allow engine helper flags not in def
    known.add("has_brass_key");
    known.add("case_solved");
    const next: Record<string, (typeof flags)[string]> = {};
    for (const [k, v] of Object.entries(patch.setFlags)) {
      if (!known.has(k)) {
        rejected.push(`Unknown flag "${k}"`);
        continue;
      }
      next[k] = v;
    }
    if (Object.keys(next).length) {
      flags = mergeFlags(flags, next);
      applied.setFlags = next;
    }
  }

  // Re-check brass key after flag/evidence updates below
  if (patch.addEvidenceIds?.length) {
    const added: string[] = [];
    // Apply location-sensitive discovery against *current* location after move
    const probeState: PlaythroughState = {
      ...state,
      locationId,
      evidenceIds,
      flags,
    };
    for (const id of patch.addEvidenceIds) {
      if (evidenceIds.includes(id)) continue;
      if (evidenceDiscoverableHere(def, probeState, id)) {
        evidenceIds.push(id);
        added.push(id);
        evidenceAdded.push(id);
        if (id === "brass-key") {
          flags = mergeFlags(flags, { has_brass_key: true });
        }
      } else {
        // Allow if inspect effect at current location lists it and requires satisfied
        // Second chance: any inspectable at current location that reveals it
        const loc = locationById(def, locationId);
        const viaInspect = loc?.inspectables.some(
          (insp) =>
            flagsMatch(flags, insp.onInspect.requiresFlags) &&
            flagsMatch(flags, insp.hiddenUntilFlags) &&
            insp.onInspect.revealsEvidenceIds?.includes(id)
        );
        if (viaInspect) {
          evidenceIds.push(id);
          added.push(id);
          evidenceAdded.push(id);
          if (id === "brass-key") {
            flags = mergeFlags(flags, { has_brass_key: true });
          }
        } else {
          rejected.push(`Cannot obtain evidence "${id}" here`);
        }
      }
    }
    if (added.length) applied.addEvidenceIds = added;
  }

  if (patch.revealBeats?.length) {
    const ok: { characterId: string; beatId: string }[] = [];
    const probe: PlaythroughState = {
      ...state,
      locationId,
      evidenceIds,
      flags,
      characterMemory,
    };
    for (const rb of patch.revealBeats) {
      if (canRevealBeat(def, probe, rb.characterId, rb.beatId)) {
        const mem = characterMemory[rb.characterId] ?? {
          revealedBeatIds: [],
          summary: "",
          recentTurns: [],
        };
        if (!mem.revealedBeatIds.includes(rb.beatId)) {
          characterMemory[rb.characterId] = {
            ...mem,
            revealedBeatIds: [...mem.revealedBeatIds, rb.beatId],
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
    } else if (score === "partial") {
      status = "solved";
      flags = mergeFlags(flags, { case_solved: true });
    } else {
      status = "failed";
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
    visitedLocationIds: [...visited],
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
