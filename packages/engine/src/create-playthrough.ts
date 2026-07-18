import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { randomUUID } from "node:crypto";

export function createInitialPlaythrough(
  def: MysteryDefinition,
  id: string = randomUUID()
): PlaythroughState {
  const now = new Date().toISOString();
  const flags: PlaythroughState["flags"] = {};
  for (const f of def.flags) {
    if (f.defaultValue !== undefined) {
      flags[f.id] = f.defaultValue;
    }
  }

  return {
    id,
    caseId: def.id,
    contentVersion: def.contentVersion,
    status: "active",
    locationId: def.player.startingLocationId,
    evidenceIds: [...def.player.startingEvidenceIds],
    flags,
    notebook: [],
    characterMemory: {},
    visitedLocationIds: [def.player.startingLocationId],
    turnCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
