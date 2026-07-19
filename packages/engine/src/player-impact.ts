import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { applyEffects } from "./effects.js";
import {
  applyDefaultAssaultConsequences,
  applyDefaultMisconductConsequences,
  assaultCaseHandled,
} from "./assault-default.js";

export { assaultCaseHandled };

export type PlayerImpactKind =
  | "assault"
  | "misconduct"
  | "provoke"
  | "trespass"
  | "hazard";

export type PlayerPushback =
  | "none"
  | "warn"
  | "eject"
  | "hold"
  | "restrain"
  | "harm";

export type PlayerImpactOpts = {
  kind: PlayerImpactKind;
  targetId?: string;
  manner?: string;
  misconductKind?: string;
  /** AI-suggested severity; engine may escalate. */
  pushback?: PlayerPushback;
  ejectToLocationId?: string;
  hazardId?: string;
  /** Player condition after hazard: shaken | bruised | injured */
  condition?: string;
  tag?: string;
  caseHandled: boolean;
};

function firstExitLocation(
  def: MysteryDefinition,
  state: PlaythroughState
): string | undefined {
  const loc = def.locations.find((l) => l.id === state.locationId);
  if (!loc?.exits?.length) return undefined;
  for (const ex of loc.exits) {
    if (ex.startsClosed) {
      const ls = state.locationState[loc.id];
      const key = `${loc.id}->${ex.toLocationId}`;
      if (ls?.exitOpen?.[key] === false) continue;
      if (ls?.exitOpen?.[key] !== true && ex.startsClosed) continue;
    }
    if (def.locations.some((l) => l.id === ex.toLocationId)) {
      return ex.toLocationId;
    }
  }
  return loc.exits[0]?.toLocationId;
}

function pressureKey(characterId: string): string {
  return `pressure_on_${characterId}`;
}

/**
 * Social / trespass escalation: annoying a bouncer, refusing to leave, etc.
 * Tracks per-character pressure flags and applies warn → eject → hold.
 */
export function applyDefaultSocialPushback(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: {
    kind: "provoke" | "trespass";
    targetId?: string;
    manner?: string;
    pushback?: PlayerPushback;
    ejectToLocationId?: string;
    caseHandled: boolean;
  }
): { state: PlaythroughState; justHappened: JustHappened[] } {
  if (opts.caseHandled || state.status !== "active") {
    return { state, justHappened: [] };
  }

  const targetId = opts.targetId;
  const targetName = targetId
    ? def.characters.find((c) => c.id === targetId)?.name ?? targetId
    : "someone in authority";
  const authority = def.player.authority ?? "civilian";
  const isOfficial =
    authority === "official" || authority === "professional";

  const key = targetId ? pressureKey(targetId) : "pressure_scene";
  const prev = Number(state.flags[key] ?? 0);
  const attempts = prev + 1;

  // Derive pushback if AI left it open
  let push: PlayerPushback = opts.pushback ?? "none";
  if (push === "none") {
    if (opts.kind === "trespass") {
      push = attempts >= 2 ? "eject" : "warn";
    } else {
      // provoke: 1 warn, 2 eject, 3+ hold
      if (attempts >= 3) push = isOfficial ? "warn" : "hold";
      else if (attempts >= 2) push = isOfficial ? "warn" : "eject";
      else push = "warn";
    }
  }

  // Officials get milder social pushback for mere annoyance
  if (isOfficial && push === "hold") push = "warn";
  if (isOfficial && push === "restrain") push = "eject";

  const effects: Effect[] = [
    { type: "set_game_flag", id: key, value: attempts },
    { type: "set_game_flag", id: "player_provoked", value: true },
    { type: "add_player_tag", tag: opts.kind === "trespass" ? "trespassing" : "provoking" },
  ];

  if (targetId) {
    effects.push(
      {
        type: "set_willingness",
        characterId: targetId,
        value: push === "warn" ? "guarded" : "hostile",
      },
      { type: "add_pressure", characterId: targetId, by: 1 }
    );
  }

  if (push === "warn") {
    effects.push({
      type: "set_player_threat",
      threat: "watched",
    });
    effects.push({
      type: "notebook_append",
      text: `${targetName} warned me. Pushing them further will cost me.`,
    });
  } else if (push === "eject") {
    const dest =
      (opts.ejectToLocationId &&
      def.locations.some((l) => l.id === opts.ejectToLocationId)
        ? opts.ejectToLocationId
        : undefined) ?? firstExitLocation(def, state);
    effects.push({
      type: "set_player_threat",
      threat: "threatened",
    });
    if (dest) {
      effects.push({
        type: "move_player",
        toLocationId: dest,
        text: `${targetName} removes you from the room. You are put out — not by choice.`,
      });
      if (targetId) {
        effects.push({
          type: "move_character",
          characterId: targetId,
          toLocationId: dest,
        });
      }
    }
    effects.push({
      type: "add_player_tag",
      tag: "ejected",
    });
    effects.push({
      type: "set_game_flag",
      id: `ejected_from_${state.locationId}`,
      value: true,
    });
    effects.push({
      type: "notebook_append",
      text: `I was thrown out / escorted away. The house (or staff) will not tolerate more of that.`,
    });
  } else if (push === "hold" || push === "restrain" || push === "harm") {
    effects.push({
      type: "set_player_threat",
      threat: push === "harm" ? "assaulted" : "threatened",
    });
    if (push === "harm") {
      effects.push({
        type: "harm_player",
        condition: "bruised",
        text: `Rough handling. The world answers your provocation with force.`,
      });
    } else {
      effects.push({
        type: "harm_player",
        condition: "shaken",
        text: `Hands on you. This is no longer a conversation.`,
      });
    }
    if (targetId) {
      effects.push({
        type: push === "restrain" ? "restrain_player" : "hold_player",
        byCharacterId: targetId,
        text:
          push === "restrain"
            ? `${targetName} restrains you. You are not free to leave on your terms.`
            : `${targetName} has you. Grip. You are held.`,
      });
    }
  }

  const applied = applyEffects(def, state, effects);
  const framing: JustHappened = {
    id: `social_pushback_${opts.kind}_${push}`,
    summary:
      push === "eject"
        ? `You are thrown out`
        : push === "hold" || push === "restrain"
          ? `You are seized for pushing too far`
          : push === "warn"
            ? `You are warned`
            : `The room turns on you`,
    narrationHints: [
      `WORLD PUSHBACK (universal social/trespass): kind=${opts.kind}; pushback=${push}; attempts=${attempts}; target=${targetName}; manner=${opts.manner ?? ""}; authority=${authority}.`,
      `Stage this as something that happens TO the player — not only dialogue.`,
      push === "eject"
        ? `They are removed from the space (force-escort). location.id is AFTER the eject.`
        : push === "hold" || push === "restrain"
          ? `player.status.control is not free. Stage grip/pin.`
          : `A clear warning lands. Further annoyance will escalate.`,
      `Do not invent off-map police unless the pack supports it.`,
    ].join(" "),
  };

  return {
    state: applied.state,
    justHappened: [framing, ...applied.justHappened],
  };
}

