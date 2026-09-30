import type {
  AssetAllocation,
  AssetClass,
  Period,
  RebalanceEvent,
  RebalanceTrade,
  ReturnPoint,
} from '../types';

export const PERIOD_OPTIONS: { id: Period; label: string; months: number | null }[] = [
  { id: '1M', label: '1개월', months: 1 },
  { id: '3M', label: '3개월', months: 3 },
  { id: '6M', label: '6개월', months: 6 },
  { id: '1Y', label: '1년', months: 12 },
  { id: 'ALL', label: '전체', months: null },
];

/** 비중 이탈 리밸런싱 임계치 (±5%p) */
export const DRIFT_THRESHOLD = 0.05;

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 기준일로부터 기간 시작일을 계산한다. 'ALL'이면 null. */
export function periodStart(endDate: string, period: Period): string | null {
  const option = PERIOD_OPTIONS.find((o) => o.id === period);
  if (!option || option.months === null) return null;
  const d = toUTC(endDate);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - option.months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toISO(d);
}

/**
 * 기간에 해당하는 구간을 잘라낸 뒤 시작점을 0%로 재기준화한다.
 * 시작일 이전 마지막 거래일을 기준점으로 포함해, 첫날의 수익도 반영되도록 한다.
 */
export function sliceAndRebase(points: ReturnPoint[], period: Period): ReturnPoint[] {
  if (points.length === 0) return [];
  const start = periodStart(points[points.length - 1].date, period);
  let from = 0;
  if (start) {
    const firstInside = points.findIndex((p) => p.date >= start);
    from = firstInside <= 0 ? 0 : firstInside - 1;
  }
  const slice = points.slice(from);
  const base = slice[0];
  return slice.map((p) => ({
    date: p.date,
    portfolio: (1 + p.portfolio) / (1 + base.portfolio) - 1,
    benchmark: (1 + p.benchmark) / (1 + base.benchmark) - 1,
  }));
}

/** 누적 수익률 시계열의 최대 낙폭 (음수, 예: -0.083) */
export function maxDrawdown(points: ReturnPoint[], key: 'portfolio' | 'benchmark'): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const p of points) {
    const index = 1 + p[key];
    peak = Math.max(peak, index);
    mdd = Math.min(mdd, index / peak - 1);
  }
  return mdd;
}

export function lastPoint(points: ReturnPoint[]): ReturnPoint {
  return points[points.length - 1] ?? { date: '', portfolio: 0, benchmark: 0 };
}

export function buildAllocation(assets: AssetClass[], totalValue: number): AssetAllocation[] {
  return assets.map((a) => ({
    ...a,
    value: a.weight * totalValue,
    drift: a.weight - a.targetWeight,
  }));
}

/** 현재 비중을 목표 비중으로 되돌리기 위한 매매안 (0.1%p 미만 조정은 생략) */
export function plannedTrades(assets: AssetClass[], minChange = 0.001): RebalanceTrade[] {
  return assets
    .filter((a) => Math.abs(a.targetWeight - a.weight) >= minChange)
    .map((a) => ({ assetId: a.id, from: a.weight, to: a.targetWeight }));
}

/** 리밸런싱 회전율: 매도(또는 매수) 비중 합계 */
export function turnover(trades: RebalanceTrade[]): number {
  const sells = trades.reduce((sum, t) => sum + Math.max(0, t.from - t.to), 0);
  const buys = trades.reduce((sum, t) => sum + Math.max(0, t.to - t.from), 0);
  return Math.max(sells, buys);
}

/** 예정된 이벤트는 항상, 완료된 이벤트는 기간 내 것만 최신순으로 반환 */
export function eventsInPeriod(
  events: RebalanceEvent[],
  endDate: string,
  period: Period,
): RebalanceEvent[] {
  const start = periodStart(endDate, period);
  return events
    .filter((e) => e.status === 'planned' || !start || e.date >= start)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 축 눈금을 깔끔한 간격(1·2·2.5·5 × 10^n)으로 계산한다. 0은 항상 포함한다. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1e-3;
  const raw = span / Math.max(1, target - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}
