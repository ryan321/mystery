import { useMemo, useState } from "react";
import type { MapLocation, MapView } from "../lib/types";
import styles from "./MapSketch.module.css";

/**
 * Fog-of-war floorplan (PLAYER_SURFACES.md §5.3): data-driven SVG drawn
 * from the engine's known-locations projection, styled as the detective's
 * own ink floorplan on paper. Unknown rooms simply aren't here.
 *
 * Rooms are grid cells that share walls (authored map x/y per case).
 * Doors between neighbors are doorway glyphs cut into the shared wall
 * (gap + leaf + swing arc when open, red lock square when not); distant
 * rooms get dashed paths routed under the buildings; a room stacked on
 * the same cell of another floor gets a staircase glyph. Cases without
 * authored coordinates fall back to BFS-adjacency placement so connected
 * rooms still land next to each other.
 *
 * Room states: visited (solid ink) / known-unvisited (dashed — "heard of
 * it") / current (you-are-here mark). Clicking a room travels via the
 * normal composer path; the engine still validates the move.
 */

const UNIT = 100; // px per grid cell — one room per cell, walls shared
const PAD = 28;
const STUB_LEN = 14;
const DOOR_GAP = 30;

/** Deterministic per-room jitter for stub directions, stable. */
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

type Placed = MapLocation & { gx: number; gy: number };
type Rect = { x: number; y: number; w: number; h: number };

type PlacedFloor = {
  rooms: Placed[];
  rects: Map<string, Rect>;
  width: number;
  height: number;
};

/**
 * Fallback layout for cases without authored coordinates: BFS over the
 * connection graph, claiming free orthogonally-adjacent cells so linked
 * rooms cluster like a floor instead of scattering over a fixed grid.
 */
