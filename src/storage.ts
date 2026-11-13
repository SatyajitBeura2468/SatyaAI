// Safe localStorage helpers: corrupt or missing data must never crash the app.
export function loadJSON<T>(key: string, fallback: T, valid: (value: unknown) => boolean = () => true): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? (parsed as T) : fallback;
  } catch { return fallback; }
}

export function saveJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or private mode: ignore */ }
}
