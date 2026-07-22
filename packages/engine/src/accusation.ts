import type {
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";

export type AccusationScore = "success" | "partial" | "failure";

/**
 * How the player closed (or failed) — independent of inventory gates.
 * Lucky = correct without critical evidence / work.
 */
export type AccusationPath =
  | "lucky"
  | "earned"
  | "partial"
  | "wrong";

export type AccusationResult = {
  score: AccusationScore;
  path: AccusationPath;
  identityCorrect: boolean;
  hitFactIds: string[];
  supportingHits: number;
  identityHits: number;
  /** Critical evidence held or presented to a guilty party */
  hadCriticalSupport: boolean;
  /** Human notes for performer / debug */
  notes: string[];
};

/** Free text of the accusation only — structured suspectIds are checked separately. */
function accuseFreeText(accuse: NonNullable<StatePatch["accuse"]>): string {
  return [accuse.summary, accuse.method ?? "", accuse.motive ?? ""]
    .join(" ")
    .toLowerCase();
}

/** Negation cues in the same sentence, before the mention. */
const NEG_BEFORE_RE =
  /(?:\bnot\b|n['’]t\b|\bnever\b|\bdoubt\w*\b|\bunless\b|\brule[sd]?\s+out\b|\bruling\s+out\b|\bcan['’]t\s+(?:be|have)\b|\bcouldn['’]t\b|\bwasn['’]t\b|\bisn['’]t\b|\bwouldn['’]t\b|\binstead\s+of\b|\bother\s+than\b|\bexcept\b|\bexonerat\w*|\bclear(?:s|ed)\b|\binnocen\w*)\s*$|(?:\bnot\b|n['’]t\b|\bnever\b|\bdoubt\w*\b|\bunless\b|\brule[sd]?\s+out\b|\bcan['’]t\s+(?:be|have)\b|\bcouldn['’]t\b|\bwasn['’]t\b|\bisn['’]t\b|\bwouldn['’]t\b|\binstead\s+of\b|\bother\s+than\b|\bexcept\b|\bexonerat\w*|\binnocen\w*)/i;

/** Negation cues in the same sentence, immediately after the mention. */
const NEG_AFTER_RE =
  /^\s*(?:is|was|are|were|being|seems?|looked)?\s*(?:not\b|n['’]t\b|innocent\b|cleared\b|blameless\b|couldn['’]t\b|didn['’]t\b|wouldn['’]t\b|can['’]t\s+have\b|had\s+nothing\b|would\s+never\b)/i;

/**
 * True when `term` appears in `text` at least once WITHOUT a negation in the
 * same sentence ("it wasn't Vale", "I don't think Vale did it",
 * "Vale is innocent" all fail; "Vale did it" passes).
 */
export function affirmativeMention(text: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  let idx = text.indexOf(t);
  while (idx !== -1) {
    const before = text.slice(Math.max(0, idx - 96), idx);
    const sentenceStart = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
      before.lastIndexOf(";")
    );
    const scopeBefore =
      sentenceStart >= 0 ? before.slice(sentenceStart + 1) : before;
    const after = text.slice(idx + t.length, idx + t.length + 48);
    const sentenceEnd = after.search(/[.!?;]/);
    const scopeAfter = sentenceEnd >= 0 ? after.slice(0, sentenceEnd) : after;
    if (!NEG_BEFORE_RE.test(scopeBefore) && !NEG_AFTER_RE.test(scopeAfter)) {
      return true;
    }
    idx = text.indexOf(t, idx + t.length);
  }
  return false;
}

function factMatches(
  text: string,
  hints: string[],
  extra?: string[]
): boolean {
  const all = [...hints, ...(extra ?? [])];
  return all.some((h) => h && affirmativeMention(text, h));
}

/**
 * Filter suspect ids to characters who can actually stand accused: they
 * must exist, and the victim is never a suspect — surname matching
 * ("arrest Miss Clara Blackwood") must not register the dead man as
 * accused. Exception: a victim who is in guiltyPartyIds (a staged death)
 * must still count.
 */
export function accusableSuspectIds(
  def: MysteryDefinition,
  ids: string[]
): string[] {
  const guilty = new Set(def.solution.guiltyPartyIds);
  return ids.filter((id) => {
    const ch = def.characters.find((c) => c.id === id);
    return !!ch && (ch.storyRole !== "victim" || guilty.has(id));
  });
}

/**
 * Which characters an accusation actually names.
 * Structured suspectIds win; free text (negation-aware) is the fallback.
 * Used for generic `accused_<id>` / `falsely_accused_<id>` flags.
 */
export function accusedCharacterIds(
  def: MysteryDefinition,
  accuse: NonNullable<StatePatch["accuse"]>
): string[] {
  const ids = new Set<string>(
    accusableSuspectIds(def, accuse.suspectIds ?? [])
  );
  if (ids.size > 0) return [...ids];

  const text = accuseFreeText(accuse);
  const guilty = new Set(def.solution.guiltyPartyIds);
  for (const c of def.characters) {
    if (c.storyRole === "victim" && !guilty.has(c.id)) continue;
    const last = c.name.toLowerCase().split(/\s+/).pop() ?? "";
    if (
      affirmativeMention(text, c.id) ||
      affirmativeMention(text, c.name) ||
      (last.length > 2 && affirmativeMention(text, last)) ||
      (c.introducedAs ? affirmativeMention(text, c.introducedAs) : false)
    ) {
      ids.add(c.id);
    }
  }
  return [...ids];
}

/**
 * Score a free-text accusation against sealed solution truth.
 *
 * **Never requires inventory / evidence discovery.** The player may
 * name the killer cold and still fully succeed if the words match.
 */
export function scoreAccusationDetailed(
  def: MysteryDefinition,
  state: PlaythroughState,
  accuse: NonNullable<StatePatch["accuse"]>
): AccusationResult {
  const text = accuseFreeText(accuse);
  const notes: string[] = [];
  const facts = def.solution.rubric.requiredFacts;
  const policy = def.solution.rubric.successPolicy ?? "identity_plus_one";
  const partialCredit = def.solution.rubric.partialCredit !== false;
  const guilty = def.solution.guiltyPartyIds;

  // Identity: structured suspectIds first; free text is negation-aware
  // ("it wasn't Vale" must not count as naming Vale).
  let identityCorrect = false;
  for (const gid of guilty) {
    if ((accuse.suspectIds ?? []).includes(gid)) {
      identityCorrect = true;
      break;
    }
    if (affirmativeMention(text, gid)) {
      identityCorrect = true;
      break;
    }
    const ch = def.characters.find((c) => c.id === gid);
    if (ch) {
      const parts = ch.name.toLowerCase().split(/\s+/);
      const last = parts[parts.length - 1] ?? "";
      if (
        affirmativeMention(text, ch.name) ||
        (last.length > 2 && affirmativeMention(text, last)) ||
        // Known-label accusations count: "the orderly did it" when the
        // player has never learned the name.
        (ch.introducedAs ? affirmativeMention(text, ch.introducedAs) : false)
      ) {
        identityCorrect = true;
        break;
      }
    }
  }

  const hitFactIds: string[] = [];
  let identityHits = 0;
  let supportingHits = 0;

  if (!facts.length) {
    // No authored facts: identity alone decides
    if (identityCorrect) {
      notes.push("identity match (no rubric facts)");
      const path = pathForSuccess(def, state, true);
      return {
        score: "success",
        path,
        identityCorrect: true,
        hitFactIds: ["identity"],
        supportingHits: 0,
        identityHits: 1,
        hadCriticalSupport: path === "earned",
        notes,
      };
    }
    return {
      score: "failure",
      path: "wrong",
      identityCorrect: false,
      hitFactIds: [],
      supportingHits: 0,
      identityHits: 0,
      hadCriticalSupport: false,
      notes: ["no identity match"],
    };
  }

  for (const fact of facts) {
    const role = fact.role ?? inferRole(fact.id);
    // For identity facts, also match guilty ids / names
    const extra =
      role === "identity"
        ? [
            ...guilty,
            ...guilty.flatMap((gid) => {
              const ch = def.characters.find((c) => c.id === gid);
              return ch ? [ch.name, ch.name.split(/\s+/).pop() ?? ""] : [];
            }),
          ]
        : [];
    if (factMatches(text, fact.matchHints, extra)) {
      hitFactIds.push(fact.id);
      if (role === "identity") identityHits += 1;
      else supportingHits += 1;
    }
  }

  // If no identity-role facts in rubric, use identityCorrect as identityHits
  const hasIdentityRole = facts.some(
    (f) => (f.role ?? inferRole(f.id)) === "identity"
  );
  if (!hasIdentityRole && identityCorrect) {
    identityHits = Math.max(identityHits, 1);
  }
  if (hasIdentityRole && identityHits > 0) {
    identityCorrect = true;
  }

  let score: AccusationScore = "failure";
  if (policy === "identity") {
    if (identityCorrect) score = "success";
    else if (partialCredit && (identityHits + supportingHits) > 0)
      score = "partial";
  } else if (policy === "all_facts") {
    if (hitFactIds.length === facts.length) score = "success";
    else if (partialCredit && hitFactIds.length > 0) score = "partial";
  } else {
    // identity_plus_one (default)
    if (identityCorrect && supportingHits >= 1) score = "success";
    else if (identityCorrect && facts.length === 1) score = "success";
    else if (partialCredit && (identityCorrect || hitFactIds.length > 0))
      score = "partial";
  }

  // Full fact match always success even under identity_plus_one
  if (hitFactIds.length === facts.length && facts.length > 0) {
    score = "success";
  }

  if (score === "failure") {
    return {
      score,
      path: "wrong",
      identityCorrect,
      hitFactIds,
      supportingHits,
      identityHits,
      hadCriticalSupport: false,
      notes: [
        `policy=${policy}`,
        `identity=${identityCorrect}`,
        `hits=${hitFactIds.join(",") || "none"}`,
      ],
    };
  }

  if (score === "partial") {
    return {
      score,
      path: "partial",
      identityCorrect,
      hitFactIds,
      supportingHits,
      identityHits,
      hadCriticalSupport: hasCriticalSupport(def, state),
      notes: [
        `partial hits=${hitFactIds.join(",")}`,
        identityCorrect ? "identity ok" : "identity missing",
      ],
    };
  }

  const path = pathForSuccess(def, state, identityCorrect);
  notes.push(
    path === "lucky"
      ? "correct without critical investigation evidence"
      : "correct with investigation support"
  );

  return {
    score: "success",
    path,
    identityCorrect,
    hitFactIds,
    supportingHits,
    identityHits,
    hadCriticalSupport: path === "earned",
    notes,
  };
}

function inferRole(factId: string): "identity" | "method" | "motive" | "supporting" {
  const id = factId.toLowerCase();
  if (
    id.includes("killer") ||
    id.includes("culprit") ||
    id.includes("who") ||
    id.includes("identity")
  )
    return "identity";
  if (id.includes("method") || id.includes("how") || id.includes("weapon"))
    return "method";
  if (id.includes("motive") || id.includes("why")) return "motive";
  return "supporting";
}

function hasCriticalSupport(
  def: MysteryDefinition,
  state: PlaythroughState
): boolean {
  const critical = def.solution.criticalEvidenceIds ?? [];
  if (critical.length === 0) {
    // Fallback: any non-starting evidence, or presented to guilty
    const guilty = new Set(def.solution.guiltyPartyIds);
    if (state.presented.some((p) => guilty.has(p.characterId))) return true;
    // If they have more evidence than starting set, treat as some work
    const start = new Set(def.player.startingEvidenceIds);
    return state.evidenceIds.some((id) => !start.has(id));
  }
  const held = new Set(state.evidenceIds);
  if (critical.some((id) => held.has(id))) return true;
  const guilty = new Set(def.solution.guiltyPartyIds);
  return state.presented.some(
    (p) => critical.includes(p.evidenceId) && guilty.has(p.characterId)
  );
}

function pathForSuccess(
  def: MysteryDefinition,
  state: PlaythroughState,
  _identityCorrect: boolean
): AccusationPath {
  return hasCriticalSupport(def, state) ? "earned" : "lucky";
}

/** Backward-compatible thin wrapper (path quality ignored if no state). */
export function scoreAccusation(
  def: MysteryDefinition,
  accuse: NonNullable<StatePatch["accuse"]>,
  state?: PlaythroughState
): AccusationScore {
  if (state) return scoreAccusationDetailed(def, state, accuse).score;
  // Minimal stand-in: inventory empty → lucky if success
  const stub = {
    evidenceIds: [] as string[],
    presented: [] as { evidenceId: string; characterId: string; turn: number }[],
    flags: {} as Record<string, string | number | boolean>,
    player: def.player,
  };
  return scoreAccusationDetailed(
    def,
    stub as unknown as PlaythroughState,
    accuse
  ).score;
}

/** Performer-facing hints after a scored accusation. */
export function accusationNarrationHints(
  def: MysteryDefinition,
  result: AccusationResult
): string {
  const guiltyNames = def.solution.guiltyPartyIds
    .map((id) => def.characters.find((c) => c.id === id)?.name ?? id)
    .join(", ");

  if (result.score === "failure") {
    return "The accusation does not hold. Do not force a false confession from the innocent.";
  }
  if (result.score === "partial") {
    return `Partial solve: they have part of the truth (${result.hitFactIds.join(", ") || "thin"}). Close with uncertainty — enough to hold pressure, not a clean confession of the full solution.`;
  }
  if (result.path === "lucky") {
    return `LUCKY / COLD accusation succeeds. The player did NOT need to find evidence first. The guilty party (${guiltyNames || "the culprit"}) breaks down and admits under the force of being correctly named — shock, collapse, confession. Do not invent that the player showed proof they never found. Truth can land without a full investigation.`;
  }
  return `Earned accusation succeeds. The investigation supports the charge. ${guiltyNames || "The culprit"} cracks; use the evidence trail the player actually built.`;
}
