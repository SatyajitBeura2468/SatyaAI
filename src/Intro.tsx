import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./intro.css";

// Once-per-session cinematic opener (~15s + a 2s exit, tap/click/Esc to skip).
//  1. Letterbox closes in, a lone star ignites, "Curiosity has no speed limit."
//  2. The camera spools into warp through a breathing nebula.
//  3. White-hot impact: flash, shockwaves, spark burst. The SatyaAI mark draws
//     itself (orbit, crescent, network ribbon, star, planets) while a comet orbits.
//  4. SatyaAI decodes letter by letter out of glyph noise, then a light sweep
//     crosses it. Tagline resolves word by word.
//  5. Exit: light speed, then total dark space. Thousands of tiny blocks spin in out of
//     the black, take on the interface's colours and lock into a grid, then dissolve to
//     reveal the real (already rendered) interface, so it feels assembled, not shown.

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
const AI_FROM = 5;
const OPENING = ["Curiosity", "has no", "speed limit."];
const TAGLINE = ["Truth-first", "AI", "for", "curious", "minds"];
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&@*+=<>/";

// Timeline (seconds).
const T = { line: 2.0, warp: 5.6, peak: 7.9, hit: 8.5, settle: 12.1, word: 10.6, tag: 12.2, calm: 13.2, exit: 14.2 };
const STAGE_AT = [0, T.line, T.warp, T.hit, T.word, T.tag, T.calm]; // stage 1..6
// Exit choreography (seconds after the exit starts): light speed, fade to dark, tile build.
const DARK_AT = 0.9;
const TILE_AT = 1.9;
const TILE_SPREAD = 1.6;
const TILE_LIFE = 1.2;
const EXIT_MS = Math.round((TILE_AT + TILE_SPREAD + TILE_LIFE + 0.2) * 1000);
const SKIP_EXIT_MS = 500;

// Logo orbit (SVG user units, matches the mark's ellipse).
const ORBIT = { cx: 80, cy: 62, rx: 73.5, ry: 20.8, rot: (-18 * Math.PI) / 180 };
const COMET_TRAIL = 14;

type Phase = "off" | "play" | "exit" | "skip";
type Layout = { touch: boolean; portrait: boolean; short: boolean };
type Star = { x: number; y: number; z: number; zv: number; r: number; b: number; ci: number; tw: number; chroma: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; ci: number };
type Tile = { x: number; y: number; d: number; spin: number; turns: number; mode: number; pal: [number, number, number]; spark: [number, number, number] };
type Mote = { x: number; y: number; vy: number; r: number; ph: number; ci: number };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
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

// Display face for the wordmark (Unbounded, SIL OFL). Loaded only when the intro will play.
function loadDisplayFont() {
  try {
    if (document.getElementById("satya-intro-font")) return;
    const link = document.createElement("link");
    link.id = "satya-intro-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Unbounded:wght@300;800&display=swap";
    document.head.appendChild(link);
  } catch {
    /* fall back to Space Grotesk */
  }
}
if (typeof document !== "undefined" && shouldPlay()) loadDisplayFont();

function readLayout(): Layout {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    touch: window.matchMedia("(pointer: coarse)").matches,
    portrait: h > w,
    short: h <= 560,
  };
}

// Camera speed: slow drift, long cubic ignition, hold, then a hard brake.
function speedAt(t: number): number {
  if (t < T.warp) return 0.012 + 0.02 * smooth(t / T.warp);
  if (t < T.peak) {
    const k = (t - T.warp) / (T.peak - T.warp);
    return 0.03 + 0.97 * k * k * k;
  }
  if (t < T.hit) return 1;
  const k = clamp01((t - T.hit) / (T.settle - T.hit));
  return 0.014 + 0.986 * Math.pow(1 - k, 3.2);
}

function flashAt(t: number): number {
  const start = T.hit - 0.8;
  const end = T.hit + 1.8;
  if (t < start || t > end) return 0;
  if (t < T.hit) return smooth((t - start) / (T.hit - start));
  return Math.pow(1 - clamp01((t - T.hit) / 1.8), 2.4);
}

