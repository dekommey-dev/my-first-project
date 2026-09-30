import { formatKRW, formatKRWCompact, formatPct, formatPctPoint } from '../lib/format';
import { Delta } from './common';
import { CheckIcon } from './Icons';

interface Props {
  totalValue: number;
  principal: number;
  periodLabel: string;
  periodReturn: number;
  periodPnL: number;
  benchmarkReturn: number;
  benchmarkName: string;
  mdd: number;
  benchmarkMdd: number;
  lossTolerance: number;
}

export function KpiRow(p: Props) {
  const totalPnL = p.totalValue - p.principal;
  const excess = p.periodReturn - p.benchmarkReturn;
  const withinTolerance = p.mdd > -p.lossTolerance;

  return (
    <div className="grid" role="list" aria-label="핵심 지표">
      <article className="card stat stat-hero span-3" role="listitem">
        <span className="stat-label">총 평가금액</span>
        <span className="stat-value">{formatKRW(p.totalValue)}</span>
        <span className="stat-delta">
          누적 손익
          <Delta value={totalPnL}>
            {totalPnL > 0 ? '+' : ''}
            {formatKRWCompact(totalPnL)} ({formatPct(totalPnL / p.principal, { signed: true })})
          </Delta>
        </span>
        <span className="stat-delta">투자 원금 {formatKRWCompact(p.principal)}</span>
      </article>

      <article className="card stat span-3" role="listitem">
        <span className="stat-label">{p.periodLabel} 수익률</span>
        <span className="stat-value">
          <Delta value={p.periodReturn}>{formatPct(p.periodReturn, { signed: true })}</Delta>
        </span>
        <span className="stat-delta">
          평가손익
          <Delta value={p.periodPnL}>
            {p.periodPnL > 0 ? '+' : ''}
            {formatKRWCompact(p.periodPnL)}
          </Delta>
        </span>
      </article>

      <article className="card stat span-3" role="listitem">
        <span className="stat-label">벤치마크 대비 초과수익</span>
        <span className="stat-value">
          <Delta value={excess}>{formatPctPoint(excess, 2)}</Delta>
        </span>
        <span className="stat-delta">
          {p.benchmarkName} {formatPct(p.benchmarkReturn, { signed: true })}
        </span>
      </article>

      <article className="card stat span-3" role="listitem">
        <span className="stat-label">최대 낙폭 (MDD)</span>
        <span className="stat-value">{formatPct(p.mdd)}</span>
        <span className="stat-delta">
          <span>
            {withinTolerance && (
              <CheckIcon size={12} style={{ color: 'var(--status-good-text)', verticalAlign: '-1px', marginRight: 4 }} />
            )}
            감내 한도 -{p.lossTolerance * 100}% {withinTolerance ? '이내' : '초과'} · 벤치마크 {formatPct(p.benchmarkMdd)}
          </span>
        </span>
      </article>
    </div>
  );
}
