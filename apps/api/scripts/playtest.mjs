#!/usr/bin/env node
/**
 * AI playtester — an LLM agent plays a mystery through the real API
 * (fair play: it only sees what a player sees), then a critic grades
 * the run for FUN: pacing (too fast / too slow), content density
 * (enough to do), momentum, and leaks. Results land in playtests/
 * (gitignored).
 *
 *   pnpm playtest --case blackwood-inheritance
 *   pnpm playtest --case dead-air --persona speedrunner --max-turns 50
 *   pnpm playtest --case dead-air --persona all --runs 2
 *
 * Runs against a local dev API (default http://localhost:8787) using
 * the dev-header identity, so no account is needed and prod data is
 * never touched. Needs OPENROUTER_API_KEY in the root .env.
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(repoRoot, ".env") });

// ── Config ───────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const CASE_ID = args.case;
if (!CASE_ID) {
  console.error(
    "Usage: pnpm playtest --case <caseId> [--persona sleuth|speedrunner|wanderer|all] [--runs 1] [--max-turns 40] [--api http://localhost:8787]"
  );
  process.exit(1);
}
const API = args.api ?? "http://localhost:8787";
const MAX_TURNS = Number(args["max-turns"] ?? 40);
const RUNS = Number(args.runs ?? 1);
const PLAYER_MODEL =
  process.env.PLAYTEST_PLAYER_MODEL ??
  process.env.LLM_NARRATOR_MODEL ??
  "deepseek/deepseek-v4-pro";
const CRITIC_MODEL =
  process.env.PLAYTEST_CRITIC_MODEL ?? PLAYER_MODEL;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) {
  console.error("OPENROUTER_API_KEY missing from .env — the player agent needs it.");
  process.exit(1);
}

/** How many turns "feels right" per difficulty — the pacing yardstick. */
const PACING_BANDS = {
  easy: [12, 35],
  medium: [18, 45],
  hard: [25, 60],
};

// ── Personas ─────────────────────────────────────────────────────────

const PERSONAS = {
  sleuth: `You are a methodical armchair detective playing a text mystery.
You examine scenes carefully, question every character about means/motive/opportunity,
follow up on contradictions, and only accuse when you can name culprit, method, and motive.
You enjoy thoroughness but you do not repeat actions that yielded nothing.`,
  speedrunner: `You are an impatient player trying to solve the mystery as FAST as possible.
You skip flavor, chase only the strongest lead, and accuse as soon as you have a plausible
culprit — even on thin evidence. You hate wasting turns.`,
  wanderer: `You are a casual player who follows whatever seems interesting in the moment.
You chat with characters, poke at scenery, and drift between leads. You have a short
attention span: if nothing new or interesting has happened for a few turns, you get bored
and say so in your THOUGHT. You'll accuse eventually if the game nudges you there.`,
};

// ── Helpers ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val =
        i + 1 < argv.length && !argv[i + 1].startsWith("--")
          ? argv[++i]
          : "true";
      out[key] = val;
    }
  }
  return out;
}

async function llm(model, messages, { json = false } = {}) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENROUTER_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: json ? 0.2 : 0.8,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

const trim = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? "");

/** Parse the agent's ENGAGEMENT/THOUGHT/ACTION reply, leniently. */
function parsePlayerReply(text) {
  const get = (label) => {
    const m = text.match(new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, "s"));
    return m ? m[1].trim() : null;
  };
  const action = get("ACTION") ?? text.trim().split("\n").pop().trim();
  const engagement = Number((get("ENGAGEMENT") ?? "").match(/\d/)?.[0] ?? NaN);
  return {
    engagement: Number.isFinite(engagement) ? engagement : null,
    thought: get("THOUGHT") ?? "",
    action: action.slice(0, 400),
  };
}

// ── One playthrough ──────────────────────────────────────────────────

