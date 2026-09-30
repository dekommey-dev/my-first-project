import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatDate, formatMonthDay, formatPct, formatPctPoint, formatYearMonth } from '../lib/format';
import { lastPoint, niceTicks } from '../lib/metrics';
import type { Period, RebalanceEvent, ReturnPoint } from '../types';
import { Card, Delta, ViewToggle } from './common';

interface Props {
  points: ReturnPoint[];
  period: Period;
  periodLabel: string;
  benchmarkName: string;
  events: RebalanceEvent[];
}

const AXIS_TICK = { fill: 'var(--axis-muted)', fontSize: 12 };

function tickFormatter(period: Period) {
  return period === '1M' || period === '3M'
    ? (d: string) => formatMonthDay(d).replace('월 ', '/').replace('일', '')
    : formatYearMonth;
}

/** 표 보기용 샘플링: 짧은 기간은 일/주 단위, 긴 기간은 월말 기준 */
function sampleForTable(points: ReturnPoint[], period: Period): ReturnPoint[] {
  if (period === '1M') return points;
  if (period === '3M') {
    return points.filter((_, i) => i % 5 === 0 || i === points.length - 1);
  }
  return points.filter((p, i) => {
    const next = points[i + 1];
    return !next || next.date.slice(0, 7) !== p.date.slice(0, 7);
  });
}

export function ReturnsChart({ points, period, periodLabel, benchmarkName, events }: Props) {
  const [table, setTable] = useState(false);
  const end = lastPoint(points);
  const excess = end.portfolio - end.benchmark;

  const eventByDate = useMemo(() => {
    const map = new Map<string, RebalanceEvent>();
    for (const e of events) if (e.status === 'completed') map.set(e.date, e);
    return map;
  }, [events]);

  const markers = useMemo(
    () => points.filter((p, i) => i > 0 && eventByDate.has(p.date)),
    [points, eventByDate],
  );

  const yTicks = useMemo(() => {
    const values = points.flatMap((p) => [p.portfolio, p.benchmark]);
    return niceTicks(Math.min(...values), Math.max(...values));
  }, [points]);
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 0.01;
  // 2.5%·0.5% 같은 간격은 소수 첫째 자리까지 표시
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
            <span className="key-line" style={{ background: 'var(--series-muted)' }} />벤치마크
          </span>
          <span className="value">{formatPct(p.benchmark, { signed: true })}</span>
        </div>
        <div className="chart-tooltip-row">
          <span className="name">초과 수익</span>
          <span className="value">{formatPctPoint(p.portfolio - p.benchmark, 2)}</span>
        </div>
        {ev && <div className="chart-tooltip-note">리밸런싱 · {ev.title}</div>}
      </div>
    );
  };

  return (
    <Card
      id="returns"
      className="span-8"
      title="누적 수익률 추이"
      subtitle={`${periodLabel} · 기간 시작일 = 0% 기준`}
      action={<ViewToggle table={table} onToggle={() => setTable((t) => !t)} />}
    >
      <div className="returns-summary">
        <div>
          <span>
            <span className="key-line" style={{ background: 'var(--series-1)', marginRight: 6, verticalAlign: 'middle' }} />
            내 포트폴리오
          </span>
          <strong>
            <Delta value={end.portfolio}>{formatPct(end.portfolio, { signed: true })}</Delta>
          </strong>
        </div>
        <div>
          <span>
            <span className="key-line" style={{ background: 'var(--series-muted)', marginRight: 6, verticalAlign: 'middle' }} />
            {benchmarkName}
          </span>
          <strong>
            <Delta value={end.benchmark}>{formatPct(end.benchmark, { signed: true })}</Delta>
          </strong>
        </div>
        <div>
          <span>벤치마크 대비</span>
          <strong>
            <Delta value={excess}>{formatPctPoint(excess, 2)}</Delta>
          </strong>
        </div>
        {markers.length > 0 && (
          <div style={{ justifyContent: 'flex-end' }}>
            <span className="legend-item" style={{ fontSize: 12 }}>
              <span
                className="key-dot"
                style={{ background: 'var(--surface-1)', border: '2px solid var(--series-1)', boxShadow: 'none', width: 10, height: 10 }}
              />
              리밸런싱 실행 ({markers.length}회)
            </span>
          </div>
        )}
      </div>

      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">기간별 누적 수익률</caption>
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">내 포트폴리오</th>
                <th scope="col">벤치마크</th>
                <th scope="col">초과 수익</th>
              </tr>
            </thead>
            <tbody>
              {sampleForTable(points, period)
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.date}>
                    <td>{formatDate(p.date)}</td>
                    <td>{formatPct(p.portfolio, { signed: true })}</td>
                    <td>{formatPct(p.benchmark, { signed: true })}</td>
                    <td>{formatPctPoint(p.portfolio - p.benchmark, 2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="chart-box"
          role="img"
          aria-label={`${periodLabel} 누적 수익률: 내 포트폴리오 ${formatPct(end.portfolio, { signed: true })}, 벤치마크 ${formatPct(end.benchmark, { signed: true })}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 64, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormatter(period)}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--baseline)' }}
                minTickGap={40}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v: number) => formatPct(v, { digits: yDigits })}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={56}
                ticks={yTicks}
                domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                interval={0}
              />
              <ReferenceLine y={0} stroke="var(--baseline)" strokeWidth={1} />
              <Tooltip
                content={renderTooltip}
                cursor={{ stroke: 'var(--axis-muted)', strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name="벤치마크"
                stroke="var(--series-muted)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--series-muted)', stroke: 'var(--surface-1)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="portfolio"
                name="내 포트폴리오"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="var(--series-1)"
                fillOpacity={0.1}
                baseValue={0}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface-1)', strokeWidth: 2 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="portfolio"
                  content={({ index, x, y, value }) =>
                    index === lastIndex ? (
                      <g>
                        <circle cx={Number(x)} cy={Number(y)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                        <text
                          x={Number(x) + 10}
                          y={Number(y)}
                          dy={4}
                          fontSize={12}
                          fontWeight={700}
                          fill="var(--text-primary)"
                        >
                          {formatPct(Number(value), { digits: 1, signed: true })}
                        </text>
                      </g>
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
                  fill="var(--surface-1)"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  ifOverflow="visible"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
