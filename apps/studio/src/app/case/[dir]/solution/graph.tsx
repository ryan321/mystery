"use client";

import { useEffect, useState, type ReactNode } from "react";

const GOLD = "#d9a441";
const RED = "#c96556";
const GREEN = "#7fb069";
const DIM = "#8b93a3";
const FAINT = "#5c6474";
const LINE = "#262b35";
const PANEL2 = "#1b1f27";
const INK = "#e3e6ec";

export type GSupport = {
  kind: "evidence" | "node" | "knowledge" | "condition";
  label: string;
  ref: string;
  critical: boolean;
};
export type GNode = {
  id: string;
  role: string;
  factId?: string;
  question: string;
  claim: string;
  requires: string[];
  minSupports: number;
  supports: GSupport[];
  x: number;
  y: number;
  stroke: string;
  isTerminal: boolean;
  isRoot: boolean;
  isOrphan: boolean;
  leafCount: number;
};
export type GFact = {
  id: string;
  role: string;
  description: string;
  matchHints: string[];
  x: number;
  y: number;
};
export type GEdge = {
  key: string;
  fromId: string;
  toId: string;
  d: string;
  color: string;
  dashed: boolean;
  kind: "gate" | "support" | "fact";
};
export type GDims = { W: number; H: number; NW: number; NH: number };

const short = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const supportColor = (k: GSupport["kind"]) =>
  k === "evidence" ? GREEN : k === "knowledge" ? GOLD : k === "node" ? DIM : FAINT;

