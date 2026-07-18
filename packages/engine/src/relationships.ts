import type {
  MysteryDefinition,
  PlaythroughState,
  RelationshipEdge,
  RelationshipRuntimeState,
} from "@mystery/shared";

export function edgeRuntime(
  state: PlaythroughState,
  edgeId: string
): RelationshipRuntimeState | undefined {
  return state.relationshipState[edgeId];
}

export function definitionEdge(
  def: MysteryDefinition,
  edgeId: string
): RelationshipEdge | undefined {
  return def.relationships.find((r) => r.id === edgeId);
}

/** Find active edges matching endpoints and optional type. */
export function findRelationships(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: {
    fromId?: string;
    toId?: string;
    type?: string;
    activeOnly?: boolean;
  }
): { edge: RelationshipEdge; runtime: RelationshipRuntimeState }[] {
  const activeOnly = opts.activeOnly !== false;
  const out: { edge: RelationshipEdge; runtime: RelationshipRuntimeState }[] =
    [];
  for (const edge of def.relationships) {
    if (opts.fromId && edge.fromId !== opts.fromId) continue;
    if (opts.toId && edge.toId !== opts.toId) continue;
    if (opts.type && edge.type !== opts.type) continue;
    const runtime = state.relationshipState[edge.id] ?? {
      active: edge.startsActive,
      strength: edge.strength,
      knownToPlayer: edge.knownToPlayerByDefault,
      flags: {},
    };
    if (activeOnly && !runtime.active) continue;
    out.push({ edge, runtime });
  }
  return out;
}

export function hasRelationship(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: {
    fromId: string;
    toId: string;
    type?: string;
    minStrength?: number;
  }
): boolean {
  const found = findRelationships(def, state, {
    fromId: opts.fromId,
    toId: opts.toId,
    type: opts.type,
    activeOnly: true,
  });
  if (!found.length) return false;
  if (opts.minStrength != null) {
    return found.some((f) => f.runtime.strength >= opts.minStrength!);
  }
  return true;
}

/**
 * Edges the AI may use for *behavior* of a character (includes private).
 * Do not dump private notes into dialogue.
 */
export function behaviorEdgesForCharacter(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  label: string;
  strength: number;
  public: boolean;
  knownToPlayer: boolean;
  notes?: string;
  direction: "out" | "in";
}[] {
  const rows: ReturnType<typeof behaviorEdgesForCharacter> = [];
  for (const edge of def.relationships) {
    const involves =
      edge.fromId === characterId || edge.toId === characterId;
    if (!involves) continue;
    const runtime = state.relationshipState[edge.id];
    if (runtime && !runtime.active) continue;
    if (!runtime && !edge.startsActive) continue;
    const strength = runtime?.strength ?? edge.strength;
    const knownToPlayer =
      runtime?.knownToPlayer ?? edge.knownToPlayerByDefault;
    const label =
      runtime?.labelOverride ?? edge.label ?? edge.type;
    rows.push({
      id: edge.id,
      fromId: edge.fromId,
      toId: edge.toId,
      type: edge.type,
      label,
      strength,
      public: edge.public,
      knownToPlayer,
      notes: edge.notes,
      direction: edge.fromId === characterId ? "out" : "in",
    });
  }
  return rows;
}

/**
 * Social surface for the current scene: public edges, or known-to-player,
 * among present cast (+ focus). Safe to weave into narration lightly.
 */
export function sceneSocialSurface(
  def: MysteryDefinition,
  state: PlaythroughState,
  presentIds: string[]
): {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  label: string;
  strength: number;
}[] {
  const present = new Set(presentIds);
  const out: {
    id: string;
    fromId: string;
    toId: string;
    type: string;
    label: string;
    strength: number;
  }[] = [];
  for (const edge of def.relationships) {
    if (!present.has(edge.fromId) || !present.has(edge.toId)) continue;
    const runtime = state.relationshipState[edge.id];
    if (runtime && !runtime.active) continue;
    if (!runtime && !edge.startsActive) continue;
    const known =
      runtime?.knownToPlayer ?? edge.knownToPlayerByDefault;
    if (!edge.public && !known) continue;
    out.push({
      id: edge.id,
      fromId: edge.fromId,
      toId: edge.toId,
      type: edge.type,
      label: runtime?.labelOverride ?? edge.label ?? edge.type,
      strength: runtime?.strength ?? edge.strength,
    });
  }
  return out;
}
