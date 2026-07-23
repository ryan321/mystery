"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./WorldMap.module.css";

/**
 * Authoring floorplan — the Studio counterpart to the player's fog-of-war
 * MapSketch (apps/web). Same drafting grammar (rooms as grid cells that
 * share walls, doorway glyphs, staircases, distant-route dashes, floor
 * tabs, pan/zoom) but drawn from the raw case definition and read for
 * authoring, not play. It shows EVERY room (auto-placing any that lack
 * map x/y) and surfaces the signals the game map hides: the start room,
 * sealed rooms, known-at-start vs discovered-in-play, and gated/one-way
 * exits.
 */

export type WorldRoom = {
  id: string;
  name: string;
  x?: number;
  y?: number;
  floor?: number;
  /** Has authored map x/y (vs auto-placed by the connection graph). */
  hasCoords: boolean;
  knownAtStart: boolean;
  /** startsAccessible === false */
  sealed: boolean;
  isStart: boolean;
  exits: { to: string; gated: boolean }[];
};

const UNIT = 100; // px per grid cell — one room per cell, walls shared
const PAD = 56;
const STUB_LEN = 16;
const DOOR_GAP = 30;

const MAX_ZOOM = 5;
/** Resting size cap: a 100-unit room renders at ~1.5×, so a one-room
 *  floor doesn't blow up to fill the whole (wide) studio panel. */
const FIT_PX_PER_UNIT = 1.5;
const ZOOM_STEP = 1.6;
const MOVE_SLOP = 4;
const DOUBLE_TAP_MS = 350;

/** Deterministic per-edge jitter for stub directions, stable across renders. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** "Blackwood Manor — the entrance hall" → "the entrance hall". */
function shortName(name: string): string {
  const parts = name.split("—");
  return (parts.length > 1 ? parts[parts.length - 1] : name).trim();
}

/** Greedy two-line wrap, balanced at the word boundary nearest the middle. */
function labelLines(name: string): string[] {
  const short = shortName(name);
  const words = short.split(/\s+/);
  if (words.length < 2) return [short];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(
      words.slice(0, i).join(" ").length - words.slice(i).join(" ").length
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

type Conn = { from: string; to: string; gated: boolean };
type Placed = WorldRoom & { gx: number; gy: number };
type Rect = { x: number; y: number; w: number; h: number };

type PlacedFloor = {
  rooms: Placed[];
  rects: Map<string, Rect>;
  width: number;
  height: number;
};

/**
 * Fallback layout for rooms without authored coordinates: BFS over the
 * exit graph, claiming free orthogonally-adjacent cells so linked rooms
 * cluster like a floor instead of scattering.
 */
function autoPlace(
  rooms: WorldRoom[],
  connections: Conn[]
): Map<string, { gx: number; gy: number }> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const c of connections) {
    link(c.from, c.to);
    link(c.to, c.from);
  }

  const placed = new Map<string, { gx: number; gy: number }>();
  const taken = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const freeAt = (x: number, y: number) => !taken.has(key(x, y));
  const claim = (id: string, x: number, y: number) => {
    placed.set(id, { gx: x, gy: y });
    taken.add(key(x, y));
  };
  const nearestFree = (cx: number, cy: number): { x: number; y: number } => {
    for (let r = 0; r < 16; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (freeAt(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: cx, y: cy + 16 };
  };
  const DIRS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;

  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id));
  const queue: string[] = [];
  for (const l of sorted) {
    if (placed.has(l.id)) continue;
    const root = nearestFree(0, 0);
    claim(l.id, root.x, root.y);
    queue.push(l.id);
    while (queue.length) {
      const cur = queue.shift()!;
      const cp = placed.get(cur)!;
      for (const nb of adj.get(cur) ?? []) {
        if (placed.has(nb) || !rooms.some((l) => l.id === nb)) continue;
        let spot: { x: number; y: number } | undefined;
        for (const [dx, dy] of DIRS) {
          if (freeAt(cp.gx + dx, cp.gy + dy)) {
            spot = { x: cp.gx + dx, y: cp.gy + dy };
            break;
          }
        }
        const s = spot ?? nearestFree(cp.gx, cp.gy);
        claim(nb, s.x, s.y);
        queue.push(nb);
      }
    }
  }
  return placed;
}

