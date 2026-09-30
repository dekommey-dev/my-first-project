import { useState } from 'react';
import { Cell, Pie, PieChart, Sector } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { ASSET_COLOR } from '../lib/colors';
import { formatKRW, formatKRWCompact, formatMonthDay, formatPct, formatPctPoint } from '../lib/format';
import { DRIFT_THRESHOLD } from '../lib/metrics';
import type { AssetAllocation } from '../types';
import { Card, ViewToggle } from './common';
import { CheckIcon, ScaleIcon } from './Icons';

interface Props {
  allocation: AssetAllocation[];
  totalValue: number;
  nextRebalanceDate?: string;
}

/** 비중 막대 스케일 상한 — 가장 큰 자산군 비중이 여유 있게 들어가도록 */
const BAR_SCALE = 0.5;

function ActiveShape(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius = 0, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--surface-1)"
      strokeWidth={2}
      cornerRadius={4}
    />
  );
}

export function AllocationDonut({ allocation, totalValue, nextRebalanceDate }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const focused = active === null ? null : allocation[active];
  const worst = allocation.reduce((a, b) => (Math.abs(b.drift) > Math.abs(a.drift) ? b : a));
  const withinThreshold = Math.abs(worst.drift) < DRIFT_THRESHOLD;

  return (
    <Card
      id="allocation"
      className="span-5"
      title="자산군별 투자 비중"
      subtitle="현재 비중 vs 목표 비중 (위험중립형 모델)"
      action={<ViewToggle table={table} onToggle={() => setTable((t) => !t)} />}
    >
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">자산군별 평가금액과 비중</caption>
            <thead>
              <tr>
                <th scope="col">자산군</th>
                <th scope="col">평가금액</th>
                <th scope="col">현재</th>
                <th scope="col">목표</th>
                <th scope="col">차이</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((a) => (
                <tr key={a.id}>
                  <th scope="row" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {a.name}
                  </th>
                  <td>{formatKRW(a.value)}</td>
                  <td>{formatPct(a.weight, { digits: 1 })}</td>
                  <td>{formatPct(a.targetWeight, { digits: 1 })}</td>
                  <td>{formatPctPoint(a.drift)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="alloc-container">
        <div className="alloc-body">
          <div className="donut-wrap" onMouseLeave={() => setActive(null)}>
            <PieChart width={220} height={220} accessibilityLayer={false}>
              <Pie
                data={allocation}
                dataKey="weight"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                startAngle={90}
                endAngle={-270}
                stroke="var(--surface-1)"
                strokeWidth={2}
                cornerRadius={4}
                isAnimationActive={false}
                activeIndex={active ?? undefined}
                activeShape={ActiveShape}
                onMouseEnter={(_, i) => setActive(i)}
              >
                {allocation.map((a) => (
                  <Cell key={a.id} fill={ASSET_COLOR[a.id]} />
                ))}
              </Pie>
            </PieChart>
            <div className="donut-center" aria-live="polite">
              {focused ? (
                <>
                  <span>{focused.name}</span>
                  <strong>{formatPct(focused.weight, { digits: 1 })}</strong>
                  <small>{formatKRWCompact(focused.value)}</small>
                </>
              ) : (
                <>
                  <span>총 평가금액</span>
                  <strong>{formatKRWCompact(totalValue)}</strong>
                  <small>{allocation.length}개 자산군</small>
                </>
              )}
            </div>
          </div>

          <ul className="alloc-list" aria-label="자산군 범례">
            {allocation.map((a, i) => (
              <li
                key={a.id}
                className="alloc-item"
                data-active={active === i}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${a.name} ${formatPct(a.weight, { digits: 1 })}, 목표 ${formatPct(a.targetWeight, { digits: 1 })}, 평가금액 ${formatKRW(a.value)}`}
              >
                <span className="alloc-name">
                  <span className="key-rect" style={{ background: ASSET_COLOR[a.id] }} />
                  {a.name}
                </span>
                <span className="alloc-weight num">{formatPct(a.weight, { digits: 1 })}</span>
                <span className="alloc-meta">
                  {formatKRWCompact(a.value)} · {a.holdings}
                </span>
                <span className="alloc-drift num">
                  목표 {formatPct(a.targetWeight, { digits: 0 })} ({formatPctPoint(a.drift)})
                </span>
                <span className="drift-bar" aria-hidden="true">
                  <span
                    className="fill"
                    style={{
                      width: `${(a.weight / BAR_SCALE) * 100}%`,
                      background: ASSET_COLOR[a.id],
                    }}
                  />
                  <span className="target" style={{ left: `calc(${(a.targetWeight / BAR_SCALE) * 100}% - 1px)` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}

      <div className="alloc-foot" role="status">
        {withinThreshold ? (
          <CheckIcon size={14} style={{ color: 'var(--status-good-text)', flex: 'none' }} />
        ) : (
          <ScaleIcon size={14} style={{ color: 'var(--status-warning-text)', flex: 'none' }} />
        )}
        <span>
          최대 이탈 <b style={{ color: 'var(--text-primary)' }}>{worst.name} {formatPctPoint(worst.drift)}</b>
          {withinThreshold
            ? ` · 임계치(±${DRIFT_THRESHOLD * 100}%p) 이내`
            : ` · 임계치(±${DRIFT_THRESHOLD * 100}%p) 초과`}
          {nextRebalanceDate && ` · ${formatMonthDay(nextRebalanceDate)} 정기 리밸런싱에서 조정 예정`}
        </span>
      </div>
    </Card>
  );
}