function autoPlace(
  locations: MapLocation[],
  connections: MapView["connections"]
): Map<string, { gx: number; gy: number }> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const c of connections) {
    if (!c.destinationKnown) continue;
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

  const sorted = [...locations].sort((a, b) => a.id.localeCompare(b.id));
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
        if (placed.has(nb) || !locations.some((l) => l.id === nb)) continue;
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

function placeFloor(
  locations: MapLocation[],
  connections: MapView["connections"]
): PlacedFloor {
  const fallback = autoPlace(locations, connections);
  const rooms: Placed[] = locations.map((l) => {
    const g =
      l.x !== undefined && l.y !== undefined
        ? { gx: l.x, gy: l.y }
        : fallback.get(l.id)!;
    return { ...l, ...g };
  });
  const minGx = Math.min(...rooms.map((r) => r.gx));
  const minGy = Math.min(...rooms.map((r) => r.gy));
  const maxGx = Math.max(...rooms.map((r) => r.gx));
  const maxGy = Math.max(...rooms.map((r) => r.gy));
  const rects = new Map<string, Rect>(
    rooms.map((r) => [
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
    rooms,
    rects,
    width: PAD * 2 + (maxGx - minGx + 1) * UNIT,
    height: PAD * 2 + (maxGy - minGy + 1) * UNIT,
  };
}

function floorLabel(floor: number): string {
  if (floor === 0) return "Ground floor";
  if (floor === 1) return "Upper floor";
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

export default function MapSketch({
  map,
  disabled,
  onTravel,
}: {
  map: MapView;
  disabled?: boolean;
  onTravel?: (location: MapLocation) => void;
}) {
  const floors = useMemo(() => {
    const set = new Set<number>();
    for (const l of map.locations) set.add(l.floor ?? 0);
    return [...set].sort((a, b) => a - b);
  }, [map.locations]);

  const currentFloor =
    map.locations.find((l) => l.id === map.currentLocationId)?.floor ?? 0;
  const [activeFloor, setActiveFloor] = useState(currentFloor);
  const shownFloor = floors.includes(activeFloor) ? activeFloor : currentFloor;

  const placed = useMemo(
    () =>
      placeFloor(
        map.locations.filter((l) => (l.floor ?? 0) === shownFloor),
        map.connections
      ),
    [map.locations, map.connections, shownFloor]
  );
  const gridOf = useMemo(
    () => new Map(placed.rooms.map((r) => [r.id, { gx: r.gx, gy: r.gy }])),
    [placed]
  );
  /** Coordinates across ALL floors (stair detection needs the far end). */
  const allCoords = useMemo(
    () =>
      new Map(
        map.locations
          .filter((l) => l.x !== undefined && l.y !== undefined)
          .map((l) => [
            l.id,
            { gx: l.x!, gy: l.y!, floor: l.floor ?? 0 },
          ])
      ),
    [map.locations]
  );
  const here = placed.rooms.find((r) => r.id === map.currentLocationId);

  const doors = useMemo(() => {
    type WallDoor = {
      a: string;
      b: string;
      open: boolean;
      /** shared wall: vertical (rooms side by side) or horizontal */
      orient: "v" | "h";
      mx: number;
      my: number;
    };
    type PathDoor = { a: string; b: string; open: boolean };
    type Stair = { from: string; to: string; up: boolean; floor: number };
    type Stub = { from: string; to: string; known: boolean; angle: number };

    const wall = new Map<string, WallDoor>();
    const paths = new Map<string, PathDoor>();
    const stairs = new Map<string, Stair>();
    const stubs: Stub[] = [];

    for (const conn of map.connections) {
      const ra = placed.rects.get(conn.from);
      if (!ra) continue;
      const rb = placed.rects.get(conn.to);
      const pairKey = [conn.from, conn.to].sort().join("~");

      if (rb && conn.destinationKnown) {
        const ga = gridOf.get(conn.from)!;
        const gb = gridOf.get(conn.to)!;
        const adjacent = Math.abs(ga.gx - gb.gx) + Math.abs(ga.gy - gb.gy) === 1;
        if (adjacent) {
          const sharedX = ga.gx !== gb.gx;
          const mx = sharedX
            ? Math.max(ra.x, rb.x)
            : ra.x + ra.w / 2;
          const my = sharedX
            ? ra.y + ra.h / 2
            : Math.max(ra.y, rb.y);
          const existing = wall.get(pairKey);
          if (existing) {
            existing.open = existing.open && conn.open;
          } else {
            wall.set(pairKey, {
              a: conn.from,
              b: conn.to,
              open: conn.open,
              orient: sharedX ? "v" : "h",
              mx,
              my,
            });
          }
        } else {
          const existing = paths.get(pairKey);
          if (existing) {
            existing.open = existing.open && conn.open;
          } else {
            paths.set(pairKey, { a: conn.from, b: conn.to, open: conn.open });
          }
        }
        continue;
      }

      if (!conn.destinationKnown) {
        const seed = hashSeed(`${conn.from}->${conn.to}`);
        stubs.push({
          from: conn.from,
          to: conn.to,
          known: false,
          angle: ((seed % 8) * Math.PI) / 4,
        });
        continue;
      }

      // Known room on another floor: staircase if stacked on this cell,
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
        if (!stubs.some((s) => s.from === conn.from && s.to === conn.to)) {
          stubs.push({ from: conn.from, to: conn.to, known: true, angle });
        }
      }
    }
    return {
      wall: [...wall.values()],
      paths: [...paths.values()],
      stairs: [...stairs.values()],
      stubs,
    };
  }, [map.connections, placed, gridOf, allCoords, shownFloor]);

  if (map.locations.length === 0) {
    return <p className={styles.empty}>No map yet — explore first.</p>;
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

      <svg
        className={styles.paper}
        viewBox={`0 0 ${placed.width} ${placed.height}`}
        role="img"
        aria-label="Sketch map of known locations"
      >
        {/* Dashed paths between non-adjacent rooms — under the buildings,
            so they vanish at the walls instead of crossing the rooms. */}
        {doors.paths.map((d) => {
          const ra = placed.rects.get(d.a)!;
          const rb = placed.rects.get(d.b)!;
          const a = center(ra);
          const b = center(rb);
          const pa = edgePoint(ra, Math.atan2(b.cy - a.cy, b.cx - a.cx));
          const pb = edgePoint(rb, Math.atan2(a.cy - b.cy, a.cx - b.cx));
          // Straight run when the rooms line up; otherwise an L-bend.
          const aligned = a.cx === b.cx || a.cy === b.cy;
          const points = aligned
            ? `${pa.x},${pa.y} ${pb.x},${pb.y}`
            : `${pa.x},${pa.y} ${b.cx},${a.cy} ${pb.x},${pb.y}`;
          return (
            <polyline
              key={`${d.a}-${d.b}`}
              points={points}
              className={d.open ? styles.pathLine : styles.pathLineLocked}
            />
          );
        })}

        {/* Rooms — shared edges draw as doubled ink = interior walls. */}
        {placed.rooms.map((r) => {
          const rect = placed.rects.get(r.id)!;
          const isCurrent = r.id === map.currentLocationId;
          const cls = isCurrent
            ? styles.roomCurrent
            : r.visited
              ? styles.roomVisited
              : styles.roomHeard;
          return (
            <rect
              key={r.id}
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              className={`${styles.room} ${cls} ${
                !isCurrent && !disabled && onTravel ? styles.roomClickable : ""
              }`}
              onClick={
                !isCurrent && !disabled && onTravel
                  ? () => onTravel(r)
                  : undefined
              }
            >
              <title>
                {r.name}
                {r.visited ? "" : " — heard of it, not yet seen"}
              </title>
            </rect>
          );
        })}

        {/* Doorways cut into shared walls */}
        {doors.wall.map((d) => {
          const g = DOOR_GAP / 2;
          // Hinge at the first gap end; leaf opens 90° into room a's side,
          // swing arc sweeps from the far gap end to the leaf tip.
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
          return (
            <g key={`${d.a}-${d.b}`}>
              {d.open ? (
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
                    d={`M ${far.x} ${far.y} A ${DOOR_GAP} ${DOOR_GAP} 0 0 ${d.orient === "v" ? 1 : 0} ${leafTip.x} ${leafTip.y}`}
                    className={styles.doorSwing}
                  />
                </>
              ) : (
                <rect
                  x={d.mx - 4.5}
                  y={d.my - 4.5}
                  width={9}
                  height={9}
                  className={styles.lockGlyph}
                />
              )}
            </g>
          );
        })}

        {/* Staircases: stacked rooms on other floors */}
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

        {/* Stubs: doors never taken (?), or ways to known rooms elsewhere */}
        {doors.stubs.map((s, i) => {
          const rect = placed.rects.get(s.from)!;
          const p = edgePoint(rect, s.angle);
          const ex = p.x + Math.cos(s.angle) * STUB_LEN;
          const ey = p.y + Math.sin(s.angle) * STUB_LEN;
          const label = s.known
            ? shortName(
                map.locations.find((l) => l.id === s.to)?.name ?? "?"
              )
            : "?";
          return (
            <g key={`stub-${i}`}>
              <line
                x1={p.x}
                y1={p.y}
                x2={ex}
                y2={ey}
                className={styles.stub}
              />
              <text x={ex} y={ey - 3} className={styles.stubLabel}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Labels on top of everything room-shaped */}
        {placed.rooms.map((r) => {
          const rect = placed.rects.get(r.id)!;
          const { cx, cy } = center(rect);
          const lines = labelLines(r.name);
          const ys = lines.length === 1 ? [cy + 3.5] : [cy - 2, cy + 9];
          return (
            <text key={`label-${r.id}`} className={styles.roomLabel}>
              {lines.map((ln, i) => (
                <tspan key={i} x={cx} y={ys[i]}>
                  {ln}
                </tspan>
              ))}
            </text>
          );
        })}

        {/* You-are-here mark, tucked into the room's corner */}
        {here ? (
          <g className={styles.youAreHere}>
            {(() => {
              const rect = placed.rects.get(here.id)!;
              const mx = rect.x + rect.w - 13;
              const my = rect.y + 13;
              return (
                <>
                  <circle cx={mx} cy={my} r={4} />
                  <text x={mx} y={my + 13}>
                    you
                  </text>
                </>
              );
            })()}
          </g>
        ) : (
          <text x={PAD} y={placed.height - 12} className={styles.elsewhere}>
            You are on another floor.
          </text>
        )}
      </svg>

      <p className={styles.legend}>
        solid ink — visited · dashed — heard of it · wall gap — open door ·
        red square — locked · ? — door never taken
      </p>
    </div>
  );
}
