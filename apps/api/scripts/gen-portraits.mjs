#!/usr/bin/env node
/**
 * Generate missing cast portraits in the case's authored artStyle,
 * using an existing portrait as a style-reference image.
 *
 *   pnpm gen-portraits --case blackwood-inheritance
 *     [--only ashworth,garrick] [--model google/gemini-2.5-flash-image]
 *     [--ref portraits/henshaw.jpg] [--force]
 *
 * Writes portraits/<characterId>.jpg and sets the character's portrait
 * field in definition.json.
 */
import { config as loadEnv } from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(repoRoot, ".env") });

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) {
    const k = process.argv[i].slice(2);
    args[k] =
      i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")
        ? process.argv[++i]
        : "true";
  }
}
if (!args.case) {
  console.error("Usage: pnpm gen-portraits --case <caseId> [--only a,b] [--model m] [--ref path] [--force]");
  process.exit(1);
}
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY missing from .env");

const MODEL = args.model ?? "google/gemini-2.5-flash-image";
const caseDir = join(repoRoot, "content/cases", args.case);
const defPath = join(caseDir, "definition.json");
const def = JSON.parse(readFileSync(defPath, "utf8"));
const only = args.only ? new Set(args.only.split(",").map((s) => s.trim())) : null;

const refPath = join(caseDir, args.ref ?? "portraits/henshaw.jpg");
const refB64 = readFileSync(refPath).toString("base64");
mkdirSync(join(caseDir, "portraits"), { recursive: true });

/**
 * Subject descriptions — physical only, derived from the authored cast.
 * Plate = the brass nameplate text, matching the set's plain style.
 */
const SUBJECTS = {
  ashworth: {
    plate: "Mr. Ashworth",
    desc: "a junior barrister of about twenty-eight, good family; earnest, slightly stiff bearing; clean-shaven, careful grooming, dark hair; black frock coat, high wing collar, dark cravat",
  },
  garrick: {
    plate: "Garrick",
    desc: "a big broad-shouldered caretaker of about forty-five, formerly an army sergeant; weathered outdoor face, steady loyal eyes, short military-cut hair, strong jaw with stubble; heavy brown working coat over a collarless shirt, kerchief at the neck",
  },
  "meg-garrick": {
    plate: "Mrs. Garrick",
    desc: "the caretaker's wife, about forty, a farmer's daughter; capable careworn face, brittle guarded politeness, hair pinned back severely; plain dark wool dress, knitted shawl pinned at the breast",
  },
  poppy: {
    plate: "Poppy",
    desc: "a bright watchful girl of nine; curious open face, hair in ribboned braids; white pinafore over a dark wool dress",
  },
  aunt: {
    plate: "Mrs. Marsh",
    desc: "a dying gentlewoman of about seventy in a wheeled invalid chair, the carved chair-back just visible; gentle composed face with quietly calculating eyes; widow's black silk, white lace cap, dark shawl about thin shoulders",
  },
  constance: {
    plate: "Miss Marsh",
    desc: "a poor relation of about thirty-two, plain by circumstance rather than nature; soft tired intelligent eyes, hair dressed severely; modest dark high-necked dress, no jewelry",
  },
  crane: {
    plate: "Mr. Crane",
    desc: "a self-made Manchester businessman of about fifty-five, chapel-sober; heavy build, grey muttonchop whiskers, shrewd worried eyes; black broadcloth suit, waistcoat with watch chain",
  },
  "mrs-hollis": {
    plate: "Mrs. Hollis",
    desc: "a manor cook of about fifty-five; broad, kindly, capable face with flour-dusted forearms suggested; print work dress with rolled sleeves, white apron, white cook's cap",
  },
  dora: {
    plate: "Dora",
    desc: "a young housemaid of about nineteen from the village; quick quiet face, a touch nervous; black uniform dress with white apron and white maid's cap",
  },
};

function buildPrompt(plate, desc) {
  return `Create a new portrait in EXACTLY the same style as the attached reference painting — same artist's hand, same composition. Style contract: ${def.meta.artStyle}.
Reproduce faithfully from the reference: the same aged ornate dark-wood frame with carved corners, the same dark damask-papered wall behind the frame, the same candle glow at the right edge, the same small brass nameplate centered on the frame's bottom rail.
The brass nameplate must read exactly: "${plate}"
Subject of the painting (head-and-shoulders, Victorian 1890s England): ${desc}.
Square image, 1024x1024. No modern elements. No text anywhere except the nameplate.`;
}

async function generateOne(id, subject) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${refB64}` } },
            { type: "text", text: buildPrompt(subject.plate, subject.desc) },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  let url = msg.images?.[0]?.image_url?.url;
  if (!url && Array.isArray(msg.content)) {
    const part = msg.content.find((p) => p.type === "image_url");
    url = part?.image_url?.url;
  }
  if (!url?.startsWith("data:image/")) throw new Error(`no image in response (${JSON.stringify(msg).slice(0, 200)})`);
  const b64 = url.slice(url.indexOf(",") + 1);
  const tmp = join(caseDir, "portraits", `.${id}.tmp.png`);
  writeFileSync(tmp, Buffer.from(b64, "base64"));
  const out = join(caseDir, "portraits", `${id}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", tmp, "--out", out], { stdio: "ignore" });
  execFileSync("rm", [tmp]);
  return `portraits/${id}.jpg`;
}

const todo = def.characters.filter((c) => {
  if (only && !only.has(c.id)) return false;
  if (!(c.id in SUBJECTS)) return false;
  const file = join(caseDir, "portraits", `${c.id}.jpg`);
  return args.force === "true" || (!c.portrait && !existsSync(file)) || (only && only.has(c.id));
});
console.log(`Generating ${todo.length} portraits via ${MODEL}: ${todo.map((c) => c.id).join(", ")}`);

for (const c of todo) {
  const subject = SUBJECTS[c.id];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rel = await generateOne(c.id, subject);
      c.portrait = rel;
      console.log(`  ✔ ${c.id} → ${rel}`);
      break;
    } catch (err) {
      console.warn(`  ✘ ${c.id} attempt ${attempt}: ${err.message.slice(0, 200)}`);
      if (attempt === 2) console.error(`  giving up on ${c.id}`);
    }
  }
}

// Re-read before writing: generation takes minutes and the definition may
// have been edited meanwhile — patch ONLY the portrait fields.
const fresh = JSON.parse(readFileSync(defPath, "utf8"));
for (const c of todo) {
  if (!c.portrait) continue;
  const target = fresh.characters.find((f) => f.id === c.id);
  if (target) target.portrait = c.portrait;
}
writeFileSync(defPath, JSON.stringify(fresh, null, 2) + "\n");
console.log("definition.json portrait fields updated");