function placeFloor(rooms: WorldRoom[], connections: Conn[]): PlacedFloor {
  const fallback = autoPlace(rooms, connections);
  const placedRooms: Placed[] = rooms.map((l) => {
    const g =
      l.x !== undefined && l.y !== undefined
        ? { gx: l.x, gy: l.y }
        : fallback.get(l.id)!;
    return { ...l, ...g };
  });
  const minGx = Math.min(...placedRooms.map((r) => r.gx));
  const minGy = Math.min(...placedRooms.map((r) => r.gy));
  const maxGx = Math.max(...placedRooms.map((r) => r.gx));
  const maxGy = Math.max(...placedRooms.map((r) => r.gy));
  const rects = new Map<string, Rect>(
    placedRooms.map((r) => [
      r.id,
      {
        x: PAD + (r.gx - minGx) * UNIT,
        y: PAD + (r.gy - minGy) * UNIT,
        w: UNIT,
        h: UNIT,
      },
    ])
  );
  return {
    rooms: placedRooms,
    rects,
    width: PAD * 2 + (maxGx - minGx + 1) * UNIT,
    height: PAD * 2 + (maxGy - minGy + 1) * UNIT,
  };
}

function floorLabel(floor: number): string {
  if (floor === 0) return "Ground floor";
  if (floor === 1) return "Upper floor";
  if (floor < 0) return `Basement ${-floor}`;
  return `Floor ${floor}`;
}

