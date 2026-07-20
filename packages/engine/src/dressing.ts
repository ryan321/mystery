/**
 * Scene dressing — improvised world texture with enforced consistency.
 *
 * The performer may enrich the world ("a crystal chandelier hangs over the
 * stairwell") and reports durable details as structured proposals. The
 * engine validates and stores them anchored to their target (location /
 * character / item); facts about the same `subject` form a cumulative
 * thread. Every future ContextPack for that target replays the threads, so
 * the model sees what it already established before it speaks — the same
 * prevention mechanism the rest of the pipeline uses.
 *
 * Rules:
 *  - Append-only: facts accumulate, never replace (no drift-by-overwrite).
 *  - Closed world: only ids that exist in the definition.
 *  - Capped: per turn, per subject, per target, per fact length.
 *  - Dressing is timeless texture — events/changes belong to the engine.
 */
import type {
  DressingFact,
  DressingProposal,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { ensureObjectState } from "./inventory.js";

export const DRESSING_LIMITS = {
  perTurn: 5,
  detailChars: 160,
  factsPerSubject: 6,
  subjectsPerTarget: 12,
} as const;

export function slugifySubject(raw: string | undefined): string {
  const slug = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "scene";
}

function normalizeDetail(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function threadFacts(
  existing: DressingFact[],
  subject: string
): DressingFact[] {
  return existing.filter((f) => f.subject === subject);
}

export type DressingApplyResult = {
  state: PlaythroughState;
  accepted: DressingFact[];
  rejected: string[];
};

/**
 * Validate and persist performer dressing proposals.
 * Invalid or over-cap entries are dropped with a reason (never an error —
 * the narration already happened; persistence is best-effort by design).
 */
export function applyDressing(
  def: MysteryDefinition,
  state: PlaythroughState,
  proposals: DressingProposal[]
): DressingApplyResult {
  const rejected: string[] = [];
  const accepted: DressingFact[] = [];
  let next = state;

  const limited = proposals.slice(0, DRESSING_LIMITS.perTurn);
  for (const dropped of proposals.slice(DRESSING_LIMITS.perTurn)) {
    rejected.push(`per-turn cap: ${dropped.scope}/${dropped.id}`);
  }

  for (const p of limited) {
    const detail = normalizeDetail(p.detail);
    if (!detail) {
      rejected.push(`empty detail: ${p.scope}/${p.id}`);
      continue;
    }
    if (detail.length > DRESSING_LIMITS.detailChars) {
      rejected.push(
        `detail too long (${detail.length} > ${DRESSING_LIMITS.detailChars}): ${p.scope}/${p.id}`
      );
      continue;
    }
    const subject = slugifySubject(p.subject);

    const existing = existingDressing(def, next, p.scope, p.id);
    if (existing === undefined) {
      rejected.push(`unknown ${p.scope}: ${p.id}`);
      continue;
    }

    const thread = threadFacts(existing, subject);
    if (
      thread.some(
        (f) => f.detail.toLowerCase() === detail.toLowerCase()
      )
    ) {
      continue; // exact duplicate — silently idempotent
    }
    if (thread.length >= DRESSING_LIMITS.factsPerSubject) {
      rejected.push(`subject full (${subject}): ${p.scope}/${p.id}`);
      continue;
    }
    const subjects = new Set(existing.map((f) => f.subject));
    if (
      !subjects.has(subject) &&
      subjects.size >= DRESSING_LIMITS.subjectsPerTarget
    ) {
      rejected.push(`target full: ${p.scope}/${p.id}`);
      continue;
    }

    const fact: DressingFact = {
      subject,
      detail,
      turn: state.turnCount,
    };
    next = withDressing(next, p.scope, p.id, [...existing, fact]);
    accepted.push(fact);
  }

  return { state: next, accepted, rejected };
}

/** Current dressing for a target; undefined when the id is not in the world. */
function existingDressing(
  def: MysteryDefinition,
  state: PlaythroughState,
  scope: DressingProposal["scope"],
  id: string
): DressingFact[] | undefined {
  if (scope === "location") {
    if (!def.locations.some((l) => l.id === id)) return undefined;
    return state.locationState[id]?.dressing ?? [];
  }
  if (scope === "character") {
    if (!def.characters.some((c) => c.id === id)) return undefined;
    return state.characterState[id]?.dressing ?? [];
  }
  // item: authored evidence or a known world object (containers etc.)
  if (
    !def.evidence.some((e) => e.id === id) &&
    !state.objectState[id]
  ) {
    return undefined;
  }
  return state.objectState[id]?.dressing ?? [];
}

function withDressing(
  state: PlaythroughState,
  scope: DressingProposal["scope"],
  id: string,
  dressing: DressingFact[]
): PlaythroughState {
  if (scope === "location") {
    const ls = state.locationState[id] ?? {
      accessible: true,
      descriptionAppend: "",
      exitOpen: {},
      known: false,
      dressing: [],
    };
    return {
      ...state,
      locationState: {
        ...state.locationState,
        [id]: { ...ls, dressing },
      },
    };
  }
  if (scope === "character") {
    const cs = state.characterState[id];
    if (!cs) return state;
    return {
      ...state,
      characterState: {
        ...state.characterState,
        [id]: { ...cs, dressing },
      },
    };
  }
  const os = ensureObjectState(state, id);
  return {
    ...state,
    objectState: {
      ...state.objectState,
      [id]: { ...os, dressing },
    },
  };
}

/**
 * Render threads for prompt injection: one line per subject, facts joined
 * in establishment order. ("chandelier: crystal, over the stairwell; ~500
 * pieces, a few cloudy with age")
 */
export function dressingLines(facts: DressingFact[]): string[] {
  const bySubject = new Map<string, DressingFact[]>();
  for (const f of facts) {
    const list = bySubject.get(f.subject) ?? [];
    list.push(f);
    bySubject.set(f.subject, list);
  }
  const lines: string[] = [];
  for (const [subject, list] of bySubject) {
    const ordered = [...list].sort((a, b) => a.turn - b.turn);
    lines.push(`${subject}: ${ordered.map((f) => f.detail).join("; ")}`);
  }
  return lines;
}
