import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { applyEffects } from "./effects.js";

export type AssaultDefaultOpts = {
  targetId: string;
  manner: string;
  attempts: number;
  /**
   * True when a case beat already applied physical consequences this turn
   * (hold, harm, named assault beat). Defaults are skipped.
   */
  caseHandled: boolean;
};

/**
 * Universal physical-force resolution when the player assaults someone.
 * Case beats always win; this only fills the gap so no mystery is "prose only."
 *
 * Authority (definition.player.authority):
 * - official / professional: first clash can rattle the target; you stay free
 *   briefly; repeated force still backfires.
 * - civilian / guest / unknown: force is real contact but you lose freedom
 *   (held → downed/restrained on repeat).
 */
export function applyDefaultAssaultConsequences(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: AssaultDefaultOpts
): { state: PlaythroughState; justHappened: JustHappened[] } {
  if (opts.caseHandled) {
    return { state, justHappened: [] };
  }
  if (state.status !== "active") {
    return { state, justHappened: [] };
  }

  const target = def.characters.find((c) => c.id === opts.targetId);
  const targetName = target?.name ?? opts.targetId;
  const authority = def.player.authority ?? "civilian";
  const isOfficial =
    authority === "official" || authority === "professional";
  const attempts = Math.max(1, opts.attempts);
  const manner = opts.manner || "assault";

  const effects: Effect[] = [
    {
      type: "set_willingness",
      characterId: opts.targetId,
      value: "hostile",
    },
    {
      type: "add_pressure",
      characterId: opts.targetId,
      by: 1,
    },
    {
      type: "set_game_flag",
      id: "player_assaulted_someone",
      value: true,
    },
    {
      type: "add_player_tag",
      tag: "used_force",
    },
  ];

  if (isOfficial && attempts === 1) {
    // Badge / hired pro: real shove, target rattled, player not seized yet
    effects.push(
      {
        type: "set_player_threat",
        threat: "watched",
      },
      {
        type: "set_stance",
        characterId: opts.targetId,
        value: "rattled",
      }
    );
  } else if (isOfficial && attempts >= 2) {
    // Even officials get grappled if they keep swinging
    effects.push(
      {
        type: "set_player_threat",
        threat: "threatened",
      },
      {
        type: "harm_player",
        condition: "bruised",
        text: `The struggle with ${targetName} turns against you. Real force meets real force.`,
      },
      {
        type: "hold_player",
        byCharacterId: opts.targetId,
        text: `${targetName} has a grip on you. You are held — not free to walk away clean.`,
      }
    );
  } else if (attempts === 1) {
    // Civilian / guest / patient: contact, then seized
    effects.push(
      {
        type: "set_player_threat",
        threat: "threatened",
      },
      {
        type: "harm_player",
        condition: "bruised",
        text: `You make real contact with ${targetName} (${manner}), but you do not own the fight. Hands close on you.`,
      },
      {
        type: "hold_player",
        byCharacterId: opts.targetId,
        text: `${targetName} (or someone with them) has you. Grip, weight, authority. You are held.`,
      }
    );
  } else {
    // Repeat force without case beats: escalate control
    effects.push(
      {
        type: "set_player_threat",
        threat: "assaulted",
      },
      {
        type: "harm_player",
        condition: "injured",
        text: `The second clash goes worse. Pain, floor, loss of leverage.`,
      },
      {
        type: "knock_down_player",
        byCharacterId: opts.targetId,
        text: `You are put on the floor. Conscious, but down.`,
      },
      {
        type: "restrain_player",
        byCharacterId: opts.targetId,
        text: `You are restrained — held down, pinned, or bound by circumstance. You cannot leave under your own power.`,
      }
    );
  }

  const applied = applyEffects(def, state, effects);

  const framing: JustHappened = {
    id: `assault_default_${opts.targetId}`,
    summary:
      applied.state.playerStatus?.control !== "free"
        ? `Force on ${targetName} — you are controlled`
        : `Force on ${targetName} — clash stands`,
    narrationHints: [
      `DEFAULT PHYSICAL RESOLUTION (no case-specific assault beat):`,
      `Player authority=${authority}; attempt #${attempts}; manner=${manner}; target=${targetName}.`,
      `Stage the player's force as REAL contact (shove/grab/strike) — not a polite conversation.`,
      applied.state.playerStatus?.control !== "free"
        ? `Player status.control is ${applied.state.playerStatus?.control} (controlledBy=${applied.state.playerStatus?.controlledBy ?? "unknown"}). They do NOT walk away. Stage grip, fall, or pin as something that happens TO them.`
        : `Player remains free for now (official/professional first clash). Target is hostile/rattled — not knocked out, not dead. Do not invent a knockout or free win.`,
      `Do NOT invent weapons, backup armies, or rooms. Stay closed-world.`,
      `Condition/threat already in player.status must show in the body of the prose.`,
    ].join(" "),
  };

  return {
    state: applied.state,
    justHappened: [framing, ...applied.justHappened],
  };
}

/** True if case beats already covered physical retaliation this turn. */
export function assaultCaseHandled(
  firedBeatIds: string[],
  justHappened: JustHappened[]
): boolean {
  if (
    firedBeatIds.some((id) =>
      /assault|retaliat|restraint|violence|seiz|grappl|chemical/i.test(id)
    )
  ) {
    return true;
  }
  return justHappened.some(
    (j) =>
      j.id.startsWith("player_control_") ||
      j.id.startsWith("player_harm_") ||
      j.id.startsWith("assault_default_")
  );
}
