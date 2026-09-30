/** 결정적(seeded) 난수 — 목업 데이터가 새로고침마다 바뀌지 않도록 한다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller 변환으로 표준정규분포 표본을 생성한다. */
export function gaussian(rand: () => number): () => number {
  return () => {
    const u = Math.max(rand(), Number.EPSILON);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}