export function SolutionGraph({
  nodes,
  facts,
  edges,
  dims,
}: {
  nodes: GNode[];
  facts: GFact[];
  edges: GEdge[];
  dims: GDims;
}) {
  const [sel, setSel] = useState<{ t: "node" | "fact"; id: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { W, H, NW, NH } = dims;

  const neighbors = new Set<string>();
  if (sel) {
    neighbors.add(sel.id);
    for (const e of edges) {
      if (e.fromId === sel.id) neighbors.add(e.toId);
      if (e.toId === sel.id) neighbors.add(e.fromId);
    }
  }
  const dimNode = (id: string) => (sel ? (neighbors.has(id) ? 1 : 0.3) : 1);
  const dimEdge = (e: GEdge) =>
    !sel
      ? e.kind === "support"
        ? 0.7
        : 0.9
      : e.fromId === sel.id || e.toId === sel.id
        ? 1
        : 0.1;

  const selNode = sel?.t === "node" ? nodes.find((n) => n.id === sel.id) : undefined;
  const selFact = sel?.t === "fact" ? facts.find((f) => f.id === sel.id) : undefined;

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ minWidth: Math.min(W, 1100) }}
      >
        <defs>
          <marker
            id="sol-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={DIM} />
          </marker>
        </defs>

        {/* background: click to deselect */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          onClick={() => setSel(null)}
        />

        {edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={e.color}
            strokeWidth={e.kind === "gate" ? 1.6 : 1.2}
            strokeDasharray={e.dashed ? "5 4" : undefined}
            markerEnd="url(#sol-arrow)"
            opacity={dimEdge(e)}
            style={{ transition: "opacity 120ms" }}
          />
        ))}

        {nodes.map((n) => {
          const selected = selNode?.id === n.id;
          return (
            <g
              key={n.id}
              style={{ cursor: "pointer" }}
              opacity={dimNode(n.id)}
              onClick={(ev) => {
                ev.stopPropagation();
                setSel((s) => (s?.t === "node" && s.id === n.id ? null : { t: "node", id: n.id }));
              }}
            >
              <title>{`${n.id} · ${n.role}\nclick for full detail`}</title>
              <rect
                x={n.x - NW / 2}
                y={n.y - NH / 2}
                width={NW}
                height={NH}
                rx={7}
                fill={selected ? "#232a35" : PANEL2}
                stroke={n.stroke}
                strokeWidth={(n.isTerminal ? 2 : 1.4) + (selected ? 1.4 : 0)}
                strokeDasharray={n.isOrphan ? "4 4" : undefined}
              />
              <text
                x={n.x - NW / 2 + 10}
                y={n.y - 6}
                fontSize="11"
                fontFamily="var(--mono)"
                fill={n.stroke === LINE ? GOLD : n.stroke}
              >
                {short(n.id, 26)}
              </text>
              <text x={n.x - NW / 2 + 10} y={n.y + 9} fontSize="10.5" fill={DIM}>
                {short(n.question, 30)}
              </text>
              <text
                x={n.x + NW / 2 - 8}
                y={n.y + NH / 2 - 6}
                textAnchor="end"
                fontSize="9"
                fill={FAINT}
              >
                {n.leafCount > 0 ? `${n.leafCount} leaf` : "chains"} · min {n.minSupports}
              </text>
            </g>
          );
        })}

        {facts.map((f) => {
          const selected = selFact?.id === f.id;
          return (
            <g
              key={`fact-${f.id}`}
              style={{ cursor: "pointer" }}
              opacity={dimNode(f.id)}
              onClick={(ev) => {
                ev.stopPropagation();
                setSel((s) => (s?.t === "fact" && s.id === f.id ? null : { t: "fact", id: f.id }));
              }}
            >
              <title>{`fact: ${f.id}\nclick for full detail`}</title>
              <rect
                x={f.x - NW / 2}
                y={f.y - NH / 2}
                width={NW}
                height={NH}
                rx={7}
                fill="rgba(217, 164, 65, 0.14)"
                stroke={GOLD}
                strokeWidth={1.6 + (selected ? 1.4 : 0)}
              />
              <text
                x={f.x}
                y={f.y - 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--mono)"
                fill={GOLD}
              >
                {f.id}
              </text>
              <text x={f.x} y={f.y + 11} textAnchor="middle" fontSize="9.5" fill={DIM}>
                {short(f.role, 24)}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="subtitle" style={{ marginTop: 10 }}>
        <span style={{ color: GOLD }}>gold solid</span> = requires ·{" "}
        <span style={{ color: DIM }}>dashed</span> = extra node support ·{" "}
        <span style={{ color: GREEN }}>green</span> = establishes fact · border:{" "}
        <span style={{ color: GOLD }}>root lead</span> ·{" "}
        <span style={{ color: RED }}>identity</span> ·{" "}
        <span style={{ color: GREEN }}>terminal</span> ·{" "}
        <span style={{ color: FAINT }}>orphan lead</span>
      </p>

      {!sel && (
        <p className="subtitle" style={{ marginTop: 2, color: FAINT }}>
          Click any node for its full question, sealed claim, and supports · Esc to close.
        </p>
      )}

      {selNode && <NodeDetail node={selNode} onClose={() => setSel(null)} />}
      {selFact && <FactDetail fact={selFact} onClose={() => setSel(null)} />}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
      <div
        style={{
          color: DIM,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          minWidth: 92,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="close detail"
      style={{
        background: "none",
        border: `1px solid ${LINE}`,
        color: DIM,
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        padding: "2px 9px",
        lineHeight: 1.4,
      }}
    >
      esc ✕
    </button>
  );
}

function NodeDetail({ node, onClose }: { node: GNode; onClose: () => void }) {
  const roleCls = node.role === "identity" ? "warn" : node.isTerminal ? "ok" : "";
  return (
    <div
      className="panel"
      style={{ marginTop: 14, borderColor: node.stroke, background: "#12151b" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontFamily: "var(--mono)", color: node.stroke === LINE ? INK : node.stroke }}>
          {node.id}
        </strong>
        <span className={`chip ${roleCls}`}>{node.role}</span>
        {node.factId && <span style={{ color: DIM, fontSize: 12 }}>→ {node.factId}</span>}
        {node.isRoot && <span style={{ color: GOLD, fontSize: 12 }}>◉ root lead</span>}
        {node.isOrphan && <span style={{ color: FAINT, fontSize: 12 }}>orphan</span>}
        <span style={{ marginLeft: "auto" }}>
          <CloseBtn onClose={onClose} />
        </span>
      </div>

      <Row label="Question">
        <span style={{ color: "#c9ceda" }}>{node.question}</span>
      </Row>
      <Row label="Claim">
        <span style={{ fontStyle: "italic", fontFamily: "var(--serif)" }}>{node.claim}</span>
        <span style={{ color: FAINT, fontSize: 11, marginLeft: 8 }}>(sealed — never shown to players)</span>
      </Row>
      <Row label="Requires">
        {node.requires.length ? (
          <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: DIM }}>
            {node.requires.join(", ")}
          </span>
        ) : (
          <span style={{ color: FAINT }}>none — opens at start</span>
        )}
      </Row>
      <Row label={`Supports`}>
        <span style={{ color: DIM, fontSize: 11 }}>needs {node.minSupports} of {node.supports.length}</span>
        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
          {node.supports.map((s, i) => (
            <li key={i} style={{ marginBottom: 3 }}>
              <span className="chip" style={{ color: supportColor(s.kind) }}>
                {s.kind}
              </span>{" "}
              {s.label}
              {s.kind === "evidence" && s.critical && (
                <span title="critical evidence" style={{ color: GOLD }}> ★</span>
              )}
            </li>
          ))}
        </ul>
      </Row>
    </div>
  );
}

function FactDetail({ fact, onClose }: { fact: GFact; onClose: () => void }) {
  return (
    <div
      className="panel"
      style={{ marginTop: 14, borderColor: GOLD, background: "#12151b" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "var(--mono)", color: GOLD }}>{fact.id}</strong>
        <span className="chip gold">rubric fact · {fact.role}</span>
        <span style={{ marginLeft: "auto" }}>
          <CloseBtn onClose={onClose} />
        </span>
      </div>
      <Row label="Description">
        <span style={{ color: "#c9ceda" }}>{fact.description}</span>
      </Row>
      <Row label="Match hints">
        {fact.matchHints.length ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {fact.matchHints.map((h, i) => (
              <span key={i} className="chip" style={{ color: DIM }}>
                {h}
              </span>
            ))}
          </span>
        ) : (
          <span style={{ color: FAINT }}>none</span>
        )}
      </Row>
    </div>
  );
}
