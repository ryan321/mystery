/**
 * First-class items & fixtures — one discovery path.
 *
 * Authored forms (either is fine at parse time):
 *   - container.contains + container.locked / unlockRequires  (preferred)
 *   - onInspect.revealsEvidenceIds + requiresEvidenceIds     (legacy alias)
 *
 * Runtime always reads through these helpers so the engine has a single model:
 * contents, locked, openable, readable, usableOn.
 */

import type {
  Condition,
  Effect,
  Inspectable,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { evaluateCondition } from "./conditions.js";
import { flagsMatch } from "./flags.js";

/** Evidence ids a fixture can yield on successful open/search. */
export function fixtureContents(insp: Inspectable): string[] {
  const fromContainer = insp.container?.contains ?? [];
  if (fromContainer.length) return fromContainer;
  return insp.onInspect.revealsEvidenceIds ?? [];
}

/** Whether this fixture is currently locked against the player. */
export function fixtureIsLocked(
  def: MysteryDefinition,
  state: PlaythroughState,
  insp: Inspectable
): boolean {
  if (insp.container) {
    if (!insp.container.locked) return false;
    if (insp.container.unlockRequires) {
      return !evaluateCondition(
        def,
        state,
        insp.container.unlockRequires as Condition
      );
    }
    // Locked with no unlock path — still openable if key list is held
    // (legacy requiresEvidenceIds).
    const keys = insp.onInspect.requiresEvidenceIds ?? [];
    if (keys.length && keys.every((id) => state.evidenceIds.includes(id))) {
      return false;
    }
    return true;
  }
  if (insp.objectId) {
    const os = state.objectState[insp.objectId];
    if (os?.locked === true) {
      const keys = insp.onInspect.requiresEvidenceIds ?? [];
      if (keys.length && keys.every((id) => state.evidenceIds.includes(id))) {
        return false;
      }
      return true;
    }
  }
  const keys = insp.onInspect.requiresEvidenceIds ?? [];
  if (keys.length && !keys.every((id) => state.evidenceIds.includes(id))) {
    return true; // needs a key the player doesn't have
  }
  return false;
}

/** Flags + key requirements for inspect (legacy + container). */
export function fixtureRequirementsMet(
  def: MysteryDefinition,
  state: PlaythroughState,
  insp: Inspectable
): boolean {
  if (!flagsMatch(state.flags, insp.hiddenUntilFlags)) return false;
  if (!flagsMatch(state.flags, insp.onInspect.requiresFlags)) return false;
  if (insp.container?.unlockRequires) {
    if (insp.container.locked) {
      return evaluateCondition(
        def,
        state,
        insp.container.unlockRequires as Condition
      );
    }
  }
  const keys = insp.onInspect.requiresEvidenceIds ?? [];
  if (keys.length && !keys.every((id) => state.evidenceIds.includes(id))) {
    return false;
  }
  return true;
}

/** Can the player currently open/search this fixture and take contents? */
export function fixtureCanOpen(
  def: MysteryDefinition,
  state: PlaythroughState,
  insp: Inspectable
): boolean {
  if (!fixtureRequirementsMet(def, state, insp)) return false;
  return !fixtureIsLocked(def, state, insp);
}

/** Does this fixture yield this evidence id (when openable)? */
export function fixtureYields(insp: Inspectable, evidenceId: string): boolean {
  return fixtureContents(insp).includes(evidenceId);
}

/** Readable body text for a held item, if authored. */
export function itemReadableText(
  def: MysteryDefinition,
  itemId: string
): string | undefined {
  return def.evidence.find((e) => e.id === itemId)?.readable?.text;
}

export type ItemUseMatch = {
  itemId: string;
  targetId: string;
  outcome: Effect[];
};

/**
 * Find a usableOn entry for a held item aimed at a world target
 * (fixture id, evidence id, or character id).
 */
export function matchItemUse(
  def: MysteryDefinition,
  state: PlaythroughState,
  itemId: string,
  targetId: string
): ItemUseMatch | null {
  if (!state.evidenceIds.includes(itemId)) return null;
  const item = def.evidence.find((e) => e.id === itemId);
  if (!item) return null;
  for (const u of item.usableOn ?? []) {
    if (u.targetId !== targetId) continue;
    if (u.requires && !evaluateCondition(def, state, u.requires as Condition)) {
      continue;
    }
    return { itemId, targetId, outcome: u.outcome ?? [] };
  }
  return null;
}

/**
 * Resolve a use target from a free-text hint at the current location
 * (inspectable name/id, held item, or present character).
 */
export function resolveUseTargetId(
  def: MysteryDefinition,
  state: PlaythroughState,
  hint?: string
): string | undefined {
  if (!hint?.trim()) return undefined;
  const h = hint.toLowerCase().trim();
  const loc = def.locations.find((l) => l.id === state.locationId);
  if (loc) {
    for (const insp of loc.inspectables) {
      if (
        insp.id === h ||
        insp.id.includes(h.replace(/\s+/g, "-")) ||
        insp.name.toLowerCase().includes(h)
      ) {
        return insp.id;
      }
    }
  }
  for (const e of def.evidence) {
    if (
      state.evidenceIds.includes(e.id) &&
      (e.id === h ||
        e.id.includes(h.replace(/\s+/g, "-")) ||
        e.name.toLowerCase().includes(h))
    ) {
      return e.id;
    }
  }
  for (const [cid, cs] of Object.entries(state.characterState)) {
    if (!cs.available || cs.locationId !== state.locationId) continue;
    const ch = def.characters.find((c) => c.id === cid);
    if (!ch) continue;
    if (
      ch.id === h ||
      ch.name.toLowerCase().includes(h) ||
      ch.id.includes(h.replace(/\s+/g, "-"))
    ) {
      return ch.id;
    }
  }
  return undefined;
}

/** All closed-world ids a usableOn target may reference. */
export function allWorldTargetIds(def: MysteryDefinition): Set<string> {
  const ids = new Set<string>();
  for (const e of def.evidence) ids.add(e.id);
  for (const c of def.characters) ids.add(c.id);
  for (const loc of def.locations) {
    ids.add(loc.id);
    for (const insp of loc.inspectables) {
      ids.add(insp.id);
      if (insp.objectId) ids.add(insp.objectId);
    }
  }
  return ids;
}
