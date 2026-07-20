"use client";

import { useEffect, useRef } from "react";
import styles from "./Atmosphere.module.css";

type RainDrop = {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
};

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
    const canvas = canvasEl;
    const ctx = ctx2d;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let raf = 0;

    const drops: RainDrop[] = [];
    const count = Math.floor((width * height) / 8000) * intensity;
    for (let i = 0; i < count; i++) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 4 + Math.random() * 6,
        length: 10 + Math.random() * 15,
        opacity: 0.15 + Math.random() * 0.25,
      });
    }

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(180, 200, 220, 0.5)";
      ctx.lineWidth = 1;
      for (const d of drops) {
        ctx.globalAlpha = d.opacity;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.length);
        ctx.stroke();
        d.y += d.speed;
        if (d.y > height) {
          d.y = -d.length;
          d.x = Math.random() * width;
        }
      }
      raf = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    draw();
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
