import { useState } from 'react';
import type { ReactNode } from 'react';
import { ASSET_COLOR } from '../lib/colors';
import { formatDate, formatKRW, formatKRWCompact, formatPct } from '../lib/format';
import { turnover } from '../lib/metrics';
import type { AssetClass, AssetClassId, RebalanceEvent, RebalanceTrigger } from '../types';
import { Card, SideTag } from './common';
import { CalendarIcon, ChevronDownIcon, FlagIcon, PulseIcon, ScaleIcon, UserCheckIcon } from './Icons';

interface Props {
  events: RebalanceEvent[];
  assets: AssetClass[];
  /** 해당 일자의 포트폴리오 평가금액 (거래 금액 환산용) */
  valueAt: (date: string) => number;
}

const TRIGGER_META: Record<RebalanceTrigger, { label: string; icon: ReactNode; tint: string; color: string }> = {
  initial: { label: '최초 구성', icon: <FlagIcon size={20} />, tint: 'var(--tint-green)', color: 'var(--icon-green)' },
  scheduled: { label: '정기', icon: <CalendarIcon size={20} />, tint: 'var(--tint-blue)', color: 'var(--blue)' },
  drift: { label: '비중 이탈', icon: <ScaleIcon size={20} />, tint: 'var(--tint-orange)', color: 'var(--icon-orange)' },
  market: { label: '시장 급변', icon: <PulseIcon size={20} />, tint: 'var(--tint-red)', color: 'var(--icon-red)' },
  profile: { label: '성향 변경', icon: <UserCheckIcon size={20} />, tint: 'var(--tint-purple)', color: 'var(--icon-purple)' },
};

const PAGE_SIZE = 5;

export function RebalanceTimeline({ events, assets, valueAt }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(events.slice(0, 1).map((e) => e.id)));
  const [visible, setVisible] = useState(PAGE_SIZE);
  const names = Object.fromEntries(assets.map((a) => [a.id, a.name])) as Record<AssetClassId, string>;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card
      id="rebalancing"
      className="order-6"
      title="리밸런싱 내역"
      action={<span className="card-caption">총 {events.length}회</span>}
    >
      <ol className="history">
        {events.slice(0, visible).map((e) => {
          const meta = TRIGGER_META[e.trigger];
          const open = expanded.has(e.id);
          const value = valueAt(e.date);
          const traded = turnover(e.trades) * value;
          const detailId = `history-${e.id}`;
          return (
            <li key={e.id} className="history-item">
              <button
                type="button"
                className="history-row"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => toggle(e.id)}
              >
                <span className="history-icon" style={{ background: meta.tint, color: meta.color }} aria-hidden="true">
                  {meta.icon}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="history-title" style={{ display: 'block' }}>
                    {e.title}
                  </span>
                  <span className="history-sub">
                    <time dateTime={e.date}>{formatDate(e.date)}</time> · {meta.label}
                  </span>
                </span>
                <span className="history-right">
                  <span>
                    <span className="history-amount num" style={{ display: 'block' }}>
                      {formatKRWCompact(traded)}
                    </span>
                    <span className="history-cost num">비용 {formatKRW(e.cost)}</span>
                  </span>
                  <ChevronDownIcon size={18} className="chevron" />
                </span>
              </button>

              {open && (
                <div className="history-detail" id={detailId}>
                  <p>{e.rationale}</p>
                  <ul className="trade-list" aria-label={`${e.title} 매매 내역`}>
                    {e.trades.map((t) => {
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
                          <span className="amount num">{formatKRW(Math.abs(t.to - t.from) * value)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {events.length > visible && (
        <button type="button" className="btn btn-grey more-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          더 보기
        </button>
      )}
    </Card>
  );
}
