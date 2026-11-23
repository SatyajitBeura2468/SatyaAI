import { useEffect, useRef, useState } from "react";
import "./intro.css";

// A once-per-session cinematic opener: the camera punches through a field of
// stars at warp speed, brakes into a calm night sky, and SatyaAI blooms out of
// the light. Tap, click or press any key to skip.

const SEEN_KEY = "satya-intro-seen";
const TAU = Math.PI * 2;
const COLORS = ["255,255,255", "205,218,255", "190,176,255", "160,222,255"];
const WORD = "SatyaAI";

// Timeline in seconds.
const T_PEAK = 1.5; // top warp speed
const T_BRAKE = 3.0; // stars have settled
const T_EXIT = 4.7; // overlay starts to leave
const EXIT_MS = 1000;
const SKIP_EXIT_MS = 450;

type Star = { a: number; d: number; z: number; color: string; r: number; tw: number };

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

// Warp speed over time: a slow ignition, a long burn, then a smooth brake.
function speedAt(t: number): number {
  if (t < T_PEAK) {
    const k = t / T_PEAK;
    return 0.06 + 0.94 * k * k * (3 - 2 * k);
  }
  if (t < T_BRAKE) {
    const k = (t - T_PEAK) / (T_BRAKE - T_PEAK);
    const e = 1 - k;
    return 0.02 + 0.98 * e * e * e;
  }
  return 0.02;
}

export function Intro() {
  const [phase, setPhase] = useState<"off" | "play" | "exit" | "skip">(() => (shouldPlay() ? "play" : "off"));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Drive the canvas and the timeline.
  useEffect(() => {
    if (phase === "off") return;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      setPhase("off");
      return;
    }

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    let w = 0;
    let h = 0;
    let maxR = 1;
    let stars: Star[] = [];
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    let pos = 0; // integrated warp distance, keeps motion smooth through speed changes

    const spawn = (near = false): Star => ({
      a: Math.random() * TAU,
      d: near ? Math.random() * 0.06 : Math.random(),
      z: 0.35 + Math.random() * 0.65,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      r: 0.5 + Math.pow(Math.random(), 2.4) * 1.5,
      tw: Math.random() * TAU,
    });
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxR = Math.hypot(w, h) * 0.55;
      const count = coarse ? 240 : 420;
      stars = Array.from({ length: count }, () => spawn());
    }

    function frame(now: number) {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = speedAt(t);
      pos += v * dt;
      const cx = w / 2;
      const cy = h * 0.46;

      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = 1;
      ctx!.clearRect(0, 0, w, h);

      // Core glow: swells at full speed, settles into a soft halo behind the logo.
      const swell = t < T_BRAKE ? 0.25 + 0.55 * v : 0.22 + 0.1 * Math.sin((t - T_BRAKE) * 1.6);
      const glowR = Math.min(w, h) * (0.35 + 0.25 * v);
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      g.addColorStop(0, "rgba(190,176,255," + 0.5 * swell + ")");
      g.addColorStop(0.45, "rgba(120,110,255," + 0.2 * swell + ")");
      g.addColorStop(1, "rgba(94,200,255,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      ctx!.globalCompositeOperation = "lighter";
      const fadeIn = Math.min(1, t / 0.5);
      for (const s of stars) {
        // Stars accelerate away from the centre; the closer ones move faster.
        const grow = 0.15 + s.d * s.d * 3.2;
        s.d += v * dt * 0.9 * s.z * grow;
        if (s.d > 1) Object.assign(s, spawn(true));
        const cos = Math.cos(s.a);
        const sin = Math.sin(s.a);
        const dist = s.d * maxR;
        const x = cx + cos * dist;
        const y = cy + sin * dist;
        const streak = Math.max(0, v * v * (10 + s.d * 220) * s.z);
        const tail = Math.max(0, dist - streak);
        const near = Math.min(1, s.d * 3.2);
        const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + s.tw);
        const alpha = Math.min(1, near * s.z * 1.1) * fadeIn * (v > 0.2 ? 1 : tw);
        if (alpha <= 0.01) continue;
        ctx!.strokeStyle = "rgb(" + s.color + ")";
        ctx!.fillStyle = "rgb(" + s.color + ")";
        if (streak > 1.5) {
          ctx!.globalAlpha = alpha * 0.85;
          ctx!.lineWidth = s.r * (0.6 + s.d * 1.1);
          ctx!.lineCap = "round";
          ctx!.beginPath();
          ctx!.moveTo(cx + cos * tail, cy + sin * tail);
          ctx!.lineTo(x, y);
          ctx!.stroke();
        }
        const rad = s.r * (0.7 + s.d * 0.9);
        ctx!.globalAlpha = alpha * 0.18;
        ctx!.beginPath();
        ctx!.arc(x, y, rad * 3.4, 0, TAU);
        ctx!.fill();
        ctx!.globalAlpha = alpha;
        ctx!.beginPath();
        ctx!.arc(x, y, rad, 0, TAU);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    const toExit = window.setTimeout(() => {
      if (phaseRef.current === "play") setPhase("exit");
    }, T_EXIT * 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(toExit);
      window.removeEventListener("resize", resize);
    };
  }, [phase === "off"]); // eslint-disable-line react-hooks/exhaustive-deps

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
  return (
    <div className={"intro " + phase} aria-hidden="true">
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-center">
        <div className="intro-mark">
          <svg viewBox="0 0 512 512" width="100%" height="100%">
            <defs>
              <linearGradient id="introG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#9a8bff" />
                <stop offset="1" stopColor="#5ec8ff" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="176" fill="url(#introG)" opacity=".22" />
            <path
              d="M342 164c-22-25-53-38-91-38-67 0-111 35-111 89 0 46 28 69 102 84 51 10 68 20 68 40 0 22-23 36-59 36-38 0-72-15-99-44l-39 46c35 38 83 59 138 59 74 0 121-37 121-96 0-49-30-73-105-88-48-10-65-19-65-38 0-17 19-29 49-29 30 0 56 11 78 33z"
              fill="#fff"
            />
          </svg>
        </div>
        <div className="intro-word">
          {WORD.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: 2.0 + i * 0.07 + "s" }}>{ch}</span>
          ))}
        </div>
        <p className="intro-tag">Truth-first AI for curious minds</p>
      </div>
      <span className="intro-skip">Tap to skip</span>
    </div>
  );
}
