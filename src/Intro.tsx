import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./intro.css";

// A once-per-session cinematic opener (~9s). Letterbox bars close in, a lone
// star ignites in the dark, nebula clouds swell, the camera punches into warp
// speed, a white-hot flash and shockwave hit, and SatyaAI blooms out of the
// light with a lens flare. Tap, click or press any key to skip.

const SEEN_KEY = "satya-intro-seen";
const TAU = Math.PI * 2;
const TINTS: Array<[number, number, number]> = [
  [255, 255, 255],
  [205, 218, 255],
  [190, 176, 255],
  [160, 222, 255],
];
const STREAK_CSS = TINTS.map((c) => "rgb(" + c.join(",") + ")");
const WORD = "SatyaAI";

// Timeline in seconds.
const T_WARP = 2.7; // engines spool up
const T_PEAK = 4.3; // full warp
const T_HIT = 4.6; // flash, shockwave and hard brake
const T_SETTLE = 6.4; // stars have come to rest
const T_EXIT = 8.8; // overlay starts to leave
const STAGES = [0, 0.9, T_WARP, 4.75, 5.5, 6.8]; // s1 line, s2 warp, s3 logo, s4 word, s5 tagline
const MOBILE_STAGES = [0, 1.15, 3.2, 5.1, 6.35, 7.75]; // slower mobile reveals with a longer breathing room
const MOBILE_T_EXIT = 11.6; // hold the completed mobile brand reveal before fading out
const EXIT_MS = 1200;
const SKIP_EXIT_MS = 500;

type Star = { x: number; y: number; z: number; zv: number; r: number; b: number; ci: number; tw: number; chroma: boolean };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
// Always a well-formed colour string (no exponent notation, alpha in range).
const rgba = (r: number, g: number, b: number, a: number) =>
  "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + clamp01(a).toFixed(3) + ")";

function shouldPlay(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const stored = localStorage.getItem("satya-preferences-v1");
    if (stored && JSON.parse(stored)?.reduceMotion === true) return false;
    if (sessionStorage.getItem(SEEN_KEY)) return false;
  } catch {
    /* storage blocked: just play it */
  }
  return true;
}

// Camera speed: a slow drift, a long cubic ignition, a hold, then a hard brake.
function speedAt(t: number): number {
  if (t < T_WARP) return 0.012 + 0.02 * smooth(t / T_WARP);
  if (t < T_PEAK) {
    const k = (t - T_WARP) / (T_PEAK - T_WARP);
    return 0.03 + 0.97 * k * k * k;
  }
  if (t < T_HIT) return 1;
  const k = clamp01((t - T_HIT) / (T_SETTLE - T_HIT));
  return 0.014 + 0.986 * Math.pow(1 - k, 3.2);
}

// White-hot flash: swells into the hit, then burns off.
function flashAt(t: number): number {
  if (t < 4.2 || t > 5.7) return 0;
  if (t < T_HIT) return smooth((t - 4.2) / (T_HIT - 4.2));
  return Math.pow(1 - clamp01((t - T_HIT) / 1.0), 2.4);
}

