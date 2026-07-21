"use client";

import { useEffect, useRef } from "react";
import type { AtmosphereTheme } from "../lib/themes";
import styles from "./Atmosphere.module.css";

/**
 * One particle system per theme, all behind the same interface: the
 * component owns canvas sizing + the rAF loop, the effect owns its
 * particles. Noir has no canvas layer at all (fog-only, CSS).
 */
type CanvasEffect = {
  resize(w: number, h: number): void;
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dt: number,
    t: number
  ): void;
};

// ── Manor: rain ─────────────────────────────────────────────────────

type RainDrop = {
  x: number;
  y: number;
  len: number;
  /** px per ms */
  speed: number;
  opacity: number;
  width: number;
  angle: number;
};

/** Depth-layered streak with a faded tail — reads as rain, not dashes. */
function createRainDrop(w: number, h: number, randomY: boolean): RainDrop {
  const z = Math.random(); // depth 0..1
  return {
    x: Math.random() * w,
    y: randomY ? Math.random() * h : -40,
    len: 8 + z * 24,
    speed: (340 + z * 460) / 1000,
    opacity: 0.06 + z * 0.22,
    width: 0.5 + z * 1.3,
    angle: 0.12 + z * 0.07, // slight slant
  };
}

function createRainEffect(intensity: number): CanvasEffect {
  let drops: RainDrop[] = [];
  return {
    resize(w, h) {
      const count = Math.floor(((w * h) / 6500) * intensity);
      drops = Array.from({ length: count }, () => createRainDrop(w, h, true));
    },
    draw(ctx, w, h, dt) {
      ctx.lineCap = "round";
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x += d.speed * dt * d.angle;
        if (d.y > h + d.len || d.x > w + 20) {
          drops[i] = createRainDrop(w, h, false);
          continue;
        }
        const grad = ctx.createLinearGradient(
          d.x,
          d.y,
          d.x - d.len * d.angle,
          d.y - d.len
        );
        grad.addColorStop(0, `rgba(200, 215, 235, ${d.opacity})`);
        grad.addColorStop(1, "rgba(200, 215, 235, 0)");
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = d.width;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * d.angle, d.y - d.len);
        ctx.stroke();
      }
    },
  };
}

// ── Station: starfield ──────────────────────────────────────────────

type Star = {
  x: number;
  y: number;
  r: number;
  baseOpacity: number;
  twinkleSpeed: number;
  phase: number;
  /** px per ms — the slow orbital slide */
  drift: number;
  warm: boolean;
};

