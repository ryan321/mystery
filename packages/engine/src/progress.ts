/**
 * Optional, spoiler-light progress for the player UI.
 * Engine-owned — never exposes solution, beat titles, or phase ids to the UI labels.
 */

import type {
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";

export type ProgressDepth =
  | "surface"
  | "deepening"
  | "closing"
  | "judgment"
  | "aftermath";

export type ProgressPulse = {
  id: string;
  /** Spoiler-light copy for toast */
  text: string;
  kind: "evidence" | "unlock" | "depth" | "judgment";
};

export type MysteryProgress = {
  /** Author default for this case (off if omitted). */
  caseMode: "off" | "subtle" | "full";
  depth: ProgressDepth;
  /** Human label — no phase ids e.g. "Deepening" */
  depthLabel: string;
  /**
   * Coarse structural progress 0–1 (phase + story beats + critical evidence).
   * Not "how correct your theory is."
   */
  fraction: number;
  /**
   * Spoiler-light "how far through" e.g. "About two-thirds through".
   * Prefer this for the player-facing meter.
   */
  throughLabel: string;
  /** Compact fraction cue e.g. "≈⅔" */
  throughCompact: string;
  /** How many critical clues held / total (for UI stats if full) */
  criticalHeld: number;
  criticalTotal: number;
  /** New unlocks this turn (empty on GET unless we pass events) */
  pulses: ProgressPulse[];
};

const DEPTH_LABEL: Record<ProgressDepth, string> = {
  surface: "Surface",
  deepening: "Deepening",
  closing: "Closing in",
  judgment: "Judgment",
  aftermath: "Aftermath",
};

/** Map fraction → plain language thirds (not a solve score). */
export function throughLabels(fraction: number): {
  throughLabel: string;
  throughCompact: string;
} {
  const f = Math.max(0, Math.min(1, fraction));
  if (f < 0.18) {
    return { throughLabel: "Just beginning", throughCompact: "≈⅙" };
  }
  if (f < 0.38) {
    return { throughLabel: "About a third through", throughCompact: "≈⅓" };
  }
  if (f < 0.55) {
    return { throughLabel: "About halfway", throughCompact: "≈½" };
  }
  if (f < 0.72) {
    return { throughLabel: "About two-thirds through", throughCompact: "≈⅔" };
  }
  if (f < 0.88) {
    return { throughLabel: "Near the end", throughCompact: "≈⅚" };
  }
  return { throughLabel: "At the close", throughCompact: "≈1" };
}

function phaseRank(def: MysteryDefinition, phaseId: string): number {
  const i = def.phases.findIndex((p) => p.id === phaseId);
  if (i < 0) return 0;
  return i;
}

function storyBeatIds(def: MysteryDefinition): string[] {
  return def.beats.filter((b) => b.once !== false).map((b) => b.id);
}

/**
 * Compute spoiler-light progress snapshot.
 * Pass previous state + justHappened/evidenceAdded to emit this-turn pulses.
 */
export function computeMysteryProgress(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts?: {
    previous?: PlaythroughState | null;
    justHappened?: JustHappened[];
    evidenceAdded?: string[];
  }
): MysteryProgress {
  const caseMode = def.meta.progressUi ?? "off";
  const critical = def.solution.criticalEvidenceIds ?? [];
  const criticalHeld = critical.filter((id) =>
    state.evidenceIds.includes(id)
  ).length;

  const onceBeats = storyBeatIds(def);
  const firedOnce = onceBeats.filter((id) =>
    state.firedBeatIds.includes(id)
  ).length;
  const beatRatio =
    onceBeats.length > 0 ? firedOnce / onceBeats.length : 0;
  const evidenceRatio =
    critical.length > 0 ? criticalHeld / critical.length : 0;

  const phases = def.phases.length || 1;
  const phaseFrac = phaseRank(def, state.phaseId) / Math.max(1, phases - 1);

  // Weighted coarse fraction (never a "solve %" — structural progress only)
  let fraction = Math.min(
    1,
    phaseFrac * 0.35 + beatRatio * 0.35 + evidenceRatio * 0.3
  );

  let depth: ProgressDepth = "surface";
  if (
    state.status === "denouement" ||
    state.status === "solved" ||
    state.status === "failed"
  ) {
    depth = "aftermath";
    fraction = 1;
  } else if (state.pendingAccusation || state.phaseId === "confrontation") {
    depth = "judgment";
    fraction = Math.max(fraction, 0.85);
  } else if (
    state.phaseId === "crisis" ||
    evidenceRatio >= 0.6 ||
    beatRatio >= 0.55 ||
    phaseFrac >= 0.65
  ) {
    depth = "closing";
    fraction = Math.max(fraction, 0.55);
  } else if (
    state.phaseId === "deepening" ||
    evidenceRatio > 0 ||
    beatRatio > 0.12 ||
    state.evidenceIds.length > 0
  ) {
    depth = "deepening";
    fraction = Math.max(fraction, 0.25);
  }

  const pulses = buildPulses(def, state, opts, depth);
  const frac = Math.round(fraction * 100) / 100;
  const { throughLabel, throughCompact } = throughLabels(frac);

  return {
    caseMode,
    depth,
    depthLabel: DEPTH_LABEL[depth],
    fraction: frac,
    throughLabel:
      depth === "aftermath" ? "Case resolved" : throughLabel,
    throughCompact: depth === "aftermath" ? "✓" : throughCompact,
    criticalHeld: critical.length ? criticalHeld : 0,
    criticalTotal: critical.length,
    pulses,
  };
}

function buildPulses(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts:
    | {
        previous?: PlaythroughState | null;
        justHappened?: JustHappened[];
        evidenceAdded?: string[];
      }
    | undefined,
  depth: ProgressDepth
): ProgressPulse[] {
  if (!opts) return [];
  const pulses: ProgressPulse[] = [];
  const critical = new Set(def.solution.criticalEvidenceIds ?? []);
  const prev = opts.previous;

  // Critical / any new evidence this turn
  for (const eid of opts.evidenceAdded ?? []) {
    if (critical.has(eid)) {
      pulses.push({
        id: `ev_crit_${eid}`,
        text: "A key piece finds you",
        kind: "evidence",
      });
    } else {
      pulses.push({
        id: `ev_${eid}`,
        text: "Something new is in hand",
        kind: "evidence",
      });
    }
  }

  // Phase advance (label only — never the phase id)
  if (prev && prev.phaseId !== state.phaseId) {
    const texts: Record<string, string> = {
      deepening: "The investigation deepens",
      crisis: "The case hardens",
      confrontation: "Judgment draws near",
      denouement: "The aftermath begins",
    };
    pulses.push({
      id: `depth_${state.phaseId}`,
      text: texts[state.phaseId] ?? "The case shifts",
      kind: "depth",
    });
  }

  // Story beats that unlocked something (spoiler-light)
  const jh = opts.justHappened ?? [];
  for (const j of jh) {
    if (!j.id) continue;
    // Skip noise already filtered elsewhere
    if (
      j.id.startsWith("phase") ||
      j.id.startsWith("player_") ||
      j.id.startsWith("assault") ||
      j.id.startsWith("world_to_player") ||
      j.id.startsWith("will_") ||
      j.id.startsWith("move_char_") ||
      j.id.startsWith("ev_") ||
      j.id === "moved" ||
      j.id === "evidence_gained"
    ) {
      continue;
    }
    // Major story beat titles often appear as justHappened id = beat id
    if (def.beats.some((b) => b.id === j.id && b.once !== false)) {
      pulses.push({
        id: `unlock_${j.id}`,
        text: "A door opens in the case",
        kind: "unlock",
      });
    }
  }

  if (
    state.pendingAccusation &&
    (!prev?.pendingAccusation ||
      prev.pendingAccusation.summary !== state.pendingAccusation.summary)
  ) {
    pulses.push({
      id: "judgment_pending",
      text: "You could commit to a formal accusation",
      kind: "judgment",
    });
  }

  if (
    (state.status === "denouement" ||
      state.status === "solved" ||
      state.status === "failed") &&
    prev &&
    prev.status === "active"
  ) {
    pulses.push({
      id: "judgment_rendered",
      text:
        depth === "aftermath"
          ? "Judgment is in"
          : "The case reaches a verdict",
      kind: "judgment",
    });
  }

  // Dedupe by kind preference (one evidence pulse max if many)
  const seen = new Set<string>();
  const out: ProgressPulse[] = [];
  let evidenceShown = 0;
  for (const p of pulses) {
    if (p.kind === "evidence") {
      if (evidenceShown >= 1) continue;
      evidenceShown += 1;
    }
    if (seen.has(p.kind + p.text)) continue;
    seen.add(p.kind + p.text);
    out.push(p);
  }
  return out.slice(0, 3);
}
