import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import {
  formatDate,
  formatKRWCompact,
  formatMonthDay,
  formatPct,
  formatPctPoint,
  formatYearMonth,
} from '../lib/format';
import { PERIOD_OPTIONS, lastPoint, maxDrawdown, niceTicks } from '../lib/metrics';
import type { Period, RebalanceEvent, ReturnPoint } from '../types';
import { Card, Delta } from './common';

interface Props {
  points: ReturnPoint[];
  period: Period;
  onPeriodChange: (p: Period) => void;
  benchmarkName: string;
  events: RebalanceEvent[];
  /** 기간 평가손익 (원) */
  pnl: number;
  lossTolerance: number;
}

const AXIS_TICK = { fill: 'var(--grey-400)', fontSize: 12 };

function tickFormatter(period: Period) {
  return period === '1M' || period === '3M'
    ? (d: string) => formatMonthDay(d).replace('월 ', '/').replace('일', '')
    : formatYearMonth;
}

/** 스크린리더용 표: 짧은 기간은 일/주 단위, 긴 기간은 월말 기준 */
function sampleForTable(points: ReturnPoint[], period: Period): ReturnPoint[] {
  if (period === '1M') return points;
  if (period === '3M') return points.filter((_, i) => i % 5 === 0 || i === points.length - 1);
  return points.filter((p, i) => {
    const next = points[i + 1];
    return !next || next.date.slice(0, 7) !== p.date.slice(0, 7);
  });
}

export function ReturnsChart({ points, period, onPeriodChange, benchmarkName, events, pnl, lossTolerance }: Props) {
  const end = lastPoint(points);
  const excess = end.portfolio - end.benchmark;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.id === period)!.label;
  const mdd = maxDrawdown(points, 'portfolio');

  const eventByDate = useMemo(() => {
    const map = new Map<string, RebalanceEvent>();
    for (const e of events) if (e.status === 'completed') map.set(e.date, e);
    return map;
  }, [events]);

  const markers = useMemo(() => points.filter((p, i) => i > 0 && eventByDate.has(p.date)), [points, eventByDate]);

  const yTicks = useMemo(() => {
    const values = points.flatMap((p) => [p.portfolio, p.benchmark]);
    return niceTicks(Math.min(...values), Math.max(...values), 4);
  }, [points]);
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 0.01;
  const yDigits = Number.isInteger(Number((yStep * 100).toFixed(6))) ? 0 : 1;
  const lastIndex = points.length - 1;

  const renderTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as ReturnPoint;
    const ev = eventByDate.get(String(label));
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{formatDate(p.date)}</div>
        <div className="chart-tooltip-row">
          <span className="name">
            <span className="key-line" style={{ background: 'var(--series-1)' }} />내 포트폴리오
          </span>
          <span className="value">{formatPct(p.portfolio, { signed: true })}</span>
        </div>
        <div className="chart-tooltip-row">
          <span className="name">
            <span className="key-line" style={{ background: 'var(--series-muted)' }} />
            벤치마크
          </span>
          <span className="value">{formatPct(p.benchmark, { signed: true })}</span>
        </div>
        {ev && <div className="chart-tooltip-note">리밸런싱 · {ev.title}</div>}
      </div>
    );
  };

  return (
    <Card id="returns" className="order-3">
      <div className="card-caption">{periodLabel} 수익률</div>
      <div className="returns-headline">
        <Delta value={end.portfolio}>{formatPct(end.portfolio, { signed: true })}</Delta>
      </div>
      <div className="returns-compare">
        {benchmarkName}({formatPct(end.benchmark, { signed: true })})보다{' '}
        <b className={excess >= 0 ? 'up' : 'down'}>{formatPctPoint(Math.abs(excess), 2).replace('+', '')}</b>{' '}
        {excess >= 0 ? '높아요' : '낮아요'}
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="key-line" style={{ background: 'var(--series-1)' }} />내 포트폴리오
        </span>
        <span className="legend-item">
          <span className="key-line" style={{ background: 'var(--series-muted)' }} />
          벤치마크
        </span>
        {markers.length > 0 && (
          <span className="legend-item">
            <span className="key-ring" />
            리밸런싱
          </span>
        )}
      </div>

      <div
        className="chart-box"
        role="img"
        aria-label={`${periodLabel} 누적 수익률 그래프: 내 포트폴리오 ${formatPct(end.portfolio, { signed: true })}, 벤치마크 ${formatPct(end.benchmark, { signed: true })}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter(period)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tickMargin={10}
            />
            <YAxis
              orientation="right"
              tickFormatter={(v: number) => formatPct(v, { digits: yDigits })}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              ticks={yTicks}
              domain={[yTicks[0], yTicks[yTicks.length - 1]]}
              interval={0}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: 'var(--grey-300)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="var(--series-muted)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--series-muted)', stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke="var(--series-1)"
              strokeWidth={2.5}
              fill="url(#portfolio-fill)"
              baseValue={yTicks[0]}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="portfolio"
                content={({ index, x, y }) =>
                  index === lastIndex ? (
                    <circle cx={Number(x)} cy={Number(y)} r={5} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
                  ) : null
                }
              />
            </Area>
            {markers.map((m) => (
              <ReferenceDot
                key={m.date}
                x={m.date}
                y={m.portfolio}
                r={4}
                fill="var(--card)"
                stroke="var(--series-1)"
                strokeWidth={2}
                ifOverflow="visible"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="period-tabs" role="group" aria-label="조회 기간">
        {PERIOD_OPTIONS.map((o) => (
          <button key={o.id} type="button" aria-pressed={period === o.id} onClick={() => onPeriodChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      <dl className="stat-row">
        <div>
          <dt>평가손익</dt>
          <dd>
            <Delta value={pnl} arrow={false}>
              {pnl > 0 ? '+' : ''}
              {formatKRWCompact(pnl)}
            </Delta>
          </dd>
        </div>
        <div>
          <dt>최대 낙폭</dt>
          <dd className="num">
            {formatPct(mdd)}
            <small>감내 한도 -{lossTolerance * 100}% {mdd > -lossTolerance ? '이내' : '초과'}</small>
          </dd>
        </div>
        <div>
          <dt>리밸런싱</dt>
          <dd className="num">
            {markers.length}회<small>기간 내 실행</small>
          </dd>
        </div>
      </dl>

      <table className="sr-only">
        <caption>{periodLabel} 누적 수익률</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">내 포트폴리오</th>
            <th scope="col">벤치마크</th>
          </tr>
        </thead>
        <tbody>
          {sampleForTable(points, period).map((p) => (
            <tr key={p.date}>
              <td>{formatDate(p.date)}</td>
              <td>{formatPct(p.portfolio, { signed: true })}</td>
              <td>{formatPct(p.benchmark, { signed: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