/**
 * Environment acts on the player: rickety pier, ice, open shaft, tide.
 * Prefers authored location.hazards; AI can still pass fall destination.
 */
export function applyDefaultHazard(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: {
    hazardId?: string;
    manner?: string;
    pushback?: PlayerPushback;
    fallToLocationId?: string;
    condition?: string;
    tag?: string;
    caseHandled: boolean;
  }
): { state: PlaythroughState; justHappened: JustHappened[] } {
  if (opts.caseHandled || state.status !== "active") {
    return { state, justHappened: [] };
  }

  const loc = def.locations.find((l) => l.id === state.locationId);
  const authored = opts.hazardId
    ? loc?.hazards?.find((h) => h.id === opts.hazardId)
    : loc?.hazards?.find((h) => h.trigger === "on_act" || h.trigger === "on_enter");

  if (authored?.once && state.flags[`hazard_${authored.id}`] === true) {
    return { state, justHappened: [] };
  }

  const severity = authored?.severity ?? "soak";
  let push: PlayerPushback = opts.pushback ?? "none";
  if (push === "none") {
    push =
      severity === "injure" ? "harm" : severity === "scare" ? "warn" : "eject";
  }

  const fallTo =
    (opts.fallToLocationId &&
    def.locations.some((l) => l.id === opts.fallToLocationId)
      ? opts.fallToLocationId
      : undefined) ??
    authored?.fallToLocationId ??
    firstExitLocation(def, state);

  const condition =
    opts.condition ??
    authored?.condition ??
    (push === "harm" ? "bruised" : push === "warn" ? "shaken" : "shaken");
  const tag = opts.tag ?? authored?.tag ?? (fallTo ? "soaked" : "shaken_up");
  const manner =
    opts.manner ??
    authored?.description ??
    "The environment turns on you.";

  const effects: Effect[] = [
    { type: "set_game_flag", id: "player_hazard", value: true },
    { type: "add_player_tag", tag },
  ];
  if (authored) {
    effects.push({
      type: "set_game_flag",
      id: `hazard_${authored.id}`,
      value: true,
    });
  }

  if (push === "warn") {
    effects.push({ type: "set_player_threat", threat: "watched" });
    effects.push({
      type: "harm_player",
      condition: "shaken",
      text: manner,
    });
  } else {
    effects.push({
      type: "set_player_threat",
      threat: push === "harm" ? "assaulted" : "threatened",
    });
    effects.push({
      type: "harm_player",
      condition:
        condition === "injured" || condition === "bruised" || condition === "shaken"
          ? condition
          : push === "harm"
            ? "bruised"
            : "shaken",
      text: manner,
    });
    if (fallTo && fallTo !== state.locationId) {
      effects.push({
        type: "move_player",
        toLocationId: fallTo,
        text: `${manner} You end up somewhere you did not mean to be.`,
      });
    }
  }

  const applied = applyEffects(def, state, effects);
  const destName =
    def.locations.find((l) => l.id === applied.state.locationId)?.name ??
    applied.state.locationId;
  const framing: JustHappened = {
    id: `hazard_${authored?.id ?? "env"}_${push}`,
    summary:
      fallTo && applied.state.locationId === fallTo
        ? `You fall — now at ${destName}`
        : `The place turns on you`,
    narrationHints: [
      `ENVIRONMENTAL HAZARD (universal): ${manner}`,
      `severity=${severity}; pushback=${push}; tag=${tag}; condition=${applied.state.playerStatus?.condition}.`,
      fallTo && applied.state.locationId === fallTo
        ? `Player was moved to ${destName}. Stage the fall, slip, plunge, or collapse in second person — wet cold wood, water, impact. This happens TO them.`
        : `Stage a near-miss or environmental scare that lands in the body.`,
      `Do not invent new rooms beyond the pack. location.id is authoritative after the event.`,
    ].join(" "),
  };

  return {
    state: applied.state,
    justHappened: [framing, ...applied.justHappened],
  };
}

