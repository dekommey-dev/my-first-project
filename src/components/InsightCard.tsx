import { ASSET_COLOR } from '../lib/colors';
import { formatKRWCompact, formatMonthDay, formatPct } from '../lib/format';
import type { AssetClass, AssetClassId, RebalanceEvent } from '../types';
import { SideTag } from './common';
import { SparkIcon } from './Icons';

interface Props {
  event: RebalanceEvent;
  assets: AssetClass[];
  totalValue: number;
}

/** 다음 예정 리밸런싱을 AI 안내 카드로 보여준다. */
export function InsightCard({ event, assets, totalValue }: Props) {
  const names = Object.fromEntries(assets.map((a) => [a.id, a.name])) as Record<AssetClassId, string>;
  const trades = [...event.trades].sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));

  return (
    <section className="card insight order-2" aria-labelledby="insight-title">
      <div className="insight-icon">
        <SparkIcon size={20} />
      </div>
      <div className="insight-eyebrow">AI 리밸런싱 예정</div>
      <h2 className="insight-title" id="insight-title">
        {formatMonthDay(event.date)}에 포트폴리오를 목표 비중으로 맞출게요
      </h2>
      <p className="insight-body">{event.rationale}</p>
      <ul className="trade-list" aria-label="예정된 매매">
        {trades.map((t) => {
          const buy = t.to > t.from;
          return (
            <li key={t.assetId} className="trade-row">
              <SideTag buy={buy} />
              <span className="asset">
                <span className="key-dot" style={{ background: ASSET_COLOR[t.assetId] }} />
                {names[t.assetId]}
                <span className="weights num">
                  {formatPct(t.from, { digits: 1 })} → {formatPct(t.to, { digits: 1 })}
                </span>
              </span>
              <span className="amount num">{formatKRWCompact(Math.abs(t.to - t.from) * totalValue)}</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-secondary">
        리밸런싱 설정 보기
      </button>
    </section>
  );
}