function center(r: Rect) {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/** Point where the ray from the rect's center at angle θ exits the rect. */
function edgePoint(r: Rect, theta: number) {
  const { cx, cy } = center(r);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const t = r.w / 2 / Math.max(Math.abs(cos), Math.abs(sin));
  return { x: cx + t * cos, y: cy + t * sin };
}

/** A small filled arrowhead at (x,y) pointing along `angle`. */
function arrowPoints(x: number, y: number, angle: number, size = 6): string {
  const back = angle + Math.PI;
  const spread = 0.5;
  const p1 = { x, y };
  const p2 = {
    x: x + Math.cos(back - spread) * size,
    y: y + Math.sin(back - spread) * size,
  };
  const p3 = {
    x: x + Math.cos(back + spread) * size,
    y: y + Math.sin(back + spread) * size,
  };
  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
}

// ── Pan/zoom gesture state ──────────────────────────────────────────

type View = { k: number; tx: number; ty: number };

type Gesture = {
  pointers: Map<number, { x: number; y: number }>;
  base: {
    k: number;
    tx: number;
    ty: number;
    midX: number;
    midY: number;
    dist: number;
  } | null;
  moved: boolean;
};

function clientMidpoint(pts: { x: number; y: number }[]) {
  const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return { x: sx, y: sy };
}

function clientDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function WorldMap({ rooms }: { rooms: WorldRoom[] }) {
  const floors = useMemo(() => {
    const set = new Set<number>();
    for (const l of rooms) set.add(l.floor ?? 0);
    return [...set].sort((a, b) => a - b);
  }, [rooms]);

  const startFloor = rooms.find((l) => l.isStart)?.floor ?? floors[0] ?? 0;
  const [activeFloor, setActiveFloor] = useState(startFloor);
  const shownFloor = floors.includes(activeFloor) ? activeFloor : startFloor;

  /** Every exit as a directed edge; adjacency/stairs dedupe internally. */
  const connections = useMemo<Conn[]>(
    () =>
      rooms.flatMap((r) =>
        r.exits.map((e) => ({ from: r.id, to: e.to, gated: e.gated }))
      ),
    [rooms]
  );
  /** Pair keys that have exits in both directions (else it's one-way). */
  const bidir = useMemo(() => {
    const dir = new Set<string>();
    const both = new Set<string>();
    for (const c of connections) {
      dir.add(`${c.from}>${c.to}`);
      if (dir.has(`${c.to}>${c.from}`)) both.add([c.from, c.to].sort().join("~"));
    }
    return both;
  }, [connections]);

  const placed = useMemo(
    () =>
      placeFloor(
        rooms.filter((l) => (l.floor ?? 0) === shownFloor),
        connections
      ),
    [rooms, connections, shownFloor]
  );
  const gridOf = useMemo(
    () => new Map(placed.rooms.map((r) => [r.id, { gx: r.gx, gy: r.gy }])),
    [placed]
  );
  /** Coordinates across ALL floors (stair detection needs the far end). */
  const allCoords = useMemo(
    () =>
      new Map(
        rooms
          .filter((l) => l.x !== undefined && l.y !== undefined)
          .map((l) => [l.id, { gx: l.x!, gy: l.y!, floor: l.floor ?? 0 }])
      ),
    [rooms]
  );
  const start = placed.rooms.find((r) => r.isStart);

  const doors = useMemo(() => {
    type WallDoor = {
      a: string;
      b: string;
      gated: boolean;
      oneWay: boolean;
      orient: "v" | "h";
      mx: number;
      my: number;
    };
    type PathDoor = { a: string; b: string; gated: boolean; oneWay: boolean };
    type Stair = { from: string; to: string; up: boolean; floor: number };
    type Stub = {
      from: string;
      to: string;
      gated: boolean;
      label: string;
      angle: number;
    };

    const wall = new Map<string, WallDoor>();
    const paths = new Map<string, PathDoor>();
    const stairs = new Map<string, Stair>();
    const stubs = new Map<string, Stub>();

    for (const conn of connections) {
      const ra = placed.rects.get(conn.from);
      if (!ra) continue;
      const rb = placed.rects.get(conn.to);
      const pairKey = [conn.from, conn.to].sort().join("~");
      const oneWay = !bidir.has(pairKey);

      if (rb) {
        const ga = gridOf.get(conn.from)!;
        const gb = gridOf.get(conn.to)!;
        const adjacent =
          Math.abs(ga.gx - gb.gx) + Math.abs(ga.gy - gb.gy) === 1;
        if (adjacent) {
          const sharedX = ga.gx !== gb.gx;
          const mx = sharedX ? Math.max(ra.x, rb.x) : ra.x + ra.w / 2;
          const my = sharedX ? ra.y + ra.h / 2 : Math.max(ra.y, rb.y);
          const existing = wall.get(pairKey);
          if (existing) {
            existing.gated = existing.gated || conn.gated;
          } else {
            wall.set(pairKey, {
              a: conn.from,
              b: conn.to,
              gated: conn.gated,
              oneWay,
              orient: sharedX ? "v" : "h",
              mx,
              my,
            });
          }
        } else {
          const existing = paths.get(pairKey);
          if (existing) {
            existing.gated = existing.gated || conn.gated;
          } else {
            paths.set(pairKey, {
              a: conn.from,
              b: conn.to,
              gated: conn.gated,
              oneWay,
            });
          }
        }
        continue;
      }

      // Destination on another floor: staircase if stacked on this cell,
      // otherwise a labeled stub pointing toward it.
      const fromG = gridOf.get(conn.from)!;
      const toC = allCoords.get(conn.to);
      if (stairs.has(pairKey)) continue;
      if (toC && toC.gx === fromG.gx && toC.gy === fromG.gy) {
        stairs.set(pairKey, {
          from: conn.from,
          to: conn.to,
          up: toC.floor > shownFloor,
          floor: toC.floor,
        });
      } else {
        const angle = toC
          ? Math.atan2(toC.gy - fromG.gy, toC.gx - fromG.gx)
          : ((hashSeed(`${conn.from}->${conn.to}`) % 8) * Math.PI) / 4;
        const stubKey = `${conn.from}->${conn.to}`;
        if (!stubs.has(stubKey)) {
          stubs.set(stubKey, {
            from: conn.from,
            to: conn.to,
            gated: conn.gated,
            label: shortName(rooms.find((l) => l.id === conn.to)?.name ?? "?"),
            angle,
          });
        }
      }
    }
    return {
      wall: [...wall.values()],
      paths: [...paths.values()],
      stairs: [...stairs.values()],
      stubs: [...stubs.values()],
    };
  }, [connections, bidir, placed, gridOf, allCoords, shownFloor, rooms]);

  // ── Pan/zoom ──────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [elemW, setElemW] = useState(0);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const gestureRef = useRef<Gesture>({
    pointers: new Map(),
    base: null,
    moved: false,
  });
  const lastTap = useRef(0);

  const fitK =
    elemW > 0 && placed.width > 0
      ? Math.min(1, FIT_PX_PER_UNIT / (elemW / placed.width))
      : 1;
  const fitKRef = useRef(fitK);
  fitKRef.current = fitK;

  const applyView = (v: View) => {
    const k = Math.min(MAX_ZOOM, Math.max(fitKRef.current, v.k));
    const clampAxis = (dim: number, t: number) =>
      k >= 1 ? Math.min(0, Math.max(dim * (1 - k), t)) : (dim * (1 - k)) / 2;
    const c = {
      k,
      tx: clampAxis(placed.width, v.tx),
      ty: clampAxis(placed.height, v.ty),
    };
    viewRef.current = c;
    setView(c);
  };
  const applyViewRef = useRef(applyView);
  applyViewRef.current = applyView;

  const fitView = () =>
    applyViewRef.current({ k: fitKRef.current, tx: 0, ty: 0 });
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;

  const toViewBox = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Zoom by `factor` around a client point (cursor / viewport center).
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const cur = viewRef.current;
    const p = toViewBox(clientX, clientY);
    const k = Math.min(MAX_ZOOM, Math.max(fitKRef.current, cur.k * factor));
    const ax = (p.x - cur.tx) / cur.k;
    const ay = (p.y - cur.ty) / cur.k;
    applyViewRef.current({ k, tx: p.x - k * ax, ty: p.y - k * ay });
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  const zoomCenter = (factor: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  };

  // Track the sheet's rendered width (panel resize, first mount).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    setElemW(svg.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      setElemW(entries[0].contentRect.width);
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // React's onWheel is passive and can't stop the page scrolling — a
  // native non-passive listener lets the wheel zoom the sheet instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAtRef.current(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Fit again when the floor (and with it the sheet's bounds) changes.
  useEffect(() => {
    fitViewRef.current();
  }, [shownFloor]);

  // A new fit zoom (first measurement, panel resize) re-clamps the
  // current view without resetting the author's chosen zoom.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      fitViewRef.current();
      return;
    }
    applyViewRef.current(viewRef.current);
  }, [fitK, placed.width, placed.height]);

  const reanchor = () => {
    const g = gestureRef.current;
    const pts = [...g.pointers.values()];
    if (!pts.length) {
      g.base = null;
      return;
    }
    const mid = toViewBox(clientMidpoint(pts).x, clientMidpoint(pts).y);
    g.base = {
      ...viewRef.current,
      midX: mid.x,
      midY: mid.y,
      dist: pts.length === 2 ? clientDistance(pts[0], pts[1]) : 0,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.moved = false;
    if (g.pointers.size === 2) {
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
    }
    reanchor();
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    if (!g.pointers.has(e.pointerId) || !g.base) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...g.pointers.values()];
    const base = g.base;

    let k = base.k;
    if (pts.length === 2 && base.dist > 0) {
      k = base.k * (clientDistance(pts[0], pts[1]) / base.dist);
      g.moved = true;
    }
    const mid = toViewBox(clientMidpoint(pts).x, clientMidpoint(pts).y);
    if (Math.abs(mid.x - base.midX) + Math.abs(mid.y - base.midY) > MOVE_SLOP) {
      g.moved = true;
    }
    const ax = (base.midX - base.tx) / base.k;
    const ay = (base.midY - base.ty) / base.k;
    applyView({ k, tx: mid.x - k * ax, ty: mid.y - k * ay });
  };

  const onPointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    const wasMulti = g.pointers.size > 1;
    g.pointers.delete(e.pointerId);

    if (!g.moved && !wasMulti) {
      // Double-tap toggles zoom, centered on the tap.
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        const cur = viewRef.current;
        if (cur.k > fitKRef.current * 1.05) {
          fitViewRef.current();
        } else {
          const tap = toViewBox(e.clientX, e.clientY);
          const k = Math.min(MAX_ZOOM, fitKRef.current * 3);
          const ax = (tap.x - cur.tx) / cur.k;
          const ay = (tap.y - cur.ty) / cur.k;
          applyView({ k, tx: tap.x - k * ax, ty: tap.y - k * ay });
        }
      } else {
        lastTap.current = now;
      }
    }
    reanchor();
  };

  function roomClass(r: Placed): string {
    if (r.isStart) return styles.roomStart;
    if (r.sealed) return styles.roomSealed;
    return r.knownAtStart ? styles.roomKnown : styles.roomDiscovered;
  }

  if (rooms.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      {floors.length > 1 ? (
        <div className={styles.floorTabs} role="tablist" aria-label="Floors">
          {floors.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === shownFloor}
              className={`${styles.floorTab} ${
                f === shownFloor ? styles.floorTabActive : ""
              }`}
              onClick={() => setActiveFloor(f)}
            >
              {floorLabel(f)}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.stage}>
        <svg
          ref={svgRef}
          className={styles.paper}
          viewBox={`0 0 ${placed.width} ${placed.height}`}
          role="img"
          aria-label="Floor plan of the case locations"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {/* Dashed routes between non-adjacent rooms — drawn first so
                the buildings sit on top and clip them at the walls. */}
            {doors.paths.map((d) => {
              const ra = placed.rects.get(d.a)!;
              const rb = placed.rects.get(d.b)!;
              const a = center(ra);
              const b = center(rb);
              const pa = edgePoint(ra, Math.atan2(b.cy - a.cy, b.cx - a.cx));
              const pb = edgePoint(rb, Math.atan2(a.cy - b.cy, a.cx - b.cx));
              const aligned = a.cx === b.cx || a.cy === b.cy;
              const points = aligned
                ? `${pa.x},${pa.y} ${pb.x},${pb.y}`
                : `${pa.x},${pa.y} ${b.cx},${a.cy} ${pb.x},${pb.y}`;
              return (
                <g key={`${d.a}-${d.b}`}>
                  <polyline
                    points={points}
                    className={d.gated ? styles.pathLineLocked : styles.pathLine}
                  />
                  {d.oneWay ? (
                    <polygon
                      className={styles.oneWay}
                      points={arrowPoints(
                        pb.x,
                        pb.y,
                        Math.atan2(pb.y - a.cy, pb.x - a.cx)
                      )}
                    />
                  ) : null}
                </g>
              );
            })}

            {/* Rooms — shared edges draw doubled = interior walls. */}
            {placed.rooms.map((r) => {
              const rect = placed.rects.get(r.id)!;
              return (
                <rect
                  key={r.id}
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  className={`${styles.room} ${roomClass(r)}`}
                >
                  <title>
                    {r.name} ({r.id})
                    {r.isStart ? " — start" : ""}
                    {r.sealed ? " — sealed at start" : ""}
                    {r.knownAtStart ? " — on map at start" : ""}
                    {r.hasCoords ? "" : " — auto-placed (no map x/y)"}
                  </title>
                </rect>
              );
            })}

            {/* Doorways cut into shared walls */}
            {doors.wall.map((d) => {
              const g = DOOR_GAP / 2;
              const hinge =
                d.orient === "v"
                  ? { x: d.mx, y: d.my - g }
                  : { x: d.mx - g, y: d.my };
              const far =
                d.orient === "v"
                  ? { x: d.mx, y: d.my + g }
                  : { x: d.mx + g, y: d.my };
              const leafTip =
                d.orient === "v"
                  ? { x: d.mx - DOOR_GAP, y: d.my - g }
                  : { x: d.mx - g, y: d.my - DOOR_GAP };
              const ca = center(placed.rects.get(d.a)!);
              const cb = center(placed.rects.get(d.b)!);
              return (
                <g key={`${d.a}-${d.b}`}>
                  {d.gated ? (
                    <rect
                      x={d.mx - 4.5}
                      y={d.my - 4.5}
                      width={9}
                      height={9}
                      className={styles.lockGlyph}
                    />
                  ) : (
                    <>
                      <rect
                        x={d.orient === "v" ? d.mx - 4 : hinge.x}
                        y={d.orient === "v" ? hinge.y : d.my - 4}
                        width={d.orient === "v" ? 8 : DOOR_GAP}
                        height={d.orient === "v" ? DOOR_GAP : 8}
                        className={styles.doorGap}
                      />
                      <line
                        x1={hinge.x}
                        y1={hinge.y}
                        x2={leafTip.x}
                        y2={leafTip.y}
                        className={styles.doorLeaf}
                      />
                      <path
                        d={`M ${far.x} ${far.y} A ${DOOR_GAP} ${DOOR_GAP} 0 0 ${
                          d.orient === "v" ? 1 : 0
                        } ${leafTip.x} ${leafTip.y}`}
                        className={styles.doorSwing}
                      />
                    </>
                  )}
                  {d.oneWay ? (
                    <polygon
                      className={styles.oneWay}
                      points={arrowPoints(
                        d.mx,
                        d.my,
                        Math.atan2(cb.cy - ca.cy, cb.cx - ca.cx),
                        5
                      )}
                    />
                  ) : null}
                </g>
              );
            })}

            {/* Staircases: rooms stacked on another floor */}
            {doors.stairs.map((s) => {
              const rect = placed.rects.get(s.from)!;
              const sx = rect.x + 10;
              const sy = rect.y + rect.h - 12;
              return (
                <g key={`stair-${s.from}-${s.to}`}>
                  {[0, 1, 2, 3].map((i) => (
                    <line
                      key={i}
                      x1={sx}
                      y1={sy - i * 5}
                      x2={sx + 22}
                      y2={sy - i * 5}
                      className={styles.stairSteps}
                    />
                  ))}
                  <text x={sx + 27} y={sy - 4} className={styles.stairLabel}>
                    {s.up ? "↑" : "↓"} {floorLabel(s.floor)}
                  </text>
                </g>
              );
            })}

            {/* Stubs: exits to rooms on another floor (not stacked) */}
            {doors.stubs.map((s, i) => {
              const rect = placed.rects.get(s.from)!;
              const p = edgePoint(rect, s.angle);
              const ex = p.x + Math.cos(s.angle) * STUB_LEN;
              const ey = p.y + Math.sin(s.angle) * STUB_LEN;
              return (
                <g key={`stub-${i}`}>
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={ex}
                    y2={ey}
                    className={s.gated ? styles.stubLocked : styles.stub}
                  />
                  <text x={ex} y={ey - 3} className={styles.stubLabel}>
                    {s.label}
                  </text>
                </g>
              );
            })}

            {/* Labels + auto-placed note on top of everything room-shaped */}
            {placed.rooms.map((r) => {
              const rect = placed.rects.get(r.id)!;
              const { cx, cy } = center(rect);
              const lines = labelLines(r.name);
              const ys = lines.length === 1 ? [cy + 3.5] : [cy - 2, cy + 9];
              return (
                <g key={`label-${r.id}`}>
                  <text className={styles.roomLabel}>
                    {lines.map((ln, i) => (
                      <tspan key={i} x={cx} y={ys[i]}>
                        {ln}
                      </tspan>
                    ))}
                  </text>
                  {r.hasCoords ? null : (
                    <text
                      x={rect.x + 5}
                      y={rect.y + rect.h - 5}
                      className={styles.noCoords}
                    >
                      no map x/y
                    </text>
                  )}
                </g>
              );
            })}

            {/* Start mark, tucked into the room's corner. */}
            {start ? (
              <g className={styles.startMark}>
                {(() => {
                  const rect = placed.rects.get(start.id)!;
                  const mx = rect.x + rect.w - 13;
                  const my = rect.y + 13;
                  return (
                    <>
                      <circle cx={mx} cy={my} r={4} />
                      <text x={mx} y={my + 13}>
                        start
                      </text>
                    </>
                  );
                })()}
              </g>
            ) : null}
          </g>
        </svg>

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={() => zoomCenter(ZOOM_STEP)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={() => zoomCenter(1 / ZOOM_STEP)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={fitView}
            aria-label="Reset map view"
            title="Reset map view"
          >
            Fit
          </button>
        </div>
      </div>

      <p className={styles.legend}>
        <b>solid</b> — known at start · <b>dashed</b> — discovered in play ·{" "}
        <b>gold</b> — start · <b>red</b> — sealed / locked exit · wall gap —
        open door · red square — gated door · <b>▸</b> — one-way · stairs —
        another floor · drag / wheel / double-tap — pan &amp; zoom
      </p>
    </div>
  );
}
