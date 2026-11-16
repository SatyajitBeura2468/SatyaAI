import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number; // depth: small = far away, 1 = closest
  r: number;
  base: number;
  speed: number;
  phase: number;
  color: string;
  glint: boolean;
  sx: number;
  sy: number;
};
type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; len: number };

const TAU = Math.PI * 2;
const COLORS = ["255,255,255", "205,218,255", "190,176,255", "160,222,255"];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// A living night sky: three parallax depths, individually twinkling stars,
// cross-shaped glints on the brightest ones, shooting stars, and faint
// constellation lines that connect the stars around your cursor.
export function Starfield({ active, busy }: { active: boolean; busy: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];
    let raf = 0;
    let lastNow = 0;
    let clock = 0; // twinkle clock, runs faster when the AI is thinking
    let drift = 0;
    let energy = 0;
    let nextMeteor = 1.6;
    const pointer = { nx: 0, ny: 0, tx: 0, ty: 0, x: -9999, y: -9999, on: false };

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(60, Math.min(coarse ? 150 : 280, Math.round((w * h) / (coarse ? 9000 : 6500))));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        const z = depth < 0.5 ? 0.3 : depth < 0.82 ? 0.62 : 1;
        const r = (0.35 + Math.pow(Math.random(), 2.2) * 1.5) * (0.6 + z * 0.65);
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          r,
          base: 0.3 + Math.random() * 0.65,
          speed: 0.6 + Math.random() * 2.4,
          phase: Math.random() * TAU,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          glint: r > 1.25 && Math.random() < 0.65,
          sx: 0,
          sy: 0,
        };
      });
    }

    function drawMeteor(m: Meteor) {
      const p = m.age / m.life;
      const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const speed = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / speed) * m.len;
      const ty = m.y - (m.vy / speed) * m.len;
      const grad = ctx!.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, "rgba(255,255,255," + 0.95 * fade + ")");
      grad.addColorStop(0.25, "rgba(170,200,255," + 0.45 * fade + ")");
      grad.addColorStop(1, "rgba(140,120,255,0)");
      ctx!.globalAlpha = 1;
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 1.6;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(m.x, m.y);
      ctx!.lineTo(tx, ty);
      ctx!.stroke();
      ctx!.fillStyle = "rgba(255,255,255," + fade + ")";
      ctx!.beginPath();
      ctx!.arc(m.x, m.y, 1.4, 0, TAU);
      ctx!.fill();
    }

    function frame(now: number, still = false) {
      const dt = still ? 0 : Math.min(0.05, (now - lastNow) / 1000 || 0.016);
      lastNow = now;
      energy += ((busyRef.current ? 1 : 0) - energy) * Math.min(1, dt * 2);
      clock += dt * (1 + energy * 1.4);
      drift += dt * (5 + energy * 14);
      const ease = Math.min(1, dt * 3);
      pointer.nx += (pointer.tx - pointer.nx) * ease;
      pointer.ny += (pointer.ty - pointer.ny) * ease;

      ctx!.clearRect(0, 0, w, h);

      for (const s of stars) {
        const px = drift * s.z - pointer.nx * 30 * s.z;
        const py = drift * 0.22 * s.z - pointer.ny * 20 * s.z;
        s.sx = (((s.x + px) % w) + w) % w;
        s.sy = (((s.y + py) % h) + h) % h;
        const tw = 0.5 + 0.5 * Math.sin(clock * s.speed + s.phase);
        let alpha = s.base * (0.25 + 0.75 * tw);
        let radius = s.r * (0.85 + 0.3 * tw);
        if (pointer.on) {
          const d = Math.hypot(s.sx - pointer.x, s.sy - pointer.y);
          if (d < 160) {
            const k = 1 - d / 160;
            alpha = Math.min(1, alpha + k * 0.5);
            radius *= 1 + k * 0.6;
          }
        }
        ctx!.fillStyle = "rgb(" + s.color + ")";
        if (radius > 0.9) {
          ctx!.globalAlpha = alpha * 0.16;
          ctx!.beginPath();
          ctx!.arc(s.sx, s.sy, radius * 3.2, 0, TAU);
          ctx!.fill();
        }
        ctx!.globalAlpha = alpha;
        ctx!.beginPath();
        ctx!.arc(s.sx, s.sy, radius, 0, TAU);
        ctx!.fill();
        if (s.glint) {
          const len = radius * (4 + tw * 6);
          ctx!.globalAlpha = alpha * 0.55 * tw;
          ctx!.strokeStyle = "rgb(" + s.color + ")";
          ctx!.lineWidth = 0.6;
          ctx!.beginPath();
          ctx!.moveTo(s.sx - len, s.sy);
          ctx!.lineTo(s.sx + len, s.sy);
          ctx!.moveTo(s.sx, s.sy - len);
          ctx!.lineTo(s.sx, s.sy + len);
          ctx!.stroke();
        }
      }

      // Faint constellation lines around the cursor.
      if (pointer.on) {
        const near: Star[] = [];
        for (const s of stars) {
          if (s.z > 0.5 && Math.hypot(s.sx - pointer.x, s.sy - pointer.y) < 170) near.push(s);
          if (near.length >= 16) break;
        }
        ctx!.lineWidth = 0.7;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const d = Math.hypot(near[i].sx - near[j].sx, near[i].sy - near[j].sy);
            if (d < 120) {
              ctx!.globalAlpha = (1 - d / 120) * 0.28;
              ctx!.strokeStyle = "rgb(150,190,255)";
              ctx!.beginPath();
              ctx!.moveTo(near[i].sx, near[i].sy);
              ctx!.lineTo(near[j].sx, near[j].sy);
              ctx!.stroke();
            }
          }
        }
      }

      // Shooting stars.
      if (!still) {
        nextMeteor -= dt;
        if (nextMeteor <= 0 && meteors.length < 2) {
          const angle = rand(0.45, 0.8);
          const speed = rand(520, 820);
          meteors.push({
            x: rand(w * 0.25, w * 1.05),
            y: rand(-20, h * 0.3),
            vx: -Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: rand(0.9, 1.5),
            len: rand(110, 210),
          });
          nextMeteor = rand(3, 7.5) / (1 + energy);
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.age += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.age >= m.life) meteors.splice(i, 1);
          else drawMeteor(m);
        }
      }
      ctx!.globalAlpha = 1;
    }

    function loop(now: number) {
      frame(now);
      raf = reduce.matches || document.hidden ? 0 : requestAnimationFrame(loop);
    }
    function start() {
      cancelAnimationFrame(raf);
      lastNow = performance.now();
      if (reduce.matches) {
        frame(lastNow, true);
        raf = 0;
      } else if (!document.hidden) {
        raf = requestAnimationFrame(loop);
      }
    }

    const onMove = (event: PointerEvent) => {
      pointer.on = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.tx = (event.clientX / w - 0.5) * 2;
      pointer.ty = (event.clientY / h - 0.5) * 2;
    };
    const onLeave = () => {
      pointer.on = false;
      pointer.tx = 0;
      pointer.ty = 0;
    };
    const onResize = () => {
      resize();
      if (reduce.matches) frame(performance.now(), true);
    };

    resize();
    start();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    reduce.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      reduce.removeEventListener("change", start);
    };
  }, [active]);

  return <canvas ref={canvasRef} className={"starfield" + (active ? "" : " off")} aria-hidden="true" />;
}
