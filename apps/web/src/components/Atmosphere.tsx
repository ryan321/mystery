"use client";

import { useEffect, useRef } from "react";
import styles from "./Atmosphere.module.css";

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
function createDrop(w: number, h: number, randomY: boolean): RainDrop {
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

export default function Atmosphere({
  intensity = 1,
  showManor = true,
}: {
  intensity?: number;
  /** The manor silhouette. The landing frames the house in its hero
      instead, so it turns this off. */
  showManor?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasEl;
    const ctx = ctx2d;

    let drops: RainDrop[] = [];
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
      const count = Math.floor(((w * h) / 6500) * intensity);
      drops = Array.from({ length: count }, () => createDrop(w, h, true));
    }

    function draw(timestamp: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!lastTime) lastTime = timestamp;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x += d.speed * dt * d.angle;
        if (d.y > h + d.len || d.x > w + 20) {
          drops[i] = createDrop(w, h, false);
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
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [intensity]);

  return (
    <div className={styles.atmosphere} aria-hidden="true">
      <div className={styles.glow} />
      <div className={`${styles.fog} ${styles.fogA}`} />
      <div className={`${styles.fog} ${styles.fogB}`} />
      {showManor ? (
        <img className={styles.manor} src="/images/manor-hero.png" alt="" />
      ) : null}
      <canvas ref={canvasRef} className={styles.rain} />
      <div className={styles.lightning} />
      <div className={styles.vignette} />
      <div className={styles.grain} />
    </div>
  );
}
