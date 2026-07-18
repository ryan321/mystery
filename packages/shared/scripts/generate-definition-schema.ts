// Emit JSON Schema for MysteryDefinition (editor autocomplete for definition.json)
// Run: pnpm --filter @mystery/shared schema

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MysteryDefinitionSchema } from "../src/definition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const outPath = join(repoRoot, "content/cases/definition.schema.json");

const generated = zodToJsonSchema(MysteryDefinitionSchema, {
  name: "MysteryDefinition",
  $refStrategy: "none",
});

const defs = (generated as { definitions?: Record<string, unknown> })
  .definitions;
const main =
  defs && typeof defs.MysteryDefinition === "object"
    ? (defs.MysteryDefinition as Record<string, unknown>)
    : (generated as Record<string, unknown>);

const otherDefs =
  defs &&
  Object.fromEntries(
    Object.entries(defs).filter(([k]) => k !== "MysteryDefinition")
  );

const root = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://mystery.local/schemas/case-definition.json",
  title: "Mystery Case Definition",
  description:
    "Authored mystery kit for the Mystery platform. See docs/CASE_AUTHORING.md. Generated from packages/shared Zod schemas — run `pnpm --filter @mystery/shared schema` to regenerate.",
  ...main,
  ...(otherDefs && Object.keys(otherDefs).length
    ? { definitions: otherDefs }
    : {}),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(root, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