// Value-noise fbm, painted once into nebula textures.
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
type Palette = { a: [number, number, number]; b: [number, number, number]; hot: [number, number, number] };
const COOL: Palette = { a: [118, 78, 238], b: [66, 196, 255], hot: [90, -20, 0] };
const WARM: Palette = { a: [214, 70, 190], b: [90, 110, 255], hot: [40, 30, 30] };
function makeNebula(size: number, pal: Palette): HTMLCanvasElement {
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
      d[i] = pal.a[0] + (pal.b[0] - pal.a[0]) * m + pal.hot[0] * hot;
      d[i + 1] = pal.a[1] + (pal.b[1] - pal.a[1]) * m + pal.hot[1] * hot;
      d[i + 2] = pal.a[2] + (pal.b[2] - pal.a[2]) * m + pal.hot[2] * hot;
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
function makeGrain(): string {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return "";
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 70;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

const INK: [number, number, number] = [5, 6, 11];
const DARK_UI: Array<[number, number, number]> = [[10, 11, 36], [20, 22, 64], [34, 26, 86], [18, 44, 110], [26, 30, 84]];
const LIGHT_UI: Array<[number, number, number]> = [[238, 240, 252], [228, 232, 250], [222, 214, 250], [212, 228, 250], [232, 226, 250]];
const DARK_SPARK: Array<[number, number, number]> = [[120, 200, 255], [170, 140, 255], [255, 255, 255], [110, 235, 255]];
const LIGHT_SPARK: Array<[number, number, number]> = [[150, 170, 255], [190, 150, 255], [120, 200, 255]];
const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
const mix = (a: [number, number, number], b: [number, number, number], k: number) =>
  "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
function interfaceIsLight(): boolean {
  try {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    if (!m) return false;
    const [r, g, b, a = 1] = m.map(Number);
    return a > 0 && 0.299 * r + 0.587 * g + 0.114 * b > 150;
  } catch {
    return false;
  }
}

const UP = "M17 56C22 28 59 8 132 13 103 18 70 29 50 47 35 60 39 72 58 79 31 76 13 67 17 56Z";
const LO = "M67 47C91 47 111 58 116 75c7 22-20 37-88 42 27-10 51-20 60-34 9-14-1-27-21-36Z";
const NODES: Array<[number, number, number]> = [
  [62, 65, 1.25], [83, 53, 1.45], [105, 68, 1.4], [52, 78, 1.2], [75, 68, 1.55], [96, 82, 1.5],
  [48, 91, 1.35], [70, 82, 1.6], [94, 96, 1.6], [46, 105, 1.2], [70, 97, 1.45], [93, 111, 1.2],
];

// The mark, inlined so each part can animate (ids are prefixed to stay unique).
function Logo() {
  return (
    <svg className="sx-logo" viewBox="0 0 160 125" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <linearGradient id="sx-up" x1="25" y1="18" x2="123" y2="63" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".22" stopColor="#9ce9ff" /><stop offset=".58" stopColor="#1679ff" /><stop offset="1" stopColor="#dceaff" />
        </linearGradient>
        <linearGradient id="sx-lo" x1="42" y1="48" x2="104" y2="117" gradientUnits="userSpaceOnUse">
          <stop stopColor="#26aaff" /><stop offset=".36" stopColor="#3636ff" /><stop offset=".72" stopColor="#9029ff" /><stop offset="1" stopColor="#f0a4ff" />
        </linearGradient>
        <linearGradient id="sx-or" x1="7" y1="89" x2="151" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6deaff" /><stop offset=".48" stopColor="#fff" /><stop offset=".76" stopColor="#9f9cff" /><stop offset="1" stopColor="#76dfff" />
        </linearGradient>
        <radialGradient id="sx-pl" cx="0" cy="0" r="1" gradientTransform="matrix(5 5 -5 5 0 0)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".58" stopColor="#d9f5ff" /><stop offset="1" stopColor="#6abfff" />
        </radialGradient>
        <filter id="sx-bloom" x="-35%" y="-45%" width="170%" height="190%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 .20 0 0 0 0 .42 0 0 0 0 1 0 0 0 .85 0" result="tint" />
          <feMerge><feMergeNode in="tint" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sx-sg" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="sx-clip"><path d={LO} /></clipPath>
      </defs>

      <g className="sx-halo" filter="url(#sx-bloom)">
        <path d={UP} fill="#167dff" opacity=".32" />
        <path d={LO} fill="#a12cff" opacity=".38" />
      </g>

      <path className="sx-fill sx-fill-up" d={UP} fill="url(#sx-up)" />
      <path className="sx-draw sx-s-up" pathLength="1" d={UP} stroke="#e9f8ff" strokeWidth="1.15" />
      <g className="sx-detail">
        <path d="M25 54C34 32 66 18 115 17" stroke="#fff" strokeOpacity=".85" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M33 47c18-15 42-22 69-24M35 54c17-13 35-18 52-21M42 61c12-8 23-12 35-14" stroke="#d9f4ff" strokeOpacity=".34" strokeWidth=".75" strokeLinecap="round" />
        <path d="M25 60c-1 8 8 14 20 17" stroke="#b4eaff" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round" />
      </g>

      <path className="sx-fill sx-fill-lo" d={LO} fill="url(#sx-lo)" />
      <path className="sx-draw sx-s-lo" pathLength="1" d={LO} stroke="#e0c9ff" strokeWidth="1.1" />
      <g clipPath="url(#sx-clip)" stroke="#8feaff" strokeOpacity=".58" strokeWidth=".65">
        <path className="sx-draw sx-mesh" pathLength="1" d="M38 48 62 65 83 53 105 68 124 57M30 68 52 78 75 68 96 82 119 76M24 88 48 91 70 82 94 96 117 94M20 107 46 105 70 97 93 111 116 109" />
        <path className="sx-draw sx-mesh sx-mesh2" pathLength="1" d="M38 48 30 68 24 88 20 107M62 65 52 78 48 91 46 105M83 53 75 68 70 82 70 97M105 68 96 82 94 96 93 111M124 57 119 76 117 94 116 109" />
      </g>
      <g clipPath="url(#sx-clip)" fill="#d9f7ff">
        {NODES.map(([x, y, r], i) => (
          <circle key={i} className="sx-node" cx={x} cy={y} r={r} style={{ "--n": i } as CSSProperties} />
        ))}
      </g>
      <path className="sx-detail sx-arc" d="M32 113c29-10 48-20 58-34 5-7 5-14 1-20" stroke="#fff" strokeOpacity=".72" strokeWidth="1.15" strokeLinecap="round" />

      <g transform="rotate(-18 80 62)">
        <path className="sx-draw sx-orbit sx-orbit-glow" pathLength="1" d="M6.5 62A73.5 20.8 0 1 1 153.5 62A73.5 20.8 0 1 1 6.5 62Z" stroke="url(#sx-or)" strokeWidth="2.05" filter="url(#sx-bloom)" />
        <path className="sx-draw sx-orbit" pathLength="1" d="M6.5 62A73.5 20.8 0 1 1 153.5 62A73.5 20.8 0 1 1 6.5 62Z" stroke="#e8faff" strokeWidth=".55" strokeOpacity=".9" />
      </g>

      <g className="sx-starwrap">
        <path className="sx-star" d="M80 34 84.2 56.7 107 61 84.2 65.2 80 88 75.8 65.2 53 61 75.8 56.7 80 34Z" fill="#fff" filter="url(#sx-sg)" />
        <circle className="sx-core" cx="80" cy="61" r="4.1" fill="#fff" />
      </g>
      <circle className="sx-planet sx-p1" cx="17.4" cy="84.6" r="4.1" fill="url(#sx-pl)" filter="url(#sx-sg)" />
      <circle className="sx-planet sx-p2" cx="143" cy="39.3" r="4.1" fill="url(#sx-pl)" filter="url(#sx-sg)" />
      <g className="sx-comet">
        {Array.from({ length: COMET_TRAIL * 2 }, (_, i) => (
          <circle key={i} cx="80" cy="62" r="0" fill={i % COMET_TRAIL === 0 ? "#fff" : "#a9e8ff"} opacity="0" />
        ))}
      </g>
    </svg>
  );
}

export function Intro() {
  const [phase, setPhase] = useState<Phase>(() => (shouldPlay() ? "play" : "off"));
  const [stage, setStage] = useState(0);
  const [layout, setLayout] = useState<Layout>(() => readLayout());
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const sweepAtRef = useRef(-1);
  const running = phase !== "off";
  const decoding = running && stage >= 4;

  // Hold the app hidden while the trailer plays. It is un-hidden (still fully covered by the
  // opaque overlay) shortly before the exit, so its first paint happens off-camera and the
  // hand-off is just the overlay fading away: no animated filters/opacity on the app itself.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "play") root.classList.add("satya-intro-pending");
    else root.classList.remove("satya-intro-pending");
  }, [phase]);

  // Layout flags (portrait / short landscape / touch) follow the viewport live.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = readLayout();
        setLayout((p) => (p.touch === next.touch && p.portrait === next.portrait && p.short === next.short ? p : next));
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [running]);

  // Measure the wordmark so one continuous gradient and the light sweep span all letters.
  useLayoutEffect(() => {
    if (!running) return;
    const word = wordRef.current;
    if (!word) return;
    const measure = () => {
      const ww = word.offsetWidth;
      word.style.setProperty("--ww", ww + "px");
      word.style.setProperty("--bw", Math.round(ww * 0.55) + "px");
      word.querySelectorAll<HTMLElement>(".intro-ch").forEach((el) => el.style.setProperty("--lx", el.offsetLeft + "px"));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(word);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => ro?.disconnect();
  }, [running]);

  // Wordmark decode: every letter spins through glyph noise, then locks in.
  useEffect(() => {
    if (!decoding || phase !== "play") return;
    const word = wordRef.current;
    if (!word) return;
    const els = Array.from(word.querySelectorAll<HTMLElement>(".intro-ch"));
    const scr = els.map((el) => el.querySelector<HTMLElement>(".intro-ch-scr"));
    const t0 = performance.now();
    const ends = els.map((_, i) => i * 170 + 1100 + i * 60);
    const done = ends[ends.length - 1];
    const iv = window.setInterval(() => {
      const dt = performance.now() - t0;
      els.forEach((el, i) => {
        const start = i * 170;
        if (dt < start) return;
        if (dt < ends[i]) {
          el.classList.add("scr");
          const s = scr[i];
          if (s) s.textContent = SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
        } else if (!el.classList.contains("locked")) {
          el.classList.remove("scr");
          el.classList.add("locked");
        }
      });
      if (dt > done + 40) {
        window.clearInterval(iv);
        sweepAtRef.current = performance.now();
      }
    }, 46);
    return () => window.clearInterval(iv);
  }, [decoding, phase]);

  useEffect(() => {
    if (!running) return;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      setPhase("off");
      return;
    }
    if (grainRef.current) grainRef.current.style.backgroundImage = "url(" + makeGrain() + ")";

    const L0 = layoutRef.current;
    const coarse = L0.touch;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    const sprites = TINTS.map(makeSprite);
    const nebA = makeNebula(coarse ? 150 : 256, COOL);
    let nebB: HTMLCanvasElement | null = null;
    const lowEnd = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
    const nebTimer = window.setTimeout(() => { if (!lowEnd) nebB = makeNebula(224, WARM); }, 350);
    const comet = Array.from(rootRef.current?.querySelectorAll<SVGCircleElement>(".sx-comet circle") ?? []);

    let w = 0, h = 0, diag = 1, f = 1;
    let cx = 0, cy = 0, wy = 0, wx = 0;
    let stars: Star[] = [];
    let sparks: Spark[] = [];
    let motes: Mote[] = [];
    const rings: number[] = [];
    let ringClock = 0;
    let burst = false;
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    let push = 0;
    let stageNow = 0;
    let frameNo = 0;
    let tcFrame = -1;
    let exitAt = -1;
    let lastSw = Number.NaN;
    let fxFaded = false;
    let tiles: Tile[] = [];
    let tileSize = 32;
    let tilesBuilt = false;
    let tilesDone = false;
    const tctx = tilesRef.current?.getContext("2d") ?? null;

    const spawn = (s: Star, initial: boolean) => {
      s.x = (Math.random() * 2 - 1) * 1.05;
      s.y = (Math.random() * 2 - 1) * 1.05;
      s.z = initial ? 0.3 + Math.random() * 0.7 : 0.92 + Math.random() * 0.08;
    };
    const makeStar = (): Star => {
      const s: Star = {
        x: 0, y: 0, z: 1,
        zv: 0.7 + Math.random() * 0.6,
        r: 0.45 + Math.pow(Math.random(), 2.4) * 1.7,
        b: 0.45 + Math.random() * 0.55,
        ci: Math.floor(Math.random() * TINTS.length),
        tw: Math.random() * TAU,
        chroma: Math.random() < 0.3,
      };
      spawn(s, true);
      return s;
    };
    const measureCenter = () => {
      const cv = canvas.getBoundingClientRect();
      const m = markRef.current?.getBoundingClientRect();
      if (m && m.width > 0) {
        cx = m.left + m.width / 2 - cv.left;
        cy = m.top + m.height / 2 - cv.top;
      } else {
        cx = w / 2;
        cy = h * 0.47;
      }
      const wd = wordRef.current?.getBoundingClientRect();
      if (wd && wd.width > 0) {
        wx = wd.left + wd.width / 2 - cv.left;
        wy = wd.top + wd.height / 2 - cv.top;
      } else {
        wx = cx;
        wy = cy;
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      diag = Math.hypot(w, h);
      f = diag * 0.4;
      const small = Math.min(w, h) < 600;
      stars = Array.from({ length: small ? 260 : coarse ? 400 : 760 }, makeStar);
      motes = Array.from({ length: small ? 38 : 64 }, () => ({
        x: Math.random(), y: Math.random(), vy: 0.012 + Math.random() * 0.03,
        r: 0.7 + Math.random() * 1.6, ph: Math.random() * TAU, ci: Math.floor(Math.random() * TINTS.length),
      }));
      measureCenter();
    };

    const drawNebula = (img: HTMLCanvasElement, x: number, y: number, size: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
    // Anamorphic lens streak: a very flat, very wide glow.
    const drawFlare = (x: number, y: number, k: number, squash: number, reach: number, rot = 0, cool = 0) => {
      if (k < 0.01) return;
      const R = Math.max(w, h) * reach;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, squash);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, rgba(235, 242, 255, 0.95 * k));
      g.addColorStop(0.18, rgba(150 - cool * 30, 190, 255, 0.5 * k));
      g.addColorStop(1, rgba(110, 140, 255, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
    };

    const buildTiles = () => {
      const tc = tilesRef.current;
      if (!tc || !tctx) return;
      tc.width = Math.round(w * dpr);
      tc.height = Math.round(h * dpr);
      tileSize = Math.max(22, Math.min(40, Math.round(Math.min(w, h) / 26)));
      const light = interfaceIsLight();
      const pals = light ? LIGHT_UI : DARK_UI;
      const sparks = light ? LIGHT_SPARK : DARK_SPARK;
      const cols = Math.ceil(w / tileSize);
      const rows = Math.ceil(h / tileSize);
      const mx = w / 2;
      const my = h / 2;
      const maxD = Math.hypot(mx, my);
      tiles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * tileSize;
          const y = r * tileSize;
          const dist = Math.hypot(x + tileSize / 2 - mx, y + tileSize / 2 - my) / maxD;
          tiles.push({
            x, y,
            d: TILE_SPREAD * (0.78 * dist + 0.22 * Math.random()),
            spin: (Math.random() < 0.5 ? -1 : 1) * Math.PI * (0.7 + Math.random() * 2),
            turns: (Math.random() < 0.5 ? -1 : 1) * Math.PI * (1.5 + Math.random() * 2.5),
            mode: Math.floor(Math.random() * 3),
            pal: pals[Math.floor(Math.random() * pals.length)],
            spark: sparks[Math.floor(Math.random() * sparks.length)],
          });
        }
      }
    };
    const drawTiles = (tt: number) => {
      if (!tctx || !tiles.length) return;
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.clearRect(0, 0, w, h);
      const half = tileSize / 2;
      // Pass 1: black space covers every cell that has not finished yet (so nothing peeks through).
      tctx.fillStyle = "#05060b";
      for (const tl of tiles) {
        const u = (tt - tl.d) / TILE_LIFE;
        if (u >= 1) continue;
        tctx.globalAlpha = u > 0.8 ? 1 - smooth((u - 0.8) / 0.2) : 1;
        tctx.fillRect(tl.x, tl.y, tileSize + 0.5, tileSize + 0.5);
      }
      // Pass 2: the spinning blocks, black -> spark -> interface colour, settling into the grid.
      for (const tl of tiles) {
        const u = (tt - tl.d) / TILE_LIFE;
        if (u <= 0 || u >= 1) continue;
        const k = clamp01(u / 0.6);
        const e = 1 - Math.pow(1 - k, 3);
        const sc = k < 1 ? Math.max(0, easeOutBack(k)) : 1;
        const ang = tl.mode === 0 ? tl.spin * (1 - e) : 0;
        let sx = sc;
        let sy = sc;
        if (tl.mode === 1) sx = sc * Math.cos(tl.turns * (1 - e));
        else if (tl.mode === 2) sy = sc * Math.cos(tl.turns * (1 - e));
        tctx.globalAlpha = u > 0.8 ? 1 - smooth((u - 0.8) / 0.2) : 1;
        tctx.fillStyle = u < 0.3 ? mix(INK, tl.spark, u / 0.3) : u < 0.62 ? mix(tl.spark, tl.pal, (u - 0.3) / 0.32) : mix(tl.pal, tl.pal, 0);
        tctx.save();
        tctx.translate(tl.x + half, tl.y + half);
        tctx.rotate(ang);
        tctx.scale(sx, sy);
        const hh = half - (u < 0.62 ? 0.8 : -0.3);
        tctx.fillRect(-hh, -hh, hh * 2, hh * 2);
        if (u < 0.7) {
          tctx.globalAlpha *= 0.28 * (1 - u / 0.7);
          tctx.strokeStyle = "rgb(190,200,255)";
          tctx.lineWidth = 1;
          tctx.strokeRect(-hh, -hh, hh * 2, hh * 2);
        }
        tctx.restore();
      }
      tctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (phaseRef.current !== "play" && exitAt < 0) exitAt = now;
      const te = exitAt >= 0 ? (now - exitAt) / 1000 : -1;
      const quick = phaseRef.current === "skip";
      if (te < 0 && frameNo++ % 10 === 0) measureCenter();

      let st = 0;
      for (let i = 1; i < STAGE_AT.length; i++) if (t >= STAGE_AT[i]) st = i;
      if (st !== stageNow) {
        stageNow = st;
        setStage(st);
      }

      // HUD: timecode + progress hairline.
      const tf = Math.floor(t * 24);
      if (te < 0 && tf !== tcFrame && tcRef.current) {
        tcFrame = tf;
        const p2 = (n: number) => (n < 10 ? "0" : "") + n;
        tcRef.current.textContent = "00:" + p2(Math.floor(t) % 60) + ":" + p2(tf % 24);
      }
      if (progRef.current) progRef.current.style.transform = "scaleX(" + clamp01(t / T.exit).toFixed(4) + ")";

      let v = speedAt(t);
      let flash = flashAt(t);
      if (te >= 0) v = Math.max(v, 0.97 * smooth(te / (quick ? 0.3 : 1.3))); // warp-jump out
      const dark = te >= 0 && !quick ? smooth((te - DARK_AT) / 0.95) : 0; // light speed -> black space
      if (dark > 0) v *= 1 - 0.95 * dark;
      if (te >= DARK_AT - 0.1 && !quick && !fxFaded && fxRef.current) {
        fxFaded = true;
        fxRef.current.style.transition = "opacity 1s ease";
        fxRef.current.style.opacity = "0";
      }
      const hit = t >= T.hit ? t - T.hit : -1;

      // Wordmark light sweep (driven here so it follows the letters exactly).
      const wordEl = wordRef.current;
      const swAt = sweepAtRef.current;
      if (wordEl && swAt > 0) {
        const ww = wordEl.offsetWidth;
        const bw = ww * 0.55;
        const since = (now - swAt) / 1000;
        let p = -1;
        if (since < 2.0) p = since / 2.0;
        else if (since > 5.0) {
          const c = ((since - 5.0) % 8) / 1.6;
          if (c <= 1) p = c;
        }
        const sw = p < 0 ? -9999 : -bw + (ww + bw * 2) * smooth(p);
        if (sw !== lastSw) {
          lastSw = sw;
          wordEl.style.setProperty("--sw", Math.round(sw) + "px");
        }
      }
      const surge = swAt > 0 ? Math.exp(-((now - swAt) / 1000) * 1.2) : 0;
      const sweepBeam = swAt > 0 && (now - swAt) / 1000 < 2.0 ? Math.sin(Math.PI * clamp01((now - swAt) / 2000)) : 0;

      // Comet on the logo orbit (SVG units, so it stays glued to the mark).
      if (comet.length && hit >= 3.0) {
        const base = (hit - 3.0) * 0.8;
        const appearK = smooth((hit - 3.0) / 1.2);
        const cs = Math.cos(ORBIT.rot);
        const sn = Math.sin(ORBIT.rot);
        for (let c = 0; c < 2; c++) {
          for (let i = 0; i < COMET_TRAIL; i++) {
            const a = base + c * Math.PI - i * 0.075;
            const lx = ORBIT.rx * Math.cos(a);
            const ly = ORBIT.ry * Math.sin(a);
            const el = comet[c * COMET_TRAIL + i];
            if (!el) continue;
            const fade = 1 - i / COMET_TRAIL;
            const front = Math.sin(a) > 0 ? 1 : 0.5;
            el.setAttribute("cx", (ORBIT.cx + lx * cs - ly * sn).toFixed(2));
            el.setAttribute("cy", (ORBIT.cy + lx * sn + ly * cs).toFixed(2));
            el.setAttribute("r", ((c === 0 ? 1.9 : 1.3) * (0.25 + 0.75 * fade)).toFixed(2));
            el.setAttribute("opacity", (appearK * fade * fade * front * (c === 0 ? 0.95 : 0.6)).toFixed(3));
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      // Camera shake: rumble through warp, a hard kick on the hit.
      const amp = (coarse ? 1.6 : 2.2) * v * v + (hit >= 0 ? (coarse ? 6 : 8) * Math.exp(-hit * 5) : 0);
      ctx.save();
      if (amp > 0.05) {
        ctx.translate(
          (Math.sin(t * 63) + Math.sin(t * 41 + 1.3)) * 0.5 * amp,
          (Math.sin(t * 57 + 0.7) + Math.sin(t * 35)) * 0.5 * amp,
        );
      }
      ctx.globalCompositeOperation = "lighter";

      // Nebula: two cool/warm cloud stacks the camera pushes through.
      push = Math.min(1.3, push + dt * (0.02 + 0.35 * v * v));
      const nebIn = te >= 0 ? 0 : smooth((t - 1.4) / 4.5);
      const boost = Math.min(1.3, 0.6 + 0.45 * v + 0.75 * flash);
      if (nebIn > 0.01) {
        ctx.globalAlpha = Math.min(1, nebIn * 0.5 * boost);
        drawNebula(nebA, cx, cy, diag * (1.15 + push * 0.5), t * 0.012);
        ctx.globalAlpha = Math.min(1, nebIn * 0.32 * boost);
        drawNebula(nebA, cx + w * 0.07, cy - h * 0.05, diag * (1.7 + push * 0.8), -0.5 - t * 0.008);
        if (nebB) {
          ctx.globalAlpha = Math.min(1, nebIn * 0.3 * boost);
          drawNebula(nebB, cx - w * 0.1, cy + h * 0.06, diag * (1.35 + push * 0.6), 1.2 + t * 0.01);
        }
      }

      // Core glow that swells with speed and the flash.
      if (t > 0.3 && te < 0) {
        const k = clamp01(0.1 + 0.5 * v + 0.7 * flash + 0.12 * surge) * smooth(t / 3);
        const R = Math.min(w, h) * (0.3 + 0.4 * v + 0.35 * flash);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, rgba(205, 190, 255, 0.44 * k));
        g.addColorStop(0.45, rgba(125, 112, 255, 0.17 * k));
        g.addColorStop(1, rgba(94, 200, 255, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // The lone ignition star: pulse rings and a four-point glint.
      const ign = smooth(t / 2.8) * (1 - smooth((t - (T.warp - 0.5)) / 1.5));
      if (ign > 0.01) {
        const R = 30 + 6 * Math.sin(t * 4.2) + v * 40;
        ctx.globalAlpha = ign * 0.95;
        ctx.drawImage(sprites[1], cx - R, cy - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
        drawFlare(cx, cy, ign * 0.55, 0.018, 0.16);
        drawFlare(cx, cy, ign * 0.4, 0.018, 0.12, Math.PI / 2);
        const cyc = (t * 0.5) % 1;
        if (t < T.warp) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = rgba(180, 205, 255, 1);
          ctx.globalAlpha = ign * (1 - cyc) * (1 - cyc) * 0.4;
          ctx.beginPath();
          ctx.arc(cx, cy, 18 + cyc * Math.min(w, h) * 0.22, 0, TAU);
          ctx.stroke();
        }
      }

      // Hyperspace ripples while at speed.
      if (v > 0.5) {
        ringClock += dt;
        if (ringClock > 0.2) {
          ringClock = 0;
          rings.push(0);
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i] += dt / 1.15;
        const p = rings[i];
        if (p >= 1) { rings.splice(i, 1); continue; }
        ctx.lineWidth = 1 + 2 * p;
        ctx.strokeStyle = rgba(150, 190, 255, 1);
        ctx.globalAlpha = (1 - p) * 0.16 * Math.min(1, v + 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, p * p * diag * 0.55 + 6, 0, TAU);
        ctx.stroke();
      }

      // Stars, in true perspective: z shrinks, so they accelerate toward you.
      const appear = smooth((t - 1.0) / 2.8);
      const streakCap = coarse && Math.min(w, h) < 600 ? 44 : 9999;
      ctx.lineCap = "round";
      for (let si = 0; si < stars.length; si++) {
        const s = stars[si];
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
        const alpha = clamp01(s.b * born * appear * tw * Math.min(1, 0.35 + depth * 1.2)) * (si % 11 === 0 ? 1 - 0.78 * dark : 1 - dark);
        if (alpha < 0.01) continue;

        const L = v * v * (coarse ? 0.2 : 0.34) * s.zv;
        if (L > 0.004) {
          const zt = Math.min(1.5, s.z + L);
          let tx = cx + (s.x * f) / zt;
          let ty = cy + (s.y * f) / zt;
          let dx = sx - tx;
          let dy = sy - ty;
          let len = Math.hypot(dx, dy);
          if (len > streakCap) {
            const keep = streakCap / len;
            tx = sx - dx * keep;
            ty = sy - dy * keep;
            dx = sx - tx;
            dy = sy - ty;
            len = streakCap;
          }
          if (len > 0.8) {
            ctx.lineWidth = Math.max(0.6, rad * 0.9);
            ctx.strokeStyle = STREAK_CSS[s.ci];
            ctx.globalAlpha = alpha * 0.8;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            if (s.chroma && v > 0.45) {
              const ox = (-dy / len) * 1.5 * v;
              const oy = (dx / len) * 1.5 * v;
              ctx.globalAlpha = alpha * 0.35;
              ctx.strokeStyle = "rgb(255,80,120)";
              ctx.beginPath();
              ctx.moveTo(tx + ox, ty + oy);
              ctx.lineTo(sx + ox, sy + oy);
              ctx.stroke();
              ctx.strokeStyle = "rgb(80,170,255)";
              ctx.beginPath();
              ctx.moveTo(tx - ox, ty - oy);
              ctx.lineTo(sx - ox, sy - oy);
              ctx.stroke();
            }
          }
        }
        const R = rad * 6;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprites[s.ci], sx - R, sy - R, R * 2, R * 2);
        // Bright stars get diffraction spikes while the camera is calm.
        if (s.r > 1.45 && v < 0.2) {
          const sl = rad * 9;
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = STREAK_CSS[s.ci];
          ctx.globalAlpha = alpha * 0.45;
          ctx.beginPath();
          ctx.moveTo(sx - sl, sy); ctx.lineTo(sx + sl, sy);
          ctx.moveTo(sx, sy - sl); ctx.lineTo(sx, sy + sl);
          ctx.stroke();
        }
      }

      // Impact: spark burst, then slow floating motes around the logo.
      if (hit >= 0 && !burst) {
        burst = true;
        const n = coarse ? 90 : 210;
        const sc = diag / 1500;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const sp = (90 + Math.pow(Math.random(), 2) * 1050) * sc;
          const life = 1.6 + Math.random() * 3.0;
          sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, r: 0.5 + Math.random() * 1.6, ci: Math.floor(Math.random() * TINTS.length) });
        }
      }
      if (sparks.length) {
        const drag = Math.pow(0.3, dt);
        sparks = sparks.filter((p) => (p.life -= dt) > 0);
        for (const p of sparks) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= drag;
          p.vy *= drag;
          const k = clamp01(p.life / p.max);
          const R = p.r * 5 * (0.5 + k);
          ctx.globalAlpha = Math.pow(k, 1.3);
          ctx.drawImage(sprites[p.ci], p.x - R, p.y - R, R * 2, R * 2);
        }
      }
      if (hit >= 1.2 && te < 0) {
        const mk = smooth((hit - 1.2) / 2.6);
        for (const m of motes) {
          m.y -= m.vy * dt;
          if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          const R = m.r * 7;
          ctx.globalAlpha = mk * (0.25 + 0.3 * Math.sin(t * 1.4 + m.ph)) * 0.8;
          ctx.drawImage(sprites[m.ci], m.x * w - R, m.y * h - R, R * 2, R * 2);
        }
      }

      // Lens flare: blazes on the hit, lingers behind the logo, surges when the word locks.
      const flareK = te >= 0 ? 0 : clamp01(flash + (hit >= 0 ? 0.35 * Math.exp(-hit * 0.7) : 0) + 0.12 * v);
      ctx.globalAlpha = 1;
      drawFlare(cx, cy, flareK, 0.045, 0.78);
      drawFlare(cx, cy, flareK * flareK, 0.012, 0.95);
      if (hit >= 0 && te < 0) drawFlare(cx, cy, 0.22 + 0.1 * Math.sin(t * 1.3), 0.02, 0.5, 0, 1);
      if (sweepBeam > 0.01) drawFlare(wx, wy, sweepBeam * 0.55, 0.03, 0.5, 0, 1);

      // Shockwave rings from the hit.
      for (let r = 0; r < 3; r++) {
        const dur = 2.8 + r * 0.7;
        const hh = hit - r * 0.18;
        if (hh < 0 || hh >= dur) continue;
        const p = hh / dur;
        const rr = (1 - Math.pow(1 - p, 3)) * diag * (0.62 + r * 0.12);
        ctx.lineWidth = (r === 0 ? 16 : 8) * (1 - p) + 2;
        ctx.globalAlpha = Math.pow(1 - p, 2) * (r === 0 ? 0.12 : 0.06);
        ctx.strokeStyle = rgba(150, 160, 255, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = Math.pow(1 - p, 1.6) * (r === 0 ? 0.75 : 0.4);
        ctx.strokeStyle = rgba(190, 220, 255, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();

      // The flash itself, drawn without shake so the whole frame whites out.
      if (flash > 0.01) {
        const R = diag * 0.8;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, rgba(255, 255, 255, 0.95 * flash));
        g.addColorStop(0.35, rgba(225, 215, 255, 0.7 * flash));
        g.addColorStop(1, rgba(150, 140, 255, 0.28 * flash));
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (te >= TILE_AT && !quick && !tilesDone) {
        const tt = te - TILE_AT;
        if (!tilesBuilt) {
          tilesBuilt = true;
          buildTiles();
        }
        drawTiles(tt);
        // The black cover now lives on the tile canvas, so the overlay itself can turn transparent.
        rootRef.current?.style.setProperty("background", "transparent", "important");
        if (tt > TILE_SPREAD + TILE_LIFE + 0.05) {
          tilesDone = true;
          tctx?.clearRect(0, 0, w, h);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    if (coarse && window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    const warm = window.setTimeout(() => {
      if (phaseRef.current === "play") document.documentElement.classList.remove("satya-intro-pending");
    }, (T.exit - 1.6) * 1000);
    const toExit = window.setTimeout(() => {
      if (phaseRef.current === "play") setPhase("exit");
    }, T.exit * 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(toExit);
      window.clearTimeout(warm);
      window.clearTimeout(nebTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      if (coarse && window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
    };
  }, [running]);

  // Touch: only the Skip button or Escape skips. Mouse/keyboard: any click or key.
  useEffect(() => {
    if (phase !== "play") return;
    const skip = () => setPhase((p) => (p === "play" ? "skip" : p));
    if (layoutRef.current.touch) {
      const key = (e: KeyboardEvent) => { if (e.key === "Escape") skip(); };
      window.addEventListener("keydown", key);
      return () => window.removeEventListener("keydown", key);
    }
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "exit" && phase !== "skip") return;
    const id = window.setTimeout(() => setPhase("off"), (phase === "skip" ? SKIP_EXIT_MS : EXIT_MS) + 80);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "off") return null;
  const stageClasses = Array.from({ length: stage }, (_, i) => "intro-stage-" + (i + 1)).join(" ");
  const cls = [
    "intro",
    phase,
    layout.touch ? "is-touch" : "is-pointer",
    layout.portrait ? "is-portrait" : "is-landscape",
    layout.short ? "is-short" : "",
    stageClasses,
  ].filter(Boolean).join(" ");
  return (
    <div ref={rootRef} className={cls} role="presentation">
      <canvas ref={canvasRef} className="intro-canvas" />
      <div ref={fxRef} className="intro-fx">
        <div className="intro-halo" />
        <div className="intro-rays" />
        <div className="intro-rays intro-rays-b" />
        <div ref={grainRef} className="intro-grain" />
        <div className="intro-vig" />
        <div className="intro-exitflash" />
      </div>
      <canvas ref={tilesRef} className="intro-tiles" />
      <div className="intro-bar top">
        <span className="intro-hud">SatyaAI · Truth-first intelligence</span>
        <span className="intro-tc" ref={tcRef}>00:00:00</span>
      </div>
      <div className="intro-bar bottom">
        <i className="intro-prog" ref={progRef} />
      </div>
      <p className="intro-line">
        {OPENING.map((wd, i) => (
          <span key={i} className="intro-lw" style={{ "--w": i } as CSSProperties}>{wd}</span>
        ))}
      </p>
      <div className="intro-center">
        <div className="intro-mark" ref={markRef}>
          <Logo />
        </div>
        <div className="intro-text">
          <div className="intro-word" ref={wordRef} aria-label={WORD}>
            {WORD.split("").map((ch, i) => (
              <span key={i} className={"intro-ch" + (i >= AI_FROM ? " ai" : "")} data-ch={ch} style={{ "--i": i } as CSSProperties}>
                <span className="intro-ch-real">{ch}</span>
                <span className="intro-ch-scr" aria-hidden="true" />
              </span>
            ))}
          </div>
          <div className="intro-rule" />
          <p className="intro-tag">
            {TAGLINE.map((wd, i) => (
              <span key={i} className="intro-tw" style={{ "--w": i } as CSSProperties}>{wd}</span>
            ))}
          </p>
        </div>
      </div>
      {layout.touch ? (
        <button type="button" className="intro-skip" aria-label="Skip intro" onClick={() => setPhase((p) => (p === "play" ? "skip" : p))}>
          Skip
        </button>
      ) : (
        <span className="intro-skip">Click or press any key to skip</span>
      )}
    </div>
  );
}