// Value-noise fbm, used once to paint the nebula clouds.
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    sum += amp * vnoise(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
function makeNebula(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(size, size);
  const d = img.data;
  const sa = Math.random() * 500;
  const sb = Math.random() * 500;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm(u * 3 + sa, v * 3 + sa);
      const n2 = fbm(u * 2.2 + sb, v * 2.2 + sb);
      const dens = smooth((n1 - 0.4) / 0.42);
      const edge = Math.pow(Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 0.7);
      const a = dens * dens * edge;
      const m = clamp01(n2 * 1.7 - 0.25);
      const hot = smooth((n1 - 0.62) / 0.2) * 0.6;
      const i = (y * size + x) * 4;
      d[i] = 118 + (66 - 118) * m + 90 * hot;
      d[i + 1] = 78 + (196 - 78) * m - 20 * hot;
      d[i + 2] = 238 + (255 - 238) * m;
      d[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeSprite(rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return c;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, rgba(255, 255, 255, 1));
  grad.addColorStop(0.1, rgba(rgb[0], rgb[1], rgb[2], 0.95));
  grad.addColorStop(0.3, rgba(rgb[0], rgb[1], rgb[2], 0.26));
  grad.addColorStop(0.65, rgba(rgb[0], rgb[1], rgb[2], 0.06));
  grad.addColorStop(1, rgba(rgb[0], rgb[1], rgb[2], 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function Intro() {
  const [phase, setPhase] = useState<"off" | "play" | "exit" | "skip">(() => (shouldPlay() ? "play" : "off"));

  // Keep the app hidden for the complete phone intro, including its exit fade.
  // Desktop retains its existing mount-time behaviour.
  useEffect(() => {
    const phone = window.matchMedia("(pointer: coarse) and (max-width: 760px)").matches;
    if (phone && phase !== "off") {
      document.documentElement.classList.add("satya-intro-pending");
    } else {
      document.documentElement.classList.remove("satya-intro-pending");
    }
  }, [phase]);
  const [stage, setStage] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const running = phase !== "off";

  useEffect(() => {
    if (!running) return;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      setPhase("off");
      return;
    }

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const mobileIntro = window.matchMedia("(pointer: coarse) and (max-width: 760px)").matches;
    const stageTimes = mobileIntro ? MOBILE_STAGES : STAGES;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    const sprites = TINTS.map(makeSprite);
    const nebula = makeNebula(coarse ? 160 : 256);
    let w = 0;
    let h = 0;
    let diag = 1;
    let f = 1;
    let cx = 0;
    let cy = 0;
    let stars: Star[] = [];
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    let push = 0;
    let stageNow = 0;

    const spawn = (s: Star, initial: boolean) => {
      s.x = (Math.random() * 2 - 1) * 1.05;
      s.y = (Math.random() * 2 - 1) * 1.05;
      s.z = initial ? 0.3 + Math.random() * 0.7 : 0.92 + Math.random() * 0.08;
    };
    const makeStar = (): Star => {
      const s: Star = {
        x: 0,
        y: 0,
        z: 1,
        zv: 0.7 + Math.random() * 0.6,
        r: 0.45 + Math.pow(Math.random(), 2.4) * 1.5,
        b: 0.45 + Math.random() * 0.55,
        ci: Math.floor(Math.random() * TINTS.length),
        tw: Math.random() * TAU,
        chroma: Math.random() < 0.3,
      };
      spawn(s, true);
      return s;
    };
    function resize() {
      // Mobile browsers change their visual viewport as browser chrome expands/collapses.
      const visual = coarse ? window.visualViewport : null;
      w = Math.round(visual?.width || window.innerWidth);
      h = Math.round(visual?.height || window.innerHeight);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      diag = Math.hypot(w, h);
      f = diag * 0.4;
      cx = w / 2;
      cy = h * (coarse ? 0.47 : 0.46);
      stars = Array.from({ length: mobileIntro ? 240 : coarse ? 380 : 720 }, makeStar);
    }

    function drawNebula(x: number, y: number, size: number, rot: number) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(rot);
      ctx!.drawImage(nebula, -size / 2, -size / 2, size, size);
      ctx!.restore();
    }
    // Anamorphic lens streak: a very flat, very wide glow.
    function drawFlare(k: number, squash: number, reach: number) {
      if (k < 0.01) return;
      const R = w * reach;
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.scale(1, squash);
      const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, rgba(235, 242, 255, 0.95 * k));
      g.addColorStop(0.18, rgba(150, 190, 255, 0.5 * k));
      g.addColorStop(1, rgba(110, 140, 255, 0));
      ctx!.fillStyle = g;
      ctx!.fillRect(-R, -R, R * 2, R * 2);
      ctx!.restore();
    }

    function frame(now: number) {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      let st = 0;
      for (let i = 1; i < stageTimes.length; i++) if (t >= stageTimes[i]) st = i;
      if (st !== stageNow) {
        stageNow = st;
        setStage(st);
      }

      const v = speedAt(t);
      const flash = flashAt(t);
      const hit = t >= T_HIT ? t - T_HIT : -1;

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = 1;
      ctx!.clearRect(0, 0, w, h);

      // Camera shake: rumble through warp, a hard kick on the hit.
      const amp = 2.2 * v * v + (hit >= 0 ? 8 * Math.exp(-hit * 7) : 0);
      ctx!.save();
      if (amp > 0.05) {
        ctx!.translate(
          (Math.sin(t * 63) + Math.sin(t * 41 + 1.3)) * 0.5 * amp,
          (Math.sin(t * 57 + 0.7) + Math.sin(t * 35)) * 0.5 * amp,
        );
      }
      ctx!.globalCompositeOperation = "lighter";

      // Nebula: two slowly turning cloud layers that the camera pushes through.
      push = Math.min(1.2, push + dt * (0.02 + 0.35 * v * v));
      const nebIn = smooth((t - 0.9) / 2.4);
      const boost = Math.min(1.4, 0.6 + 0.5 * v + 0.8 * flash);
      if (nebIn > 0.01) {
        ctx!.globalAlpha = Math.min(1, nebIn * 0.5 * boost);
        drawNebula(cx, cy, diag * (1.15 + push * 0.5), t * 0.012);
        ctx!.globalAlpha = Math.min(1, nebIn * 0.32 * boost);
        drawNebula(cx + w * 0.07, cy - h * 0.05, diag * (1.7 + push * 0.8), -0.5 - t * 0.008);
      }

      // Core glow that swells with speed and the flash.
      if (t > 0.3) {
        const k = clamp01(0.1 + 0.5 * v + 0.7 * flash);
        const R = Math.min(w, h) * (0.3 + 0.4 * v + 0.35 * flash);
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, rgba(205, 190, 255, 0.55 * k));
        g.addColorStop(0.45, rgba(125, 112, 255, 0.2 * k));
        g.addColorStop(1, rgba(94, 200, 255, 0));
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = g;
        ctx!.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // The lone ignition star at the very start.
      const ign = smooth(t / 0.7) * (1 - smooth((t - 2.3) / 1.0));
      if (ign > 0.01) {
        const R = 30 + 6 * Math.sin(t * 4.2) + v * 40;
        ctx!.globalAlpha = ign * 0.95;
        ctx!.drawImage(sprites[1], cx - R, cy - R, R * 2, R * 2);
      }

      // Stars, in true perspective: z shrinks, so they accelerate toward you.
      const appear = smooth((t - 0.5) / 1.4);
      ctx!.lineCap = "round";
      for (const s of stars) {
        s.z -= dt * 1.5 * v * s.zv;
        if (s.z < 0.04) spawn(s, false);
        const sx = cx + (s.x * f) / s.z;
        const sy = cy + (s.y * f) / s.z;
        if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) {
          spawn(s, false);
          continue;
        }
        const depth = 1 - s.z;
        const rad = s.r * (0.55 + depth * 1.5);
        const born = smooth(depth / 0.08);
        const tw = v < 0.3 ? 0.72 + 0.28 * Math.sin(t * (1.6 + (s.tw % 1.5)) + s.tw) : 1;
        const alpha = clamp01(s.b * born * appear * tw * Math.min(1, 0.35 + depth * 1.2));
        if (alpha < 0.01) continue;

        const L = v * v * (mobileIntro ? 0.16 : 0.34) * s.zv;
        if (L > 0.004) {
          const zt = Math.min(1.5, s.z + L);
          let tx = cx + (s.x * f) / zt;
          let ty = cy + (s.y * f) / zt;
          let dx = sx - tx;
          let dy = sy - ty;
          let len = Math.hypot(dx, dy);
          // Keep phone streaks atmospheric rather than turning the portrait
          // screen into a wall of long, chaotic lines.
          if (mobileIntro && len > 42) {
            const keep = 42 / len;
            tx = sx - dx * keep;
            ty = sy - dy * keep;
            dx = sx - tx;
            dy = sy - ty;
            len = 42;
          }
          if (len > 0.8) {
            ctx!.lineWidth = Math.max(0.6, rad * 0.9);
            ctx!.strokeStyle = STREAK_CSS[s.ci];
            ctx!.globalAlpha = alpha * 0.8;
            ctx!.beginPath();
            ctx!.moveTo(tx, ty);
            ctx!.lineTo(sx, sy);
            ctx!.stroke();
            if (s.chroma && v > 0.45) {
              // Chromatic fringing: red and blue ghosts split off the streak.
              const ox = (-dy / len) * 1.5 * v;
              const oy = (dx / len) * 1.5 * v;
              ctx!.globalAlpha = alpha * 0.35;
              ctx!.strokeStyle = "rgb(255,80,120)";
              ctx!.beginPath();
              ctx!.moveTo(tx + ox, ty + oy);
              ctx!.lineTo(sx + ox, sy + oy);
              ctx!.stroke();
              ctx!.strokeStyle = "rgb(80,170,255)";
              ctx!.beginPath();
              ctx!.moveTo(tx - ox, ty - oy);
              ctx!.lineTo(sx - ox, sy - oy);
              ctx!.stroke();
            }
          }
        }
        const R = rad * 6;
        ctx!.globalAlpha = alpha;
        ctx!.drawImage(sprites[s.ci], sx - R, sy - R, R * 2, R * 2);
      }

      // Lens flare: blazes on the hit, lingers behind the logo.
      const flareK = clamp01(flash + (hit >= 0 ? 0.35 * Math.exp(-hit * 0.7) : 0) + 0.12 * v);
      ctx!.globalAlpha = 1;
      drawFlare(flareK, 0.045, 0.78);
      drawFlare(flareK * flareK, 0.012, 0.95);

      // Shockwave rings expanding from the hit.
      if (hit >= 0 && hit < 1.8) {
        const p = hit / 1.8;
        const rr = (1 - Math.pow(1 - p, 3)) * diag * 0.62;
        ctx!.lineWidth = 16 * (1 - p) + 2;
        ctx!.globalAlpha = Math.pow(1 - p, 2) * 0.12;
        ctx!.strokeStyle = rgba(150, 160, 255, 1);
        ctx!.beginPath();
        ctx!.arc(cx, cy, rr, 0, TAU);
        ctx!.stroke();
        ctx!.lineWidth = 1.6;
        ctx!.globalAlpha = Math.pow(1 - p, 1.6) * 0.75;
        ctx!.strokeStyle = rgba(190, 220, 255, 1);
        ctx!.beginPath();
        ctx!.arc(cx, cy, rr, 0, TAU);
        ctx!.stroke();
      }
      ctx!.restore();

      // The flash itself, drawn without shake so the whole frame whites out.
      if (flash > 0.01) {
        const R = diag * 0.8;
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, rgba(255, 255, 255, 0.95 * flash));
        g.addColorStop(0.35, rgba(225, 215, 255, 0.7 * flash));
        g.addColorStop(1, rgba(150, 140, 255, 0.28 * flash));
        ctx!.globalCompositeOperation = "source-over";
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    if (coarse && window.visualViewport) {
      window.visualViewport.addEventListener("resize", resize);
    }
    raf = requestAnimationFrame(frame);
    const toExit = window.setTimeout(() => {
      if (phaseRef.current === "play") setPhase("exit");
    }, (mobileIntro ? MOBILE_T_EXIT : T_EXIT) * 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(toExit);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      if (coarse && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", resize);
      }
    };
  }, [running]);

  // Skip with any tap, click or key.
  useEffect(() => {
    if (phase !== "play") return;
    const skip = () => setPhase((p) => (p === "play" ? "skip" : p));
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [phase]);

  // Unmount once the exit transition has finished.
  useEffect(() => {
    if (phase !== "exit" && phase !== "skip") return;
    const id = window.setTimeout(() => setPhase("off"), (phase === "skip" ? SKIP_EXIT_MS : EXIT_MS) + 80);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "off") return null;
  const stageClasses = Array.from({ length: stage }, (_, i) => "s" + (i + 1)).join(" ");
  return (
    <div className={"intro " + phase + " " + stageClasses} aria-hidden="true">
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-rays" />
      <div className="intro-vig" />
      <div className="intro-bar top" />
      <div className="intro-bar bottom" />
      <p className="intro-line">Curiosity has no speed limit.</p>
      <div className="intro-center">
        <div className="intro-mark">
          <img src="/brand/satyaai-cosmic-mark.svg" alt="" />
        </div>
        <div className="intro-word">
          {WORD.split("").map((ch, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>{ch}</span>
          ))}
        </div>
        <p className="intro-tag">Truth-first AI for curious minds</p>
      </div>
      <span className="intro-skip">Tap to skip</span>
    </div>
  );
}