function createStarsEffect(intensity: number): CanvasEffect {
  let stars: Star[] = [];
  const make = (w: number, h: number): Star => {
    const z = Math.random(); // depth 0..1
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + z * 1.2,
      baseOpacity: 0.2 + z * 0.55,
      twinkleSpeed: 0.0003 + Math.random() * 0.001,
      phase: Math.random() * Math.PI * 2,
      drift: (1.5 + z * 7) / 1000,
      warm: Math.random() > 0.85,
    };
  };
  return {
    resize(w, h) {
      const count = Math.floor(((w * h) / 4200) * intensity);
      stars = Array.from({ length: count }, () => make(w, h));
    },
    draw(ctx, w, h, dt, t) {
      for (const s of stars) {
        s.x -= s.drift * dt;
        if (s.x < -4) {
          s.x = w + 4;
          s.y = Math.random() * h;
        }
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.phase);
        const o = s.baseOpacity * twinkle;
        ctx.beginPath();
        ctx.fillStyle = s.warm
          ? `rgba(255, 214, 160, ${o})`
          : `rgba(210, 225, 255, ${o})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

// ── Snowfall: snow ──────────────────────────────────────────────────

type Flake = {
  x: number;
  y: number;
  r: number;
  /** px per ms */
  speed: number;
  swayAmp: number;
  swaySpeed: number;
  phase: number;
  opacity: number;
};

function createSnowEffect(intensity: number): CanvasEffect {
  let flakes: Flake[] = [];
  const make = (w: number, h: number, randomY: boolean): Flake => {
    const z = Math.random(); // depth 0..1
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -6,
      r: 0.8 + z * 2.2,
      speed: (24 + z * 62) / 1000,
      swayAmp: 8 + z * 26,
      swaySpeed: 0.00025 + z * 0.0006,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.22 + z * 0.5,
    };
  };
  return {
    resize(w, h) {
      const count = Math.floor(((w * h) / 9000) * intensity);
      flakes = Array.from({ length: count }, () => make(w, h, true));
    },
    draw(ctx, w, h, dt, t) {
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speed * dt;
        if (f.y > h + 6) {
          flakes[i] = make(w, h, false);
          continue;
        }
        const x = f.x + Math.sin(t * f.swaySpeed + f.phase) * f.swayAmp;
        ctx.beginPath();
        ctx.fillStyle = `rgba(232, 240, 250, ${f.opacity})`;
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

// ── Daylight: drifting motes ────────────────────────────────────────

type Mote = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  swayAmp: number;
  swaySpeed: number;
  phase: number;
  opacity: number;
};

function createMotesEffect(intensity: number): CanvasEffect {
  let motes: Mote[] = [];
  const make = (w: number, h: number): Mote => {
    const z = Math.random(); // depth 0..1
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + z * 1.8,
      vx: ((Math.random() - 0.5) * 14) / 1000,
      vy: (-(2 + Math.random() * 8)) / 1000, // gentle rise
      swayAmp: 6 + z * 18,
      swaySpeed: 0.0002 + Math.random() * 0.0005,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.1 + z * 0.22,
    };
  };
  return {
    resize(w, h) {
      // Sparse — pollen and dust in afternoon light, not weather.
      const count = Math.floor(((w * h) / 26000) * intensity);
      motes = Array.from({ length: count }, () => make(w, h));
    },
    draw(ctx, w, h, dt, t) {
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -6) m.y = h + 6;
        if (m.x < -6) m.x = w + 6;
        if (m.x > w + 6) m.x = -6;
        const x = m.x + Math.sin(t * m.swaySpeed + m.phase) * m.swayAmp;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 240, 200, ${m.opacity})`;
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

function createEffect(
  theme: AtmosphereTheme,
  intensity: number
): CanvasEffect | null {
  switch (theme) {
    case "station":
      return createStarsEffect(intensity);
    case "snowfall":
      return createSnowEffect(intensity);
    case "daylight":
      return createMotesEffect(intensity);
    case "noir":
      return null;
    default:
      return createRainEffect(intensity);
  }
}

export default function Atmosphere({
  intensity = 1,
  showManor = true,
  theme = "manor",
}: {
  intensity?: number;
  /** The manor silhouette. The landing frames the house in its hero
      instead, so it turns this off. Only used by the manor theme. */
  showManor?: boolean;
  theme?: AtmosphereTheme;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const effect = createEffect(theme, intensity);
    if (!effect) return;
    const canvas = canvasEl;
    const ctx = ctx2d;

    let raf = 0;
    let lastTime = 0;
    // DPR-aware canvas — crisp streaks on retina displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      effect!.resize(w, h);
    }

    function draw(timestamp: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!lastTime) lastTime = timestamp;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      ctx.clearRect(0, 0, w, h);
      effect!.draw(ctx, w, h, dt, timestamp);
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [intensity, theme]);

  return (
    <div className={styles.atmosphere} data-theme={theme} aria-hidden="true">
      <div className={styles.glow} />
      <div className={`${styles.fog} ${styles.fogA}`} />
      <div className={`${styles.fog} ${styles.fogB}`} />
      {theme === "manor" && showManor ? (
        <img className={styles.manor} src="/images/manor-hero.webp" alt="" />
      ) : null}
      {theme === "station" ? (
        <>
          <div className={styles.planet} />
          <div className={styles.beacon} />
        </>
      ) : null}
      {theme === "snowfall" ? <div className={styles.treeline} /> : null}
      {theme === "daylight" ? (
        <>
          <div className={styles.sun} />
          <div className={`${styles.cloud} ${styles.cloudA}`} />
          <div className={`${styles.cloud} ${styles.cloudB}`} />
        </>
      ) : null}
      {theme !== "noir" ? (
        <canvas ref={canvasRef} className={styles.canvas} />
      ) : null}
      {theme === "manor" ? <div className={styles.lightning} /> : null}
      <div className={styles.vignette} />
      <div className={styles.grain} />
    </div>
  );
}