async function playOnce(personaName, def, stamp) {
  const persona = PERSONAS[personaName];
  const devHeaders = { "x-user-id": `playtest-${personaName}-${stamp}` };

  const start = await api("/v1/playthroughs", {
    method: "POST",
    body: { caseId: CASE_ID },
    headers: devHeaders,
  });
  const pid = start.playthrough.id;
  console.log(`  [${personaName}] playthrough ${pid.slice(0, 8)}`);

  const transcript = [];
  const locationsSeen = new Set();
  const engagements = [];
  let view = start.playerView ?? null;
  let status = start.playthrough.status;
  let lastNarration = start.openingNarration ?? "";
  let denouementTurns = 0;

  const briefingText = start.briefing
    ? JSON.stringify(start.briefing).slice(0, 1200)
    : "";

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (!view) {
      const got = await api(`/v1/playthroughs/${pid}`, { headers: devHeaders });
      view = got.playerView;
      status = got.playthrough.status;
    }
    if (status !== "active" && status !== "denouement") break;
    if (status === "denouement" && ++denouementTurns > 2) break;

    const scene = view?.scene ?? {};
    const sceneName = scene.name ?? scene.locationName;
    if (sceneName) locationsSeen.add(sceneName);

    const recent = transcript
      .slice(-10)
      .map((t) => `You: ${t.action}\nGame: ${trim(t.narration, 450)}`)
      .join("\n\n");

    const pending = view?.pendingAccusation
      ? `\nIMPORTANT: The game is asking you to CONFIRM your accusation of ${(view.pendingAccusation.suspectNames ?? []).join(", ")}. Reply with a clear confirmation ("Yes — I am certain.") or withdraw.`
      : "";

    const playerPrompt = `${persona}

CASE BRIEFING: ${briefingText}
YOUR OBJECTIVE: ${view?.player?.objective ?? "Solve the mystery."}
TURN ${turn} of at most ${MAX_TURNS}. Status: ${status}.
${status === "denouement" ? "The case has been judged — wrap up naturally." : ""}

CURRENT SCENE: ${sceneName ?? "?"} — ${trim(scene.description, 500)}
EXITS: ${(scene.exits ?? []).map((e) => e.label ?? e.description ?? e.toLocationName ?? "").join("; ")}
PRESENT: ${(view?.scene?.present ?? []).map((p) => p.name).join(", ") || "no one"}
YOU NOTICE: ${(scene.objects ?? []).map((o) => o.name).join(", ") || "nothing in particular"}
EVIDENCE HELD: ${(view?.inventory ?? []).map((i) => i.name).join(", ") || "none"}
KNOWN PLACES: ${[...locationsSeen].join(", ")}

RECENT PLAY:
${recent || "(the story has just begun)"}

LATEST FROM THE GAME:
${trim(lastNarration, 900)}
${pending}

Reply in EXACTLY this format (three lines):
ENGAGEMENT: <1-5, how fun/engaging this moment feels to you as a player>
THOUGHT: <one sentence of your reasoning as this persona>
ACTION: <what you say or do next, in plain natural language, 1-2 sentences. To accuse, say "I formally accuse NAME" and include method and motive.>`;

    const reply = parsePlayerReply(
      await llm(PLAYER_MODEL, [{ role: "user", content: playerPrompt }])
    );
    if (reply.engagement) engagements.push(reply.engagement);

    let result;
    try {
      result = await api(`/v1/playthroughs/${pid}/turns`, {
        method: "POST",
        body: { input: reply.action },
        headers: devHeaders,
      });
    } catch (err) {
      transcript.push({ turn, ...reply, narration: `⚠ turn failed: ${err.message}` });
      break;
    }

    const dialogue = (result.dialogue ?? [])
      .map((d) => `${d.speakerName ?? d.speakerId}: "${d.line ?? d.text ?? ""}"`)
      .join(" ");
    lastNarration = [result.narration, dialogue].filter(Boolean).join("\n");
    view = result.playerView;
    status = result.playthrough?.status ?? status;
    transcript.push({
      turn,
      engagement: reply.engagement,
      thought: reply.thought,
      action: reply.action,
      narration: lastNarration,
      evidenceAdded: (result.evidenceAdded ?? []).map((e) => e.name ?? e),
      status,
    });
    process.stdout.write(
      `    t${turn} [eng ${reply.engagement ?? "?"}] ${trim(reply.action, 70)}\n`
    );
  }

  // Final state for metrics.
  const final = await api(`/v1/playthroughs/${pid}`, { headers: devHeaders });
  return {
    pid,
    persona: personaName,
    transcript,
    locationsSeen: [...locationsSeen],
    engagements,
    finalStatus: final.playthrough.status,
    resolution: final.playthrough.resolution ?? final.playerView?.ending ?? null,
    inventory: (final.playerView?.inventory ?? []).map((i) => i.name),
  };
}

// ── Critic ───────────────────────────────────────────────────────────

