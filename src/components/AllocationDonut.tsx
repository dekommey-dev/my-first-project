import { useState } from 'react';
import { Cell, Pie, PieChart, Sector } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { ASSET_COLOR } from '../lib/colors';
import { formatKRW, formatKRWCompact, formatMonthDay, formatPct, formatPctPoint, withJosa } from '../lib/format';
import { DRIFT_THRESHOLD } from '../lib/metrics';
import type { AssetAllocation } from '../types';
import { Card } from './common';
import { InfoIcon } from './Icons';

interface Props {
  allocation: AssetAllocation[];
  totalValue: number;
  nextRebalanceDate?: string;
}

function ActiveShape(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius = 0, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--card)"
      strokeWidth={3}
      cornerRadius={4}
    />
  );
}

export function AllocationDonut({ allocation, totalValue, nextRebalanceDate }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const focused = active === null ? null : allocation[active];
  const worst = allocation.reduce((a, b) => (Math.abs(b.drift) > Math.abs(a.drift) ? b : a));
  const within = Math.abs(worst.drift) < DRIFT_THRESHOLD;

  return (
    <Card id="allocation" className="order-4" title="자산 비중">
      <div className="donut-wrap" onMouseLeave={() => setActive(null)}>
        <PieChart width={200} height={200} accessibilityLayer={false}>
          <Pie
            data={allocation}
            dataKey="weight"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={92}
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={3}
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
              <strong className="num">{formatPct(focused.weight, { digits: 1 })}</strong>
              <small>{formatKRWCompact(focused.value)}</small>
            </>
          ) : (
            <>
              <span>총 자산</span>
              <strong>{formatKRWCompact(totalValue).replace('만원', '만')}</strong>
              <small>{allocation.length}개 자산군</small>
            </>
          )}
        </div>
      </div>

      <ul className="alloc-list" aria-label="자산군별 비중">
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
            aria-label={`${a.name} ${formatPct(a.weight, { digits: 1 })}, 목표 ${formatPct(a.targetWeight, { digits: 0 })}, ${formatKRW(a.value)}`}
          >
            <span className="alloc-swatch" style={{ background: ASSET_COLOR[a.id] }} />
            <span style={{ minWidth: 0 }}>
              <div className="alloc-name">{a.name}</div>
              <div className="alloc-sub">{a.holdings}</div>
            </span>
            <span className="alloc-right">
              <div className="alloc-weight num">{formatPct(a.weight, { digits: 1 })}</div>
              <div className="alloc-target num">
                목표 {formatPct(a.targetWeight, { digits: 0 })} · {formatPctPoint(a.drift)}
              </div>
            </span>
          </li>
        ))}
      </ul>

      <div className="note" role="status">
        <InfoIcon size={16} style={{ color: 'var(--grey-500)' }} />
        <span>
          {withJosa(worst.name, '이', '가')} 목표보다 {formatPctPoint(Math.abs(worst.drift)).replace('+', '')}{' '}
          {worst.drift > 0 ? '많아요' : '적어요'}.{' '}
          {within
            ? `자동 조정 기준(±${DRIFT_THRESHOLD * 100}%p) 안이라${nextRebalanceDate ? ` ${formatMonthDay(nextRebalanceDate)} 정기 리밸런싱 때` : ''} 맞출게요.`
            : `자동 조정 기준(±${DRIFT_THRESHOLD * 100}%p)을 넘어 바로 리밸런싱할게요.`}
        </span>
      </div>
    </Card>
  );
}