/**
 * Fire authored on_enter hazards after the player moves.
 */
export function applyOnEnterHazards(
  def: MysteryDefinition,
  state: PlaythroughState
): { state: PlaythroughState; justHappened: JustHappened[] } {
  const loc = def.locations.find((l) => l.id === state.locationId);
  const hazards = (loc?.hazards ?? []).filter((h) => h.trigger === "on_enter");
  let current = state;
  const all: JustHappened[] = [];
  for (const h of hazards) {
    if (h.once && current.flags[`hazard_${h.id}`] === true) continue;
    const r = applyDefaultHazard(def, current, {
      hazardId: h.id,
      manner: h.description,
      fallToLocationId: h.fallToLocationId,
      condition: h.condition,
      tag: h.tag,
      caseHandled: false,
    });
    current = r.state;
    all.push(...r.justHappened);
  }
  return { state: current, justHappened: all };
}

/**
 * Single entry: apply plot-hits-player defaults for any impact kind.
 */
export function applyDefaultPlayerImpact(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: PlayerImpactOpts
): { state: PlaythroughState; justHappened: JustHappened[] } {
  if (opts.caseHandled || state.status !== "active") {
    return { state, justHappened: [] };
  }

  if (opts.kind === "assault") {
    if (!opts.targetId) return { state, justHappened: [] };
    // If AI asked for eject/warn on an "assault" mislabel, still do assault path
    // unless pushback is purely social — assault stays physical.
    return applyDefaultAssaultConsequences(def, state, {
      targetId: opts.targetId,
      manner: opts.manner ?? "assault",
      attempts: Number(state.flags.assault_attempts ?? 1),
      caseHandled: false,
    });
  }

  if (opts.kind === "misconduct") {
    return applyDefaultMisconductConsequences(def, state, {
      kind: opts.misconductKind ?? "disrupt",
      attempts: Number(state.flags.misconduct_attempts ?? 1),
      witnessId: opts.targetId,
      caseHandled: false,
    });
  }

  if (opts.kind === "provoke" || opts.kind === "trespass") {
    return applyDefaultSocialPushback(def, state, {
      kind: opts.kind,
      targetId: opts.targetId,
      manner: opts.manner,
      pushback: opts.pushback,
      ejectToLocationId: opts.ejectToLocationId,
      caseHandled: false,
    });
  }

  if (opts.kind === "hazard") {
    return applyDefaultHazard(def, state, {
      hazardId: opts.hazardId,
      manner: opts.manner,
      pushback: opts.pushback,
      fallToLocationId: opts.ejectToLocationId,
      condition: opts.condition,
      tag: opts.tag,
      caseHandled: false,
    });
  }

  return { state, justHappened: [] };
}
