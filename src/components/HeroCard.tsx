import { formatDate, formatKRW, formatKRWCompact, formatPct } from '../lib/format';
import { Delta } from './common';

interface Props {
  userName: string;
  totalValue: number;
  principal: number;
  profileLabel: string;
  asOf: string;
}

export function HeroCard({ userName, totalValue, principal, profileLabel, asOf }: Props) {
  const pnl = totalValue - principal;
  return (
    <section className="card order-1" aria-labelledby="hero-title">
      <div className="hero-label" id="hero-title">
        {userName}님의 AI 포트폴리오
        <span className="badge">{profileLabel}</span>
      </div>
      <div className="hero-value num">{formatKRW(totalValue)}</div>
      <div className="hero-change">
        <Delta value={pnl}>
          {pnl > 0 ? '+' : ''}
          {formatKRWCompact(pnl)} ({formatPct(pnl / principal, { digits: 1 })})
        </Delta>
        <span className="muted">
          원금 {formatKRWCompact(principal)} · {formatDate(asOf)} 기준
        </span>
      </div>
      <div className="hero-actions">
        <button type="button" className="btn btn-primary">
          입금하기
        </button>
        <button type="button" className="btn btn-grey">
          출금하기
        </button>
      </div>
    </section>
  );
}
