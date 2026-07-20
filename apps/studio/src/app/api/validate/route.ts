import { NextResponse } from "next/server";
import { parseMysteryDefinition } from "@mystery/shared";

function zodErrors(err: unknown): string[] {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (
      err as { issues: { path: (string | number)[]; message: string }[] }
    ).issues;
    return issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  }
  return [err instanceof Error ? err.message : String(err)];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  try {
    parseMysteryDefinition(JSON.parse(String(body.text ?? "")));
    return NextResponse.json({ valid: true, errors: [] });
  } catch (err) {
    return NextResponse.json({ valid: false, errors: zodErrors(err) });
  }
}
