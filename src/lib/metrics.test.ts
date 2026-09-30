import { describe, expect, it } from 'vitest';
import { assetClasses, rebalanceEvents, returnSeries } from '../data/mock';
import {
  buildAllocation,
  eventsInPeriod,
  maxDrawdown,
  niceTicks,
  periodStart,
  plannedTrades,
  sliceAndRebase,
  turnover,
} from './metrics';
import type { ReturnPoint } from '../types';

const pt = (date: string, portfolio: number, benchmark = 0): ReturnPoint => ({ date, portfolio, benchmark });

describe('periodStart', () => {
  it('subtracts calendar months and clamps to month end', () => {
    expect(periodStart('2026-09-29', '1M')).toBe('2026-08-29');
    expect(periodStart('2026-09-29', '1Y')).toBe('2025-09-29');
    expect(periodStart('2026-03-31', '1M')).toBe('2026-02-28');
    expect(periodStart('2026-09-29', 'ALL')).toBeNull();
  });
});

describe('sliceAndRebase', () => {
  it('rebases so the day before the period is 0% and compounds correctly', () => {
    // 1M 시작일은 2026-08-29 → 직전 거래일 08-28이 0% 기준점
    const series = [pt('2026-07-31', 0), pt('2026-08-28', 0.1), pt('2026-08-31', 0.21), pt('2026-09-29', 0.331)];
    const out = sliceAndRebase(series, '1M');
    expect(out.map((p) => p.date)).toEqual(['2026-08-28', '2026-08-31', '2026-09-29']);
    expect(out[0].portfolio).toBe(0);
    expect(out[1].portfolio).toBeCloseTo(0.1, 10);
    expect(out[2].portfolio).toBeCloseTo(0.21, 10);
  });

  it('keeps the full series for ALL', () => {
    expect(sliceAndRebase(returnSeries, 'ALL')).toHaveLength(returnSeries.length);
  });
});

describe('maxDrawdown', () => {
  it('measures peak-to-trough on the wealth index', () => {
    const series = [pt('a', 0), pt('b', 0.2), pt('c', -0.04), pt('d', 0.3)];
    expect(maxDrawdown(series, 'portfolio')).toBeCloseTo(0.96 / 1.2 - 1, 10);
  });
  it('is 0 for a monotonically rising series', () => {
    expect(maxDrawdown([pt('a', 0), pt('b', 0.1)], 'portfolio')).toBe(0);
  });
});

describe('allocation & trades', () => {
  it('current and target weights each sum to 100%', () => {
    const sum = (k: 'weight' | 'targetWeight') => assetClasses.reduce((s, a) => s + a[k], 0);
    expect(sum('weight')).toBeCloseTo(1, 10);
    expect(sum('targetWeight')).toBeCloseTo(1, 10);
  });

  it('values add up to the total and drift is current minus target', () => {
    const alloc = buildAllocation(assetClasses, 1_000_000);
    expect(alloc.reduce((s, a) => s + a.value, 0)).toBeCloseTo(1_000_000, 4);
    const global = alloc.find((a) => a.id === 'global-equity')!;
    expect(global.drift).toBeCloseTo(0.028, 10);
  });

  it('planned trades restore target weights with balanced turnover', () => {
    const trades = plannedTrades(assetClasses);
    expect(trades.every((t) => t.to === assetClasses.find((a) => a.id === t.assetId)!.targetWeight)).toBe(true);
    expect(turnover(trades)).toBeCloseTo(0.032, 10);
  });
});

describe('mock data integrity', () => {
  it('every completed rebalance falls on a trading day in the series', () => {
    const dates = new Set(returnSeries.map((p) => p.date));
    for (const e of rebalanceEvents.filter((e) => e.status === 'completed')) {
      expect(dates.has(e.date), e.date).toBe(true);
    }
  });

  it('eventsInPeriod keeps planned events and sorts newest first', () => {
    const events = eventsInPeriod(rebalanceEvents, '2026-09-29', '3M');
    expect(events[0].status).toBe('planned');
    expect(events.slice(1).every((e) => e.date >= '2026-06-29')).toBe(true);
    const dates = events.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe('return series calibration', () => {
  it('hits the anchor cumulative returns', () => {
    const at = (d: string) => returnSeries.find((p) => p.date === d)!;
    expect(at('2025-09-30').portfolio).toBeCloseTo(0.103, 10);
    expect(at('2026-03-31').benchmark).toBeCloseTo(0.098, 10);
    const last = returnSeries[returnSeries.length - 1];
    expect(last.date).toBe('2026-09-29');
    expect(last.portfolio).toBeCloseTo(0.2184, 10);
    expect(last.benchmark).toBeCloseTo(0.1563, 10);
  });
});

describe('niceTicks', () => {
  it('produces evenly spaced round ticks that include zero and cover the range', () => {
    const ticks = niceTicks(-0.012, 0.135);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBeLessThanOrEqual(-0.012);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0.135);
    const steps = ticks.slice(1).map((t, i) => Number((t - ticks[i]).toFixed(10)));
    expect(new Set(steps).size).toBe(1);
    expect([0.025, 0.05]).toContain(steps[0]);
  });
});
