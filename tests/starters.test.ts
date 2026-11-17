import { describe, it, expect } from 'vitest';
import { STARTER_POOL, pickStarters } from '../src/starters';

// Small deterministic generator so the tests are repeatable.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const categoryOf = (title: string) =>
  Object.keys(STARTER_POOL).find((key) => STARTER_POOL[key].some((item) => item.title === title));

describe('starter pool', () => {
  const all = Object.values(STARTER_POOL).flat();

  it('is large and has no duplicate titles', () => {
    expect(all.length).toBeGreaterThanOrEqual(48);
    expect(new Set(all.map((item) => item.title)).size).toBe(all.length);
  });

  it('keeps every starter short and crisp', () => {
    for (const item of all) {
      expect(item.title.length).toBeLessThanOrEqual(44);
      expect(item.hint.length).toBeLessThanOrEqual(32);
    }
  });
});

describe('pickStarters', () => {
  it('returns four starters from four different categories', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const picked = pickStarters(seeded(seed));
      expect(picked).toHaveLength(4);
      const categories = picked.map((item) => categoryOf(item.title));
      expect(categories.every(Boolean)).toBe(true);
      expect(new Set(categories).size).toBe(4);
    }
  });

  it('never repeats a starter from the previous load', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const first = pickStarters(seeded(seed));
      const second = pickStarters(seeded(seed + 1000), first.map((item) => item.title));
      const repeated = second.filter((item) => first.some((old) => old.title === item.title));
      expect(repeated).toHaveLength(0);
    }
  });

  it('gives different sets for different draws', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      sets.add(pickStarters(seeded(seed)).map((item) => item.title).join('|'));
    }
    expect(sets.size).toBeGreaterThan(20);
  });
});
