import type { DirectorOutput } from "@mystery/shared";

/**
 * Offline / fallback director: keyword intents from free text + context pack.
 */
export function heuristicDirector(args: {
  contextPack: unknown;
  playerInput: string;
}): DirectorOutput {
  const input = args.playerInput.toLowerCase();
  const pack = args.contextPack as {
    location?: {
      exits?: { toLocationId: string; label: string }[];
      visibleInspectables?: { id: string; name: string }[];
      presentCharacters?: ({ id: string; name: string } | null)[];
    };
    evidenceHeld?: { id: string; name: string }[];
    cast?: { id: string; name: string }[];
  };

  const intents: DirectorOutput["intents"] = [];
  let focusCharacterId: string | undefined;

  const accuseLike =
    /\b(accuse|i know who|killer is|murdered by|did it|it was|is the killer|is guilty|committed (the )?murder|i charge|responsible for)\b/i.test(
      args.playerInput
    );

  if (accuseLike) {
    const suspectIds: string[] = [];
    const cast =
      pack.cast ??
      (pack.location?.presentCharacters ?? []).filter(Boolean).map((c) => ({
        id: c!.id,
        name: c!.name,
      }));
    for (const ch of cast) {
      const name = ch.name.toLowerCase();
      const parts = name.split(/\s+/);
      const last = parts[parts.length - 1] ?? "";
      if (
        input.includes(name) ||
        input.includes(ch.id.replace(/-/g, " ")) ||
        (last.length > 2 && input.includes(last))
      ) {
        if (!suspectIds.includes(ch.id)) suspectIds.push(ch.id);
      }
    }
    // Blackwood-specific fallbacks if cast missing
    if (/\bvale\b/i.test(args.playerInput) && !suspectIds.includes("vale"))
      suspectIds.push("vale");
    if (
      /\bhenshaw\b/i.test(args.playerInput) &&
      !suspectIds.includes("henshaw")
    )
      suspectIds.push("henshaw");
    if (
      /\bmrs\.?\s*blackwood\b/i.test(args.playerInput) &&
      !suspectIds.includes("mrs-blackwood")
    )
      suspectIds.push("mrs-blackwood");
    if (/\bclara\b/i.test(args.playerInput) && !suspectIds.includes("clara"))
      suspectIds.push("clara");

    intents.push({
      type: "accuse",
      summary: args.playerInput,
      suspectIds,
    });
    if (suspectIds[0]) focusCharacterId = suspectIds[0];
    return { intents, reasoning: "heuristic accuse", focusCharacterId };
  }

  // physical assault (shove / push / knock down)
  if (
    /\b(push|shove|hit|punch|kick|grab|tackle|strike|slap)\b/.test(input) ||
    /\bknock\s+(him|her|them|down)\b/.test(input) ||
    /\bout of (the |my )?way\b/.test(input) ||
    /\bonto the (ground|floor)\b/.test(input)
  ) {
    for (const ch of pack.location?.presentCharacters ?? []) {
      if (!ch) continue;
      const name = ch.name.toLowerCase();
      const last = name.split(/\s+/).pop() ?? "";
      if (
        input.includes(name) ||
        input.includes(ch.id.replace(/-/g, " ")) ||
        (last.length > 2 && input.includes(last)) ||
        /\b(him|her|them|doctor)\b/.test(input)
      ) {
        intents.push({
          type: "assault",
          characterId: ch.id,
          manner: /\bground\b|\bfloor\b|\bknock\b/.test(input)
            ? "knock_down"
            : /\bgrab\b/.test(input)
              ? "grab"
              : "shove",
        });
        focusCharacterId = ch.id;
        return { intents, reasoning: "heuristic assault", focusCharacterId };
      }
    }
  }

  // present evidence
  for (const e of pack.evidenceHeld ?? []) {
    if (input.includes(e.name.toLowerCase()) || input.includes(e.id)) {
      for (const ch of pack.location?.presentCharacters ?? []) {
        if (!ch) continue;
        const last = ch.name.toLowerCase().split(/\s+/).pop() ?? "";
        if (input.includes(ch.name.toLowerCase()) || input.includes(last)) {
          intents.push({
            type: "present",
            evidenceId: e.id,
            characterId: ch.id,
          });
          focusCharacterId = ch.id;
        }
      }
    }
  }

  // move
  for (const exit of pack.location?.exits ?? []) {
    const label = exit.label.toLowerCase();
    const dest = exit.toLocationId.replace(/-/g, " ");
    if (
      input.includes(dest) ||
      input.includes(label) ||
      (input.includes("library") && exit.toLocationId === "library") ||
      (input.includes("conservatory") &&
        exit.toLocationId === "conservatory") ||
      ((input.includes("hall") || input.includes("entrance")) &&
        exit.toLocationId === "entrance-hall")
    ) {
      intents.push({
        type: "move",
        toLocationId: exit.toLocationId,
        exitHint: exit.label,
      });
      break;
    }
  }

  // inspect
  type Hit = { id: string; name: string; score: number };
  const hits: Hit[] = [];
  for (const insp of pack.location?.visibleInspectables ?? []) {
    let score = 0;
    const name = insp.name.toLowerCase();
    if (input.includes(name)) score += 10;
    if (input.includes("vase") && insp.id.includes("vase")) score += 8;
    if (input.includes("drawer") && insp.id.includes("drawer")) score += 12;
    if (input.includes("letter") && insp.id.includes("drawer")) score += 10;
    if (
      input.includes("key") &&
      (input.includes("drawer") || input.includes("desk")) &&
      insp.id.includes("drawer")
    )
      score += 14;
    else if (
      input.includes("key") &&
      (insp.id.includes("ash") || insp.id.includes("hearth")) &&
      !input.includes("drawer")
    )
      score += 8;
    if (input.includes("ash") && insp.id.includes("ash")) score += 8;
    if (input.includes("hearth") && insp.id.includes("hearth")) score += 8;
    if (input.includes("clock") && insp.id.includes("clock")) score += 8;
    if (input.includes("ledger") && insp.id.includes("ledger")) score += 8;
    if (input.includes("floor") && insp.id.includes("vase")) score += 3;
    if (score > 0) hits.push({ id: insp.id, name: insp.name, score });
  }
  hits.sort((a, b) => b.score - a.score);
  if (hits[0]) {
    intents.push({
      type: input.includes("use") || input.includes("key") ? "use" : "inspect",
      inspectableId: hits[0].id,
      targetHint: hits[0].name,
    });
  }

  // talk
  for (const ch of pack.location?.presentCharacters ?? []) {
    if (!ch) continue;
    const last = ch.name.toLowerCase().split(/\s+/).pop() ?? "";
    if (
      input.includes(ch.name.toLowerCase()) ||
      input.includes(last) ||
      (last === "henshaw" && input.includes("butler"))
    ) {
      intents.push({
        type: "talk",
        characterId: ch.id,
        characterHint: ch.name,
      });
      focusCharacterId = ch.id;
    }
  }

  if (/\blook\b|\bwhere am i\b|survey|examine room/i.test(input)) {
    intents.push({ type: "look" });
  }

  if (
    /\binventory\b|\bwhat (do )?i (have|carry|holding)\b|\bwhat('s| is) in my (pocket|bag|hand)\b|\bcheck (my )?pockets\b/i.test(
      input
    )
  ) {
    intents.push({ type: "inventory" });
  }

  if (intents.length === 0) {
    intents.push({ type: "other", note: "unparsed" });
  }

  return {
    intents,
    focusCharacterId,
    reasoning: "heuristic-director",
  };
}
