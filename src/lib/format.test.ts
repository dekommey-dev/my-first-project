import { describe, expect, it } from 'vitest';
import { formatKRW, formatKRWCompact, formatPct, formatPctPoint } from './format';

describe('format', () => {
  it('formats won amounts', () => {
    expect(formatKRW(121840000.4)).toBe('121,840,000원');
    expect(formatKRWCompact(121_840_000)).toBe('1억 2,184만원');
    expect(formatKRWCompact(100_000_000)).toBe('1억원');
    expect(formatKRWCompact(8_370_000)).toBe('837만원');
    expect(formatKRWCompact(-2_500_000)).toBe('-250만원');
  });

  it('formats signed percentages without negative zero', () => {
    expect(formatPct(0.12345, { signed: true })).toBe('+12.35%');
    expect(formatPct(-0.0831)).toBe('-8.31%');
    expect(formatPct(-0.00001, { signed: true })).toBe('0.00%');
    expect(formatPctPoint(0.028)).toBe('+2.8%p');
    expect(formatPctPoint(-0.015)).toBe('-1.5%p');
  });
});
