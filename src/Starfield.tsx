import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number; // depth: small = far away, 1 = closest
  dm: number; // drift multiplier (0 for the milky-way band so it holds its shape)
  r: number;
  base: number;
  speed: number;
  phase: number;
  color: string;
  glint: boolean;
  fx: number; // final on-screen position
  fy: number;
  ox: number; // spring offset caused by the cursor / taps
  oy: number;
  vx: number;
  vy: number;
};
type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; len: number };
type Dust = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string };
type Ripple = { x: number; y: number; age: number };

const TAU = Math.PI * 2;
const COLORS = ["255,255,255", "205,218,255", "190,176,255", "160,222,255"];
const DUST_COLORS = ["150,130,255", "110,200,255", "205,195,255"];
const SKIP_TAP = "button, a, input, textarea, select, label, [role=option], .sidebar";
const BAND_ANGLE = -0.42;
const REPEL_RADIUS = 170;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// A living night sky that responds to you: stars part around the cursor like
// water, a trail of stardust follows it, taps and clicks send a ripple
// through the sky, and everything drifts with parallax. A faint milky way,
// shooting stars and constellation lines complete the scene.
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
    const dust: Dust[] = [];
    const ripples: Ripple[] = [];
    let raf = 0;
    let lastNow = 0;
    let clock = 0; // twinkle clock, runs faster when the AI is thinking
    let drift = 0;
    let energy = 0;
    let nextMeteor = 1.6;
    let trailCarry = 0;
    const pointer = { nx: 0, ny: 0, tx: 0, ty: 0, x: -9999, y: -9999, on: false, seen: false };

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(70, Math.min(coarse ? 170 : 320, Math.round((w * h) / (coarse ? 8200 : 5800))));
      const diag = Math.hypot(w, h);
      stars = Array.from({ length: count }, () => {
        const inBand = Math.random() < 0.34;
        const depth = Math.random();
        const z = inBand ? 0.3 : depth < 0.5 ? 0.3 : depth < 0.82 ? 0.62 : 1;
        let x = Math.random() * w;
        let y = Math.random() * h;
        if (inBand) {
          const t = (Math.random() - 0.5) * diag * 1.1;
          const n = (Math.random() + Math.random() + Math.random() - 1.5) * h * 0.17;
          x = w * 0.5 + t * Math.cos(BAND_ANGLE) - n * Math.sin(BAND_ANGLE);
          y = h * 0.52 + t * Math.sin(BAND_ANGLE) + n * Math.cos(BAND_ANGLE);
        }
        const r = (0.35 + Math.pow(Math.random(), 2.2) * 1.5) * (0.6 + z * 0.65) * (inBand ? 0.78 : 1);
        return {
          x,
          y,
          z,
          dm: inBand ? 0 : 1,
          r,
          base: (0.3 + Math.random() * 0.65) * (inBand ? 0.85 : 1),
          speed: 0.6 + Math.random() * 2.4,
          phase: Math.random() * TAU,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          glint: !inBand && r > 1.25 && Math.random() < 0.65,
          fx: x,
          fy: y,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
        };
      });
    }

    function drawMilkyWay() {
      const diag = Math.hypot(w, h);
      const half = Math.max(w, h) * 0.2;
      const grad = ctx!.createLinearGradient(0, -half, 0, half);
      grad.addColorStop(0, "rgba(150,140,255,0)");
      grad.addColorStop(0.5, "rgba(175,165,255,0.085)");
      grad.addColorStop(1, "rgba(150,140,255,0)");
      ctx!.save();
      ctx!.translate(w * 0.5 - pointer.nx * 10, h * 0.52 - pointer.ny * 8);
      ctx!.rotate(BAND_ANGLE);
      ctx!.globalAlpha = 0.85 + 0.15 * Math.sin(clock * 0.3);
      ctx!.fillStyle = grad;
      ctx!.fillRect(-diag, -half, diag * 2, half * 2);
      ctx!.restore();
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

    function spawnDust(x: number, y: number, count: number, burst: boolean) {
      for (let i = 0; i < count && dust.length < 160; i++) {
        const angle = Math.random() * TAU;
        const speed = burst ? rand(60, 230) : rand(6, 40);
        dust.push({
          x: x + (burst ? 0 : rand(-4, 4)),
          y: y + (burst ? 0 : rand(-4, 4)),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (burst ? 0 : 8),
          age: 0,
          life: burst ? rand(0.6, 1.1) : rand(0.7, 1.4),
          size: burst ? rand(0.9, 2) : rand(0.7, 1.7),
          color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)],
        });
      }
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
      drawMilkyWay();

      for (const s of stars) {
        const px = s.dm * drift * s.z - pointer.nx * 30 * s.z;
        const py = s.dm * drift * 0.22 * s.z - pointer.ny * 20 * s.z;
        const bx = (((s.x + px) % w) + w) % w;
        const by = (((s.y + py) % h) + h) % h;

        if (dt > 0) {
          // The cursor parts the stars like water; they spring back afterwards.
          if (pointer.on) {
            const dx = bx + s.ox - pointer.x;
            const dy = by + s.oy - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < REPEL_RADIUS * REPEL_RADIUS && d2 > 1) {
              const d = Math.sqrt(d2);
              const k = 1 - d / REPEL_RADIUS;
              const force = k * k * 1100 * s.z * dt;
              s.vx += (dx / d) * force;
              s.vy += (dy / d) * force;
            }
          }
          s.vx += (-s.ox * 16 - s.vx * 5.5) * dt;
          s.vy += (-s.oy * 16 - s.vy * 5.5) * dt;
          s.ox += s.vx * dt;
          s.oy += s.vy * dt;
        }
        s.fx = bx + s.ox;
        s.fy = by + s.oy;

        const tw = 0.5 + 0.5 * Math.sin(clock * s.speed + s.phase);
        let alpha = s.base * (0.25 + 0.75 * tw);
        let radius = s.r * (0.85 + 0.3 * tw);
        if (pointer.on) {
          const d = Math.hypot(s.fx - pointer.x, s.fy - pointer.y);
          if (d < 190) {
            const k = 1 - d / 190;
            alpha = Math.min(1, alpha + k * 0.5);
            radius *= 1 + k * 0.7;
          }
        }
        ctx!.fillStyle = "rgb(" + s.color + ")";
        if (radius > 0.9) {
          ctx!.globalAlpha = alpha * 0.16;
          ctx!.beginPath();
          ctx!.arc(s.fx, s.fy, radius * 3.2, 0, TAU);
          ctx!.fill();
        }
        ctx!.globalAlpha = alpha;
        ctx!.beginPath();
        ctx!.arc(s.fx, s.fy, radius, 0, TAU);
        ctx!.fill();
        if (s.glint) {
          const len = radius * (4 + tw * 6);
          ctx!.globalAlpha = alpha * 0.55 * tw;
          ctx!.strokeStyle = "rgb(" + s.color + ")";
          ctx!.lineWidth = 0.6;
          ctx!.beginPath();
          ctx!.moveTo(s.fx - len, s.fy);
          ctx!.lineTo(s.fx + len, s.fy);
          ctx!.moveTo(s.fx, s.fy - len);
          ctx!.lineTo(s.fx, s.fy + len);
          ctx!.stroke();
        }
      }

      // Faint constellation lines around the cursor or finger.
      if (pointer.on) {
        const near: Star[] = [];
        for (const s of stars) {
          if (s.z > 0.5 && Math.hypot(s.fx - pointer.x, s.fy - pointer.y) < 200) near.push(s);
          if (near.length >= 18) break;
        }
        ctx!.lineWidth = 0.7;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const d = Math.hypot(near[i].fx - near[j].fx, near[i].fy - near[j].fy);
            if (d < 130) {
              ctx!.globalAlpha = (1 - d / 130) * 0.3;
              ctx!.strokeStyle = "rgb(150,190,255)";
              ctx!.beginPath();
              ctx!.moveTo(near[i].fx, near[i].fy);
              ctx!.lineTo(near[j].fx, near[j].fy);
              ctx!.stroke();
            }
          }
        }
      }

      if (!still) {
        // Stardust: the cursor trail and tap sparks.
        ctx!.globalCompositeOperation = "lighter";
        for (let i = dust.length - 1; i >= 0; i--) {
          const p = dust[i];
          p.age += dt;
          if (p.age >= p.life) {
            dust.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - Math.min(1, 1.8 * dt);
          p.vy *= 1 - Math.min(1, 1.8 * dt);
          const k = 1 - p.age / p.life;
          ctx!.globalAlpha = k * k * 0.9;
          ctx!.fillStyle = "rgb(" + p.color + ")";
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * (0.5 + k * 0.7), 0, TAU);
          ctx!.fill();
          ctx!.globalAlpha = k * k * 0.18;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * 3.4, 0, TAU);
          ctx!.fill();
        }

        // Ripples from taps and clicks.
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.age += dt;
          const p = r.age / 1.15;
          if (p >= 1) {
            ripples.splice(i, 1);
            continue;
          }
          const radius = p * (2 - p) * 280;
          ctx!.lineWidth = 0.5 + 1.1 * (1 - p);
          ctx!.globalAlpha = (1 - p) * 0.55;
          ctx!.strokeStyle = "rgb(165,180,255)";
          ctx!.beginPath();
          ctx!.arc(r.x, r.y, radius, 0, TAU);
          ctx!.stroke();
          ctx!.globalAlpha = (1 - p) * 0.3;
          ctx!.strokeStyle = "rgb(120,210,255)";
          ctx!.beginPath();
          ctx!.arc(r.x, r.y, radius * 0.62, 0, TAU);
          ctx!.stroke();
        }
        ctx!.globalCompositeOperation = "source-over";

        // Shooting stars.
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

    const overSidebar = (event: Event) => (event.target as Element | null)?.closest?.(".sidebar") != null;
    const onMove = (event: PointerEvent) => {
      if (reduce.matches) return;
      if (overSidebar(event)) {
        onLeave();
        return;
      }
      if (pointer.seen && pointer.on) {
        trailCarry += Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
        while (trailCarry > 16) {
          trailCarry -= 16;
          spawnDust(event.clientX, event.clientY, 1, false);
        }
      }
      pointer.on = true;
      pointer.seen = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.tx = (event.clientX / w - 0.5) * 2;
      pointer.ty = (event.clientY / h - 0.5) * 2;
    };
    const onDown = (event: PointerEvent) => {
      if (reduce.matches || overSidebar(event)) return;
      pointer.on = true;
      pointer.seen = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if ((event.target as Element | null)?.closest?.(SKIP_TAP)) return;
      ripples.push({ x: event.clientX, y: event.clientY, age: 0 });
      if (ripples.length > 4) ripples.shift();
      spawnDust(event.clientX, event.clientY, 16, true);
      for (const s of stars) {
        const dx = s.fx - event.clientX;
        const dy = s.fy - event.clientY;
        const d = Math.hypot(dx, dy);
        if (d < 340 && d > 1) {
          const k = Math.pow(1 - d / 340, 1.5);
          s.vx += (dx / d) * k * 520 * s.z;
          s.vy += (dy / d) * k * 520 * s.z;
        }
      }
    };
    function onLeave() {
      pointer.on = false;
      pointer.seen = false;
      pointer.tx = 0;
      pointer.ty = 0;
      trailCarry = 0;
    }
    const onUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") onLeave();
    };
    const onResize = () => {
      resize();
      if (reduce.matches) frame(performance.now(), true);
    };

    resize();
    start();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    reduce.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      reduce.removeEventListener("change", start);
    };
  }, [active]);

  return <canvas ref={canvasRef} className={"starfield" + (active ? "" : " off")} aria-hidden="true" />;
}
