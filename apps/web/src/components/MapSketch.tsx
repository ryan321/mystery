import { useMemo, useState } from "react";
import type { MapLocation, MapView } from "../lib/types";
import styles from "./MapSketch.module.css";

/**
 * Fog-of-war sketch map (PLAYER_SURFACES.md §5.3): data-driven SVG drawn
 * from the engine's known-locations projection, styled as the detective's
 * own hand sketch on paper. Unknown rooms simply aren't here.
 *
 * Room states: visited (solid ink) / known-unvisited (faint dashed —
 * "heard of it") / current (you-are-here mark). Connections: solid = open
 * door seen; dashed + lock = closed; "?" stub = a door never taken.
 * Clicking a room travels via the normal composer path; the engine still
 * validates the move.
 */

const CELL_W = 156;
const CELL_H = 110;
const ROOM_W = 118;
const ROOM_H = 64;
const PAD = 44;
const STUB_LEN = 34;

/** Deterministic per-room jitter so the sketch looks hand-drawn, stable. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Placed = MapLocation & { gx: number; gy: number };

type PlacedFloor = {
  rooms: Placed[];
  width: number;
  height: number;
  roomCenter: Map<string, { cx: number; cy: number }>;
};

function placeFloor(locations: MapLocation[]): PlacedFloor {
  const used = new Set<string>();
  for (const l of locations) {
    if (l.x !== undefined && l.y !== undefined) used.add(`${l.x},${l.y}`);
  }
  // Fallback grid placement for rooms without authored coordinates.
  let cursor = 0;
  const rooms: Placed[] = [...locations]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => {
      if (l.x !== undefined && l.y !== undefined) {
        return { ...l, gx: l.x, gy: l.y };
      }
      while (used.has(`${cursor % 4},${Math.floor(cursor / 4)}`)) cursor++;
      const gx = cursor % 4;
      const gy = Math.floor(cursor / 4);
      used.add(`${gx},${gy}`);
      cursor++;
      return { ...l, gx, gy };
    })
    .sort((a, b) => a.gy - b.gy || a.gx - b.gx);

  const maxX = Math.max(0, ...rooms.map((r) => r.gx));
  const maxY = Math.max(0, ...rooms.map((r) => r.gy));
  const roomCenter = new Map<string, { cx: number; cy: number }>();
  for (const r of rooms) {
    roomCenter.set(r.id, {
      cx: PAD + r.gx * CELL_W + CELL_W / 2,
      cy: PAD + r.gy * CELL_H + CELL_H / 2,
    });
  }
  return {
    rooms,
    width: PAD * 2 + (maxX + 1) * CELL_W,
    height: PAD * 2 + (maxY + 1) * CELL_H,
    roomCenter,
  };
}

function floorLabel(floor: number): string {
  if (floor === 0) return "Ground floor";
  if (floor === 1) return "Upper floor";
  return `Floor ${floor}`;
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
    () => placeFloor(map.locations.filter((l) => (l.floor ?? 0) === shownFloor)),
    [map.locations, shownFloor]
  );
  const here = placed.rooms.find((r) => r.id === map.currentLocationId);

  // Dedupe door pairs (A→B + B→A collapse into one ink line).
  const doors = useMemo(() => {
    const byPair = new Map<string, { a: string; b: string; open: boolean }>();
    const stubs: { from: string; to: string; known: boolean }[] = [];
    for (const conn of map.connections) {
      const fromKnown = placed.roomCenter.has(conn.from);
      const toLoc = map.locations.find((l) => l.id === conn.to);
      const toHere = placed.roomCenter.has(conn.to);
      if (!fromKnown) continue;
      if (!conn.destinationKnown || !toLoc) {
        stubs.push({ from: conn.from, to: conn.to, known: false });
        continue;
      }
      if (!toHere) {
        // Known room on another floor — labeled stub, not a line.
        stubs.push({ from: conn.from, to: conn.to, known: true });
        continue;
      }
      const key = [conn.from, conn.to].sort().join("~");
      const existing = byPair.get(key);
      if (existing) {
        existing.open = existing.open && conn.open;
      } else {
        byPair.set(key, { a: conn.from, b: conn.to, open: conn.open });
      }
    }
    return { lines: [...byPair.values()], stubs };
  }, [map.connections, map.locations, placed]);

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
        {/* Door lines under the rooms */}
        {doors.lines.map((d) => {
          const a = placed.roomCenter.get(d.a)!;
          const b = placed.roomCenter.get(d.b)!;
          const mx = (a.cx + b.cx) / 2;
          const my = (a.cy + b.cy) / 2;
          return (
            <g key={`${d.a}-${d.b}`}>
              <line
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                className={d.open ? styles.doorOpen : styles.doorClosed}
              />
              {!d.open ? (
                <rect
                  x={mx - 4}
                  y={my - 4}
                  width={8}
                  height={8}
                  className={styles.lockGlyph}
                />
              ) : null}
            </g>
          );
        })}

        {/* Stubs: doors never taken (?) or stairs to another floor (named) */}
        {doors.stubs.map((s, i) => {
          const from = placed.roomCenter.get(s.from)!;
          const seed = hashSeed(`${s.from}->${s.to}`);
          const angle = ((seed % 8) * Math.PI) / 4;
          const ex = from.cx + Math.cos(angle) * STUB_LEN;
          const ey = from.cy + Math.sin(angle) * STUB_LEN;
          const label = s.known
            ? (map.locations.find((l) => l.id === s.to)?.name ?? "?")
            : "?";
          return (
            <g key={`stub-${i}`}>
              <line
                x1={from.cx}
                y1={from.cy}
                x2={ex}
                y2={ey}
                className={styles.stub}
              />
              <text x={ex} y={ey - 4} className={styles.stubLabel}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Rooms */}
        {placed.rooms.map((r) => {
          const c = placed.roomCenter.get(r.id)!;
          const seed = hashSeed(r.id);
          const rotate = (seed % 5) - 2;
          const isCurrent = r.id === map.currentLocationId;
          const cls = isCurrent
            ? styles.roomCurrent
            : r.visited
              ? styles.roomVisited
              : styles.roomHeard;
          return (
            <g
              key={r.id}
              transform={`rotate(${rotate} ${c.cx} ${c.cy})`}
            >
              <rect
                x={c.cx - ROOM_W / 2}
                y={c.cy - ROOM_H / 2}
                width={ROOM_W}
                height={ROOM_H}
                rx={3}
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
              <text x={c.cx} y={c.cy + 4} className={styles.roomLabel}>
                {r.name}
              </text>
              {isCurrent ? (
                <g className={styles.youAreHere}>
                  <circle cx={c.cx} cy={c.cy - ROOM_H / 2 - 12} r={4} />
                  <text x={c.cx} y={c.cy - ROOM_H / 2 - 22}>
                    you are here
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {here ? null : (
          <text x={PAD} y={placed.height - 12} className={styles.elsewhere}>
            You are on another floor.
          </text>
        )}
      </svg>

      <p className={styles.legend}>
        solid ink — visited · dashed — heard of it · red dash + square — locked
        door · ? — door never taken
      </p>
    </div>
  );
}
