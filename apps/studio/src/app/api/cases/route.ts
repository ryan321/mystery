import { NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentRoot } from "@/lib/content";

/** Minimal valid scaffold for a new mystery. */
function template(id: string): string {
  const def = {
    $schema: "../definition.schema.json",
    schemaVersion: "1.5",
    id,
    contentVersion: "0.1.0",
    meta: {
      title: id
        .split("-")
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" "),
      premise: "One sentence: the body, the setting, the hook.",
      tone: "atmospheric, fair-play",
    },
    player: {
      displayName: "The Investigator",
      role: "Why are they here?",
      startingLocationId: "first-room",
      startingEvidenceIds: [],
      startingKnowledge: "What the player knows at turn zero.",
      objective: "Identify the killer and be ready to accuse.",
    },
    openingNarration: "The scene as the story opens.",
    locations: [
      {
        id: "first-room",
        name: "The First Room",
        description: "Describe it — name the exits so they are perceivable.",
        knownAtStart: true,
        map: { x: 0, y: 0 },
        exits: [],
        inspectables: [],
        charactersPresent: [],
      },
    ],
    characters: [],
    relationships: [],
    evidence: [],
    flags: [],
    solution: {
      summary: "Who did it, how, and why — the sealed truth.",
      guiltyPartyIds: [],
      rubric: {
        successPolicy: "identity_plus_one",
        requiredFacts: [],
      },
    },
    endings: [
      {
        id: "success",
        when: "success",
        kind: "solved",
        title: "Solved",
        templateNotes:
          "How the world rebalances when the truth lands — diegetic, not magical.",
      },
      {
        id: "failure_wrong",
        when: "failure",
        kind: "wrong_accusation",
        title: "The wrong name",
        templateNotes: "What the lie costs when the wrong person is named.",
      },
    ],
    beats: [],
  };
  return JSON.stringify(def, null, 2) + "\n";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) {
    return NextResponse.json(
      { error: "id must be kebab-case (a-z, 0-9, dashes)" },
      { status: 400 }
    );
  }
  const dir = join(contentRoot, id);
  if (existsSync(dir)) {
    return NextResponse.json({ error: "case already exists" }, { status: 409 });
  }
  mkdirSync(join(dir, "portraits"), { recursive: true });
  writeFileSync(join(dir, "definition.json"), template(id));
  return NextResponse.json({ dir: id }, { status: 201 });
}
