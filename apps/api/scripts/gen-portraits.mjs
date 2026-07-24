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

function resolveRefPath() {
  const candidates = [
    args.ref,
    join(caseDir, "portraits", "_style-ref.jpg"),
    join(caseDir, "portraits", "henshaw.jpg"),
    // Fall back to Blackwood style anchor when a new case has no ref yet.
    join(repoRoot, "content/cases/blackwood-inheritance/portraits/henshaw.jpg"),
  ].filter(Boolean);
  for (const c of candidates) {
    const p = c.startsWith("/") ? c : join(caseDir, c);
    if (existsSync(p)) return p;
    if (existsSync(c)) return c;
  }
  throw new Error(
    "No style-reference portrait found. Pass --ref path/to/portrait.jpg"
  );
}
const refPath = resolveRefPath();
const refB64 = readFileSync(refPath).toString("base64");
mkdirSync(join(caseDir, "portraits"), { recursive: true });
console.log(`Style reference: ${refPath}`);

/**
 * Subject descriptions — physical only, derived from the authored cast.
 * Plate = the brass nameplate text, matching the set's plain style.
 * Keyed by character id (works across cases).
 */
const SUBJECTS = {
  // ── Blackwood Inheritance ───────────────────────────────────────────
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
  // ── The Fall of Alan Thorne (Greymoor House) ────────────────────────
  "margaret-ashmere": {
    plate: "Mrs. Ashmere",
    desc: "an elderly gentlewoman of about seventy-two in a wheeled chair, carved chair-back just visible behind her shoulders; white hair under a lace cap, composed iron-quiet face, pale sharp eyes that miss little; black silk mourning dress, dark shawl, no jewelry but a wedding band",
  },
  "eliza-ashmere": {
    plate: "Miss Ashmere",
    desc: "a young woman of about twenty, orphaned granddaughter; pale careful face, dark hair simply dressed, eyes that flinch from contact yet stay intelligent; modest high-necked grey day dress, small brooch, no show of wealth",
  },
  "alan-thorne": {
    plate: "Mr. Thorne",
    desc: "a middle-aged estate manager of about forty-eight, charming respectable nephew; clean-shaven, well-groomed dark hair greying at temples, confident smiling mouth that does not reach the eyes; good country suit, waistcoat, neat cravat",
  },
  "helen-thorne": {
    plate: "Mrs. Thorne",
    desc: "a gentlewoman of about forty-five, the manager's wife; soft grief-ready face, kind eyes, hair neatly pinned; dark silk dress suitable for evening, small pearl earrings, loyal and unhardened",
  },
  "julian-thorne": {
    plate: "Julian Thorne",
    desc: "a young man of about twenty-three, arrogant heir; handsome bored face, carefully cut fair-dark hair, faintly sneering mouth; fashionable town suit a little too fine for the country, silk tie",
  },
  alden: {
    plate: "Alden",
    desc: "a manor butler of about sixty; spare upright bearing, silver hair, impassive trained face; black tailcoat, white tie, white waistcoat, the perfect servant",
  },
  "rose-nettles": {
    plate: "Rose",
    desc: "a young housemaid of about twenty-one from the village; open honest face, red-rimmed eyes, dark hair under a white cap; black uniform dress, white apron",
  },
  briggs: {
    plate: "Mrs. Briggs",
    desc: "a manor cook of about fifty-eight; broad capable face, warm but blunt, grey-streaked hair under a cook's cap; print dress, white apron, sleeves rolled as if interrupted at work",
  },
  rudge: {
    plate: "Constable Rudge",
    desc: "a local constable of about fifty, heavy-set, false hearty smile, shrewd small eyes; dark police tunic of the period, helmet strap suggestion, thick moustache",
  },
  "conrad-hale": {
    plate: "Mr. Hale",
    desc: "a city businessman of about fifty, recently betrayed partner; lean hard face, cold eyes, clean-shaven jaw set in anger; dark city suit, stiff collar, no country ease",
  },
  // ── Chain of Custody (freighter Erebus) ─────────────────────────────
  "mara-kade": {
    plate: "Mara Kade",
    desc: "a ship's security officer of about thirty-eight; composed, watchful face, level dark eyes that give nothing away, close-cropped practical hair; charcoal deep-space duty jumpsuit with a small security flash at the collar, sleeves pushed to the forearms; cold void-blue backdrop with a single amber warning key light",
  },
  "elias-venn": {
    plate: "Elias Venn",
    desc: "a ship's engineer of about forty-five; tired, thoughtful face lined around the eyes, grey-flecked stubble, hair going grey at the temples; worn engineer's coverall with tool loops and a faded ship patch; cold void-blue backdrop with a single amber warning key light",
  },
  // ── The Vanishing CEO (Aster Systems, 51st floor) ───────────────────
  serrano: {
    plate: "Daniel Serrano",
    desc: "a tech founder and CEO of about fifty, polished and commanding; olive-skinned Latino man, lean angular CLEAN-SHAVEN face (no beard) with a practiced easy smile that stops short of the eyes, silver-and-black hair swept back neatly, no glasses; a crisp charcoal suit over an open-collared white shirt, no tie, expensive minimalism; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  whitfield: {
    plate: "Simone Whitfield",
    desc: "a chief revenue officer of about forty-two, polished and relentless; sharp confident face, warm brown skin, dark hair pulled back sleek, assessing eyes; a tailored deep-navy blazer over a silk shell, one fine gold earring; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  cho: {
    plate: "Evelyn Cho",
    desc: "a chief financial officer of about forty-five, precise and composed; East Asian features, controlled intelligent face, black hair in a neat shoulder-length cut, rimless glasses; a crisp slate-grey suit jacket over a high-necked blouse; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  okafor: {
    plate: "Devin Okafor",
    desc: "a chief technology officer of about forty, blunt and literal; dark-skinned Black man, close-cropped hair, short beard, tired direct eyes behind matte-black glasses; a charcoal quarter-zip over a dark tee, no suit, engineer's plainness; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  danforth: {
    plate: "Claire Danforth",
    desc: "a general counsel of about fifty, careful and guarded; fair lined face, pale watchful eyes, ash-blond hair in a controlled bob; a severe dark-charcoal suit jacket over a white blouse, a thin silver necklace; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  brandt: {
    plate: "Owen Brandt",
    desc: "a chief operating officer of about fifty-two, genial and heavy-set; ruddy affable face faintly sweating, thinning grey hair, anxious eyes above a forced smile; a rumpled mid-blue dress shirt with a loosened tie and sleeves half-rolled; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  nadia: {
    plate: "Nadia Sokolov",
    desc: "an executive assistant of about thirty, devoted and shaken; pale Eastern-European features, red-rimmed grieving eyes, light-brown hair falling loose from a neat clip; a soft dark cardigan over a plain blouse, a small pendant; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
  delgado: {
    plate: "Frank Delgado",
    desc: "a night-security lead of about forty-five, steady and procedural; solid Latino man, weathered calm face, short greying hair, a neat moustache; a black security uniform polo with a small radio clip and a lanyard; cool charcoal-and-glass backdrop with distant city-light bokeh and a cold blue key light",
  },
};

/**
 * Portraits are full-bleed painted subjects only — NO picture frames,
 * mats, brass nameplates, or wall/candle "hanging portrait" chrome.
 * See docs/PORTRAITS.md.
 */
function buildPrompt(plate, desc) {
  const styleText = def.meta?.artStyle ?? "";
  const isPeriod = /Edwardian|Victorian|1890|1900|manor|country-house/i.test(styleText);
  // Present-day corporate/office cases must NOT be forced into period costume.
  const isModern = /corporate|executive|glass-tower|boardroom|present[- ]day|modern mystery/i.test(styleText);
  const era = isPeriod
    ? "Edwardian/Victorian England country-house society"
    : isModern
      ? "present-day corporate executive"
      : "period costume matching the style contract";
  const eraTail = isModern
    ? "Contemporary business attire; no period costume; no visible modern gadgets, phones, or logos."
    : "No modern elements.";
  return `Create a new character portrait in EXACTLY the same paint style as the attached reference — same artist's hand, brushwork, and palette. Style contract: ${def.meta.artStyle}.

CRITICAL composition rules (docs/PORTRAITS.md):
- Full-bleed painted portrait ONLY. The painted subject and backdrop touch all four edges of the image.
- NO wooden picture frame, NO ornate border, NO mat, NO brass nameplate, NO damask wall behind a frame, NO candle sitting beside a frame.
- Plain dark painted backdrop behind the figure (oil/portrait studio darkness), not a framed painting on a wall.
- Head-and-shoulders, facing viewer. Square 1024x1024.
- No text anywhere in the image (names live in the UI, not on the art).

Subject (${era}): ${desc}.
Character label for authoring only (do not paint this text): ${plate}.
${eraTail}`;
}

/** --deframe: edit an existing portrait — strip frame/wall/nameplate. */
async function deframeOne(id) {
  const file = join(caseDir, "portraits", `${id}.jpg`);
  const b64 = readFileSync(file).toString("base64");
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
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
            {
              type: "text",
              text: "Remove the wooden picture frame, the wall behind it, the candle, and the brass nameplate entirely. Output ONLY the oil painting itself — the painted canvas must touch all four edges of the image with NO border of any kind: no white mat, no margin, no frame, no vignette edge. The exact same person, pose, expression, clothing, brushwork, and candlelit palette, on the same plain dark painted backdrop. No text anywhere.",
            },
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
  if (!url?.startsWith("data:image/")) throw new Error(`no image in response`);
  const out64 = url.slice(url.indexOf(",") + 1);
  const tmp = join(caseDir, "portraits", `.${id}.tmp.png`);
  writeFileSync(tmp, Buffer.from(out64, "base64"));
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", tmp, "--out", file], { stdio: "ignore" });
  execFileSync("rm", [tmp]);
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

if (args.deframe === "true" || (args.deframe && args.deframe !== "false")) {
  const ids = (args.deframe === "true"
    ? def.characters.filter((c) => c.portrait).map((c) => c.id)
    : args.deframe.split(",").map((s) => s.trim())
  ).filter((id) => existsSync(join(caseDir, "portraits", `${id}.jpg`)));
  console.log(`Deframing ${ids.length} portraits via ${MODEL}: ${ids.join(", ")}`);
  for (const id of ids) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await deframeOne(id);
        console.log(`  ✔ ${id} deframed`);
        break;
      } catch (err) {
        console.warn(`  ✘ ${id} attempt ${attempt}: ${err.message.slice(0, 160)}`);
      }
    }
  }
  process.exit(0);
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
