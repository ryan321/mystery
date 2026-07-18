import type { TurnModelOutput } from "@mystery/shared";

type Exit = { toLocationId: string; label: string };
type Inspectable = {
  id: string;
  name: string;
  narrativeHints?: string;
  alreadyCollectedEvidenceIds?: string[];
};
type PresentChar = { id: string; name: string; shortBio?: string } | null;

/**
 * Offline narrator for local dev without OpenRouter.
 * Uses the context pack to apply closed-world inspect/move/talk heuristics.
 */
export function heuristicNarrate(args: {
  contextPack: {
    location: {
      id: string;
      name: string;
      description: string;
      visibleInspectables: Inspectable[];
      exits: Exit[];
      presentCharacters: PresentChar[];
    };
    evidenceHeld: { id: string; name: string; description: string }[];
  };
  playerInput: string;
}): TurnModelOutput {
  const input = args.playerInput.toLowerCase();
  const loc = args.contextPack.location;
  const patch: TurnModelOutput["patch"] = {};
  const dialogue: NonNullable<TurnModelOutput["dialogue"]> = [];

  // Accuse
  if (
    /\b(accuse|i know who|killer is|murdered by|did it)\b/i.test(
      args.playerInput
    )
  ) {
    const suspects: string[] = [];
    if (/\bvale\b/i.test(args.playerInput)) suspects.push("vale");
    if (/\bhenshaw\b/i.test(args.playerInput)) suspects.push("henshaw");
    if (/\bmrs\.?\s*blackwood\b/i.test(args.playerInput))
      suspects.push("mrs-blackwood");
    if (/\bclara\b/i.test(args.playerInput)) suspects.push("clara");
    patch.accuse = {
      summary: args.playerInput,
      suspectIds: suspects,
    };
    return {
      narration:
        "You lay out your theory for the record. The house seems to hold its breath as you commit to an answer.",
      dialogue: [],
      patch,
      intentGuess: "accuse",
    };
  }

  // Move — match exit labels / destination names
  for (const exit of loc.exits) {
    const label = exit.label.toLowerCase();
    const destToken = exit.toLocationId.replace(/-/g, " ");
    if (
      input.includes(destToken) ||
      input.includes(label) ||
      (input.includes("library") && exit.toLocationId === "library") ||
      (input.includes("conservatory") &&
        exit.toLocationId === "conservatory") ||
      (input.includes("entrance") && exit.toLocationId === "entrance-hall") ||
      (input.includes("hall") &&
        exit.toLocationId === "entrance-hall" &&
        loc.id !== "entrance-hall")
    ) {
      patch.setLocationId = exit.toLocationId;
      return {
        narration: `You leave ${loc.name} and go via ${exit.label}.`,
        dialogue: [],
        patch,
        intentGuess: "move",
      };
    }
  }

  // Inspect — score candidates so "key on the drawer" beats "hearth ash"
  type InspHit = { insp: Inspectable; score: number };
  const hits: InspHit[] = [];
  for (const insp of loc.visibleInspectables) {
    const name = insp.name.toLowerCase();
    const tokens = name.split(/\s+/).filter((t) => t.length > 3);
    let score = 0;
    if (input.includes(name)) score += 10;
    if (tokens.some((t) => input.includes(t))) score += 4;
    if (input.includes("vase") && insp.id.includes("vase")) score += 8;
    if (input.includes("stain") && name.includes("stain")) score += 8;
    if (input.includes("drawer") && insp.id.includes("drawer")) score += 12;
    if (input.includes("letter") && insp.id.includes("drawer")) score += 10;
    if (
      input.includes("key") &&
      (input.includes("drawer") || input.includes("desk")) &&
      insp.id.includes("drawer")
    ) {
      score += 14;
    } else if (
      input.includes("key") &&
      (insp.id.includes("ash") || insp.id.includes("hearth")) &&
      !input.includes("drawer")
    ) {
      score += 8;
    }
    if (input.includes("ash") && insp.id.includes("ash")) score += 8;
    if (input.includes("hearth") && insp.id.includes("hearth")) score += 8;
    if (input.includes("ledger") && insp.id.includes("ledger")) score += 8;
    if (input.includes("clock") && insp.id.includes("clock")) score += 8;
    if (input.includes("footprint") && insp.id.includes("vase")) score += 6;
    if (input.includes("floor") && insp.id.includes("vase")) score += 3;
    if (score > 0) hits.push({ insp, score });
  }
  hits.sort((a, b) => b.score - a.score);
  if (hits[0]) {
    const insp = hits[0].insp;
    const hints =
      insp.narrativeHints ??
      `You examine the ${insp.name} carefully.`;
    const add: string[] = [];
    const flags: Record<string, boolean> = {};
    if (insp.id === "broken-vase") {
      add.push("black-thread", "muddy-boot-print");
      flags.examined_vase = true;
      flags.found_boot_print = true;
    }
    if (insp.id === "hearth-ash") {
      add.push("brass-key");
    }
    if (insp.id === "desk-drawer") {
      add.push("vale-letter");
      flags.found_vale_letter = true;
    }

    const held = new Set(
      args.contextPack.evidenceHeld.map((e) => e.id)
    );
    const fresh = add.filter((id) => !held.has(id));
    if (fresh.length) patch.addEvidenceIds = fresh;
    if (Object.keys(flags).length) patch.setFlags = flags;

    return {
      narration: hints,
      dialogue: [],
      patch,
      intentGuess: "inspect",
    };
  }

  // Talk to present characters
  for (const ch of loc.presentCharacters) {
    if (!ch) continue;
    const name = ch.name.toLowerCase();
    const last = name.split(/\s+/).pop() ?? name;
    if (
      input.includes(name) ||
      input.includes(last) ||
      (last === "henshaw" && input.includes("butler")) ||
      (last === "vale" && input.includes("vale"))
    ) {
      const flags: Record<string, boolean> = {};
      if (ch.id === "henshaw") flags.henshaw_interviewed = true;
      if (ch.id === "vale" && /\bletter\b/i.test(args.playerInput)) {
        flags.vale_confronted = true;
      }
      if (Object.keys(flags).length) patch.setFlags = flags;

      let reply =
        ch.shortBio ||
        `${ch.name} regards you carefully, measuring how much to say.`;
      if (ch.id === "henshaw") {
        if (/\bwho\b|\belse\b|\bpresent\b|\bhouse\b/i.test(args.playerInput)) {
          reply =
            "Only Mrs. Blackwood, Miss Clara, Mr. Vale the guest, and myself were in the house.";
        } else if (/\bsee\b|\bheard\b|\bcrash\b|\beleven\b/i.test(args.playerInput)) {
          reply =
            "I heard the crash just after the clock struck eleven, sir. I was in the pantry. When I arrived, the east door stood open and Mr. Blackwood was at the top of the stairs.";
        } else {
          reply =
            "I am at your disposal, sir. Ask what you must — the household is… unsettled.";
        }
      }
      if (ch.id === "vale") {
        if (/\bletter\b/i.test(args.playerInput)) {
          reply =
            "Nothing. A business disagreement. I was in the conservatory all evening.";
        } else if (/\bwhere\b|\bwere you\b|\balibi\b/i.test(args.playerInput)) {
          reply = "Conservatory. All evening. Ask anyone.";
        } else {
          reply = "I fail to see how this concerns me. Tragic, of course.";
        }
      }

      dialogue.push({
        characterId: ch.id,
        characterName: ch.name,
        text: reply,
      });

      return {
        narration: `You speak with ${ch.name}.`,
        dialogue,
        patch,
        intentGuess: "talk",
      };
    }
  }

  // Default look around
  if (/\blook\b|\bwhere am i\b|\bexamine room\b|\bsurvey\b/i.test(input)) {
    return {
      narration: loc.description,
      dialogue: [],
      patch: {},
      intentGuess: "look",
    };
  }

  return {
    narration: `You consider your next move in ${loc.name}. (Heuristic narrator — set OPENROUTER_API_KEY for full AI.) People here: ${
      loc.presentCharacters
        .filter(Boolean)
        .map((c) => c!.name)
        .join(", ") || "no one obvious"
    }.`,
    dialogue: [],
    patch: {},
    intentGuess: "other",
  };
}