async function critique(run, def, metrics) {
  const [minT, maxT] = PACING_BANDS[def.meta.difficulty ?? "medium"] ?? PACING_BANDS.medium;
  const transcriptText = run.transcript
    .map(
      (t) =>
        `T${t.turn} [engagement ${t.engagement ?? "?"}] PLAYER: ${t.action}\nGAME: ${trim(t.narration, 600)}`
    )
    .join("\n\n");

  const prompt = `You are a game design critic evaluating one AI playtest of an interactive text mystery.
Focus on FUN. The author cares most about: players finishing too fast, players taking too long or stalling,
and the mystery not having enough content (things to inspect, people worth questioning, leads to chase).

THE SEALED SOLUTION (the player never saw this): ${JSON.stringify(def.solution).slice(0, 1500)}
CASE: "${def.meta.title}" — difficulty ${def.meta.difficulty ?? "medium"}. Target pacing band: ${minT}-${maxT} turns to a confident accusation.
AUTHORED CONTENT TOTALS: ${def.locations.length} locations, ${def.characters.length} characters, ${def.evidence.length} evidence items.

RUN METRICS: ${JSON.stringify(metrics)}

FULL TRANSCRIPT:
${transcriptText}

Return STRICT JSON:
{
  "fun_score": 1-10,
  "pacing": {"verdict": "too_fast"|"in_band"|"too_slow"|"stalled", "turns_to_resolution": n|null, "notes": "..."},
  "content_density": {"verdict": "thin"|"adequate"|"rich", "ran_out_of_things_to_do": true|false, "notes": "..."},
  "momentum": {"dead_end_turns": n, "repetition": "none"|"some"|"heavy", "notes": "..."},
  "clue_trail": {"solvable_fairly": true|false, "notes": "..."},
  "leaks": {"found": true|false, "notes": "..."},
  "best_moment": "...",
  "worst_moment": "...",
  "author_recommendations": ["...", "..."]
}`;

  const raw = await llm(CRITIC_MODEL, [{ role: "user", content: prompt }], { json: true });
  try {
    return JSON.parse(raw);
  } catch {
    return { fun_score: null, parse_error: true, raw: raw.slice(0, 2000) };
  }
}

// ── Main ─────────────────────────────────────────────────────────────

const defPath = join(repoRoot, "content/cases", CASE_ID, "definition.json");
let def;
try {
  def = JSON.parse(readFileSync(defPath, "utf8"));
} catch {
  console.error(`Could not read ${defPath} — is the case id right?`);
  process.exit(1);
}

const personas =
  args.persona === "all"
    ? Object.keys(PERSONAS)
    : [args.persona ?? "sleuth"];
for (const p of personas) {
  if (!PERSONAS[p]) {
    console.error(`Unknown persona "${p}". Options: ${Object.keys(PERSONAS).join(", ")}, all`);
    process.exit(1);
  }
}

console.log(
  `Playtesting "${def.meta.title}" (${CASE_ID}) — personas: ${personas.join(", ")} × ${RUNS} run(s), max ${MAX_TURNS} turns, player model ${PLAYER_MODEL}`
);

for (const personaName of personas) {
  for (let runIdx = 1; runIdx <= RUNS; runIdx++) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    console.log(`\n▶ ${personaName} run ${runIdx}/${RUNS}`);
    const run = await playOnce(personaName, def, stamp);

    const avgEng = run.engagements.length
      ? (run.engagements.reduce((a, b) => a + b, 0) / run.engagements.length).toFixed(2)
      : null;
    const duplicateActions = run.transcript.length - new Set(run.transcript.map((t) => t.action.toLowerCase())).size;
    const metrics = {
      turns: run.transcript.length,
      finalStatus: run.finalStatus,
      resolution: run.resolution,
      evidenceCollected: run.inventory.length,
      evidenceTotal: def.evidence.length,
      locationsSeen: run.locationsSeen.length,
      locationsTotal: def.locations.length,
      engagementAvg: avgEng ? Number(avgEng) : null,
      engagementCurve: run.engagements,
      duplicateActions,
    };

    console.log(`  critic pass (${CRITIC_MODEL})…`);
    const evalResult = await critique(run, def, metrics);

    const dir = join(repoRoot, "playtests", CASE_ID, `${stamp}-${personaName}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "eval.json"),
      JSON.stringify({ case: CASE_ID, persona: personaName, playthroughId: run.pid, metrics, eval: evalResult }, null, 2)
    );
    writeFileSync(
      join(dir, "transcript.md"),
      [
        `# ${def.meta.title} — ${personaName} (${stamp})`,
        `Playthrough ${run.pid} · ${metrics.turns} turns · ${metrics.finalStatus} · engagement avg ${avgEng ?? "?"}`,
        "",
        ...run.transcript.map(
          (t) =>
            `## Turn ${t.turn} — engagement ${t.engagement ?? "?"}\n*${t.thought}*\n\n**> ${t.action}**\n\n${t.narration}\n${t.evidenceAdded?.length ? `\n✦ Evidence: ${t.evidenceAdded.join(", ")}` : ""}`
        ),
      ].join("\n")
    );

    console.log(
      `  ✔ ${metrics.turns} turns → ${metrics.finalStatus}; fun ${evalResult.fun_score ?? "?"}/10, pacing ${evalResult.pacing?.verdict ?? "?"}, content ${evalResult.content_density?.verdict ?? "?"}`
    );
    console.log(`  saved: playtests/${CASE_ID}/${stamp}-${personaName}/`);
  }
}
