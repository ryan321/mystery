import type {
  MysteryDefinition,
  ObjectRuntimeState,
  PlaythroughState,
} from "@mystery/shared";

export type InventoryItemView = {
  id: string;
  name: string;
  description: string;
  stage: ObjectRuntimeState["stage"];
  holder: string;
  condition: string;
  tags: string[];
  flags: Record<string, string | number | boolean>;
  timesExamined: number;
  timesUsed: number;
  redHerring?: boolean;
};

function defaultObjectState(
  partial?: Partial<ObjectRuntimeState>
): ObjectRuntimeState {
  return {
    stage: partial?.stage ?? "visible",
    locked: partial?.locked ?? false,
    locationId: partial?.locationId,
    holder: partial?.holder,
    condition: partial?.condition ?? "intact",
    tags: partial?.tags ?? [],
    flags: partial?.flags ?? {},
    timesExamined: partial?.timesExamined ?? 0,
    timesUsed: partial?.timesUsed ?? 0,
  };
}

/** Ensure objectState entry exists with full inventory fields. */
export function ensureObjectState(
  state: PlaythroughState,
  objectId: string,
  seed?: Partial<ObjectRuntimeState>
): ObjectRuntimeState {
  const existing = state.objectState[objectId];
  if (!existing) return defaultObjectState(seed);
  return {
    stage: existing.stage,
    locked: existing.locked,
    locationId: existing.locationId,
    holder: existing.holder,
    condition: existing.condition ?? "intact",
    tags: existing.tags ?? [],
    flags: existing.flags ?? {},
    timesExamined: existing.timesExamined ?? 0,
    timesUsed: existing.timesUsed ?? 0,
  };
}

/** Put item into player inventory (updates objectState + evidenceIds). */
export function takeIntoInventory(
  state: PlaythroughState,
  itemId: string
): PlaythroughState {
  const os = ensureObjectState(state, itemId, { stage: "taken" });
  const evidenceIds = state.evidenceIds.includes(itemId)
    ? state.evidenceIds
    : [...state.evidenceIds, itemId];
  return {
    ...state,
    evidenceIds,
    objectState: {
      ...state.objectState,
      [itemId]: {
        ...os,
        stage: "taken",
        holder: "player",
        locationId: undefined,
      },
    },
  };
}

/** Remove from player inventory (optional world location). */
export function removeFromInventory(
  state: PlaythroughState,
  itemId: string,
  opts?: {
    toLocationId?: string;
    stage?: ObjectRuntimeState["stage"];
    holder?: string;
  }
): PlaythroughState {
  const os = ensureObjectState(state, itemId);
  return {
    ...state,
    evidenceIds: state.evidenceIds.filter((id) => id !== itemId),
    objectState: {
      ...state.objectState,
      [itemId]: {
        ...os,
        stage: opts?.stage ?? "visible",
        holder: opts?.holder,
        locationId: opts?.toLocationId,
      },
    },
  };
}

export function listInventory(
  def: MysteryDefinition,
  state: PlaythroughState
): InventoryItemView[] {
  return state.evidenceIds.map((id) => {
    const meta = def.evidence.find((e) => e.id === id);
    const os = ensureObjectState(state, id, {
      stage: "taken",
      holder: "player",
    });
    return {
      id,
      name: meta?.name ?? id,
      description: meta?.description ?? "",
      stage: os.stage,
      holder: os.holder ?? "player",
      condition: os.condition,
      tags: os.tags,
      flags: os.flags,
      timesExamined: os.timesExamined,
      timesUsed: os.timesUsed,
      redHerring: meta?.redHerring,
    };
  });
}

/** Prose-friendly inventory summary for performer / justHappened. */
export function inventoryNarrationHints(
  def: MysteryDefinition,
  state: PlaythroughState
): string {
  const items = listInventory(def, state);
  if (!items.length) {
    return "Inventory is empty — the player carries nothing of note yet.";
  }
  const lines = items.map((i) => {
    const bits = [i.name];
    if (i.condition && i.condition !== "intact") bits.push(`(${i.condition})`);
    if (i.tags.length) bits.push(`[${i.tags.join(", ")}]`);
    if (Object.keys(i.flags).length) {
      bits.push(
        `{${Object.entries(i.flags)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}}`
      );
    }
    return `- ${bits.join(" ")}: ${i.description}`;
  });
  return [
    "Player inventory (engine-owned — list only what is here):",
    ...lines,
  ].join("\n");
}

export function isInInventory(
  state: PlaythroughState,
  itemId: string
): boolean {
  // evidenceIds is authoritative for "player holds this"
  return state.evidenceIds.includes(itemId);
}
