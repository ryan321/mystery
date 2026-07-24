import { loadCase } from "@/lib/content";
import { conditionToText } from "@/lib/prose";
import type { DeductionNode, DeductionSupport } from "@mystery/shared";
import { SolutionGraph, type GNode, type GFact, type GEdge } from "./graph";

export const dynamic = "force-dynamic";

/**
 * Solution graph: the sealed inference DAG — how the case can be SOLVED.
 * Root leads (open at start) flow left→right through intermediate leads into
 * terminal nodes, which establish the rubric facts on the far right.
 *
 * Gold solid edge = `requires` (hard prerequisite gate).
 * Dim dashed edge = a `nodeId` support that is not also a requirement.
 * Green edge    = terminal → the rubric fact it establishes.
 * Node border: gold = root lead · red = identity terminal · green = other
 * terminal · faint dashed = orphan lead (feeds no other node).
 */

const GOLD = "#d9a441";
const RED = "#c96556";
const GREEN = "#7fb069";
const DIM = "#8b93a3";
const FAINT = "#5c6474";
const LINE = "#262b35";
const INK = "#e3e6ec";

type SupportView =
  | { kind: "evidence"; ref: string; label: string; critical: boolean }
  | { kind: "node"; ref: string; label: string; critical: false }
  | { kind: "knowledge"; ref: string; label: string; critical: false }
  | { kind: "condition"; ref: string; label: string; critical: false };

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ dir: string }>;
}) {
  const { dir } = await params;
  const loaded = loadCase(dir);
  if (!loaded?.valid) {
    return <p className="status-err">Fix schema errors in Edit JSON first.</p>;
  }
  const def = loaded.def;
  const nodes = def.deductions;

  if (nodes.length === 0) {
    return (
      <div className="section">
        <h3>Solution graph</h3>
        <p className="subtitle">
          This case has no <code>deductions</code> — no sealed inference graph
          to solve through. Add deduction nodes to model how the player reasons
          from evidence to the rubric facts.
        </p>
      </div>
    );
  }

  const evidenceName = new Map(def.evidence.map((e) => [e.id, e.name]));
  const critical = new Set(def.solution.criticalEvidenceIds);
  const facts = def.solution.rubric.requiredFacts;
  const factById = new Map(facts.map((f) => [f.id, f]));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const describeSupport = (s: DeductionSupport): SupportView => {
    if ("evidenceId" in s) {
      return {
        kind: "evidence",
        ref: s.evidenceId,
        label: evidenceName.get(s.evidenceId) ?? s.evidenceId,
        critical: critical.has(s.evidenceId),
      };
    }
    if ("nodeId" in s) {
      return { kind: "node", ref: s.nodeId, label: s.nodeId, critical: false };
    }
    if ("knowledge" in s) {
      const ref = `${s.knowledge.characterId}/${s.knowledge.beatId}`;
      return { kind: "knowledge", ref, label: ref, critical: false };
    }
    return {
      kind: "condition",
      ref: "condition",
      label: conditionToText(s.condition),
      critical: false,
    };
  };

  const isTerminal = (n: DeductionNode) => n.role !== "lead";

  // --- Layout: layered by longest `requires` chain (depth). --------------
  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, stack = new Set<string>()): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    const n = byId.get(id);
    if (!n || n.requires.length === 0 || stack.has(id)) {
      depthMemo.set(id, 0);
      return 0;
    }
    stack.add(id);
    const d = 1 + Math.max(...n.requires.map((r) => depthOf(r, stack)));
    stack.delete(id);
    depthMemo.set(id, d);
    return d;
  };
  for (const n of nodes) depthOf(n.id);
  const maxDepth = Math.max(...nodes.map((n) => depthMemo.get(n.id) ?? 0));
  const factCol = maxDepth + 1;

  const COL_W = 250;
  const ROW_H = 82;
  const NW = 196;
  const NH = 52;
  const MARGIN_X = 24;
  const TOP = 34;

  // Column buckets in definition order (deterministic).
  const columns: DeductionNode[][] = Array.from(
    { length: maxDepth + 1 },
    () => []
  );
  for (const n of nodes) columns[depthMemo.get(n.id) ?? 0].push(n);

  const center = new Map<string, { x: number; y: number }>();
  columns.forEach((col, d) => {
    col.forEach((n, i) => {
      center.set(n.id, {
        x: MARGIN_X + d * COL_W + NW / 2,
        y: TOP + i * ROW_H + NH / 2,
      });
    });
  });

  // Facts column on the far right.
  const factCenter = new Map<string, { x: number; y: number }>();
  facts.forEach((f, i) => {
    factCenter.set(f.id, {
      x: MARGIN_X + factCol * COL_W + NW / 2,
      y: TOP + i * ROW_H + NH / 2,
    });
  });

  const rowsTall = Math.max(
    ...columns.map((c) => c.length),
    facts.length,
    1
  );
  const W = MARGIN_X * 2 + (factCol + 1) * COL_W - (COL_W - NW);
  const H = TOP + rowsTall * ROW_H;

  // --- Edges -------------------------------------------------------------
  const pathBetween = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): string => {
    const x1 = a.x + NW / 2;
    const y1 = a.y;
    const x2 = b.x - NW / 2;
    const y2 = b.y;
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.4);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  // --- Graph-health analysis --------------------------------------------
  const referenced = new Set<string>();
  for (const n of nodes) {
    for (const r of n.requires) referenced.add(r);
    for (const s of n.supports) if ("nodeId" in s) referenced.add(s.nodeId);
  }
  const roots = nodes.filter((n) => n.requires.length === 0);
  const orphanLeads = nodes.filter(
    (n) => n.role === "lead" && !referenced.has(n.id)
  );
  const terminals = nodes.filter(isTerminal);
  // Terminals whose minSupports is already met by required sub-nodes alone —
  // i.e. no direct evidence is ever needed at the terminal itself.
  const autoSatisfied = terminals.filter((t) => {
    const reqAsSupport = t.requires.filter((r) =>
      t.supports.some((s) => "nodeId" in s && s.nodeId === r)
    );
    return reqAsSupport.length >= t.minSupports;
  });
  const factsWithoutNode = facts.filter(
    (f) => !nodes.some((n) => n.factId === f.id)
  );

  const nodeStroke = (n: DeductionNode): string => {
    if (n.role === "identity") return RED;
    if (isTerminal(n)) return GREEN;
    if (orphanLeads.includes(n)) return FAINT;
    if (n.requires.length === 0) return GOLD;
    return LINE;
  };

  const roleChip = (n: DeductionNode) => {
    if (n.role === "lead") return null;
    const cls = n.role === "identity" ? "warn" : "ok";
    return <span className={`chip ${cls}`}>{n.role}</span>;
  };

  // --- Serializable model for the interactive client graph --------------
  const gnodes: GNode[] = nodes.map((n) => {
    const p = center.get(n.id)!;
    const supportViews = n.supports.map(describeSupport);
    return {
      id: n.id,
      role: n.role,
      factId: n.factId,
      question: n.question,
      claim: n.claim,
      requires: n.requires,
      minSupports: n.minSupports,
      supports: supportViews.map((s) => ({
        kind: s.kind,
        label: s.label,
        ref: s.ref,
        critical: s.critical,
      })),
      x: p.x,
      y: p.y,
      stroke: nodeStroke(n),
      isTerminal: isTerminal(n),
      isRoot: n.requires.length === 0,
      isOrphan: orphanLeads.includes(n),
      leafCount: supportViews.filter((s) => s.kind !== "node").length,
    };
  });

  const gfacts: GFact[] = facts
    .filter((f) => factCenter.has(f.id))
    .map((f) => {
      const p = factCenter.get(f.id)!;
      return {
        id: f.id,
        role: f.role ?? "supporting",
        description: f.description,
        matchHints: f.matchHints,
        x: p.x,
        y: p.y,
      };
    });

  const gedges: GEdge[] = [];
  for (const n of nodes) {
    const target = center.get(n.id)!;
    const reqSet = new Set(n.requires);
    for (const r of n.requires) {
      const src = center.get(r);
      if (src)
        gedges.push({
          key: `g-${r}-${n.id}`,
          fromId: r,
          toId: n.id,
          d: pathBetween(src, target),
          color: GOLD,
          dashed: false,
          kind: "gate",
        });
    }
    for (const s of n.supports) {
      if ("nodeId" in s && !reqSet.has(s.nodeId)) {
        const src = center.get(s.nodeId);
        if (src)
          gedges.push({
            key: `s-${s.nodeId}-${n.id}`,
            fromId: s.nodeId,
            toId: n.id,
            d: pathBetween(src, target),
            color: DIM,
            dashed: true,
            kind: "support",
          });
      }
    }
    if (n.factId && factCenter.has(n.factId)) {
      gedges.push({
        key: `f-${n.id}-${n.factId}`,
        fromId: n.id,
        toId: n.factId,
        d: pathBetween(target, factCenter.get(n.factId)!),
        color: GREEN,
        dashed: false,
        kind: "fact",
      });
    }
  }

  return (
    <>
      <div className="section" style={{ marginBottom: 8 }}>
        <h3>
          Solution graph — the inference DAG ({nodes.length} node
          {nodes.length === 1 ? "" : "s"})
        </h3>
        <p className="subtitle" style={{ marginTop: 2 }}>
          Success policy: <strong>{def.solution.rubric.successPolicy}</strong> ·{" "}
          guilty: {def.solution.guiltyPartyIds.join(", ") || "—"}
        </p>
      </div>

      <SolutionGraph
        nodes={gnodes}
        facts={gfacts}
        edges={gedges}
        dims={{ W, H, NW, NH }}
      />

      {/* --- Graph health ------------------------------------------------ */}
      <div className="section">
        <h3>Graph health</h3>
        <div className="panel">
          <ul style={{ margin: "4px 0 0 18px", fontSize: 13.5, lineHeight: 1.7 }}>
            <li>
              <strong>{roots.length}</strong> root lead
              {roots.length === 1 ? "" : "s"} (open at start):{" "}
              <span style={{ color: DIM }}>
                {roots.map((r) => r.id).join(", ") || "none"}
              </span>
            </li>
            <li>
              <strong>{terminals.length}</strong> terminal
              {terminals.length === 1 ? "" : "s"} across{" "}
              {facts.length} rubric fact{facts.length === 1 ? "" : "s"}
            </li>
            {orphanLeads.length > 0 && (
              <li style={{ color: RED }}>
                {orphanLeads.length} orphan lead
                {orphanLeads.length === 1 ? "" : "s"} — reachable but feed no
                other node:{" "}
                <span style={{ fontFamily: "var(--mono)" }}>
                  {orphanLeads.map((n) => n.id).join(", ")}
                </span>
              </li>
            )}
            {autoSatisfied.length > 0 && (
              <li style={{ color: GOLD }}>
                {autoSatisfied.length} terminal
                {autoSatisfied.length === 1 ? "" : "s"} met by required sub-nodes
                alone — no direct evidence needed at the terminal:{" "}
                <span style={{ fontFamily: "var(--mono)" }}>
                  {autoSatisfied.map((n) => n.id).join(", ")}
                </span>
              </li>
            )}
            {factsWithoutNode.length > 0 && (
              <li style={{ color: RED }}>
                {factsWithoutNode.length} rubric fact
                {factsWithoutNode.length === 1 ? "" : "s"} with no terminal node:{" "}
                <span style={{ fontFamily: "var(--mono)" }}>
                  {factsWithoutNode.map((f) => f.id).join(", ")}
                </span>
              </li>
            )}
            {orphanLeads.length === 0 &&
              autoSatisfied.length === 0 &&
              factsWithoutNode.length === 0 && (
                <li style={{ color: GREEN }}>
                  No structural warnings — every lead feeds a terminal and every
                  fact has a node.
                </li>
              )}
          </ul>
        </div>
      </div>

      {/* --- Node table -------------------------------------------------- */}
      <div className="section">
        <h3>Nodes</h3>
        <table className="plain">
          <thead>
            <tr>
              <th>Node</th>
              <th>Role</th>
              <th>Question (player-facing)</th>
              <th>Requires</th>
              <th>Supports (min N)</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => {
              const supportViews = n.supports.map(describeSupport);
              return (
                <tr key={n.id}>
                  <td style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                    {n.id}
                    {n.requires.length === 0 && (
                      <span title="root lead" style={{ color: GOLD }}> ◉</span>
                    )}
                  </td>
                  <td>
                    {roleChip(n) ?? <span style={{ color: DIM }}>lead</span>}
                    {n.factId && (
                      <div style={{ color: DIM, fontSize: 11, marginTop: 3 }}>
                        → {n.factId}
                      </div>
                    )}
                  </td>
                  <td style={{ color: "#c9ceda" }}>{n.question}</td>
                  <td style={{ color: DIM, fontFamily: "var(--mono)", fontSize: 12 }}>
                    {n.requires.join(", ") || "—"}
                  </td>
                  <td>
                    <span style={{ color: DIM, fontSize: 11 }}>
                      min {n.minSupports}
                    </span>
                    <ul style={{ margin: "2px 0 0 16px", fontSize: 12.5 }}>
                      {supportViews.map((s, i) => (
                        <li key={i}>
                          <span
                            className="chip"
                            style={{
                              color:
                                s.kind === "evidence"
                                  ? GREEN
                                  : s.kind === "node"
                                    ? DIM
                                    : s.kind === "knowledge"
                                      ? GOLD
                                      : FAINT,
                            }}
                          >
                            {s.kind}
                          </span>{" "}
                          {s.label}
                          {s.kind === "evidence" && s.critical && (
                            <span title="critical evidence" style={{ color: GOLD }}> ★</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Rubric facts ------------------------------------------------ */}
      <div className="section">
        <h3>Rubric facts</h3>
        <table className="plain">
          <thead>
            <tr>
              <th>Fact</th>
              <th>Role</th>
              <th>Description</th>
              <th>Established by</th>
              <th>Match hints</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => {
              const establishers = nodes.filter((n) => n.factId === f.id);
              return (
                <tr key={f.id}>
                  <td style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                    {f.id}
                  </td>
                  <td>{f.role ?? "supporting"}</td>
                  <td style={{ color: "#c9ceda" }}>{f.description}</td>
                  <td
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: establishers.length ? INK : RED,
                    }}
                  >
                    {establishers.map((n) => n.id).join(", ") || "no node!"}
                  </td>
                  <td style={{ color: DIM, fontSize: 12 }}>
                    {f.matchHints.slice(0, 8).join(" · ")}
                    {f.matchHints.length > 8 ? " …" : ""}
                  </td>
                </tr>
              );
            })}
            {facts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: RED }}>
                  No rubric requiredFacts defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
