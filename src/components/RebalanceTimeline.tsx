import { useState } from 'react';
import type { ReactNode } from 'react';
import { ASSET_COLOR } from '../lib/colors';
import { formatDate, formatKRW, formatPct, formatPctPoint } from '../lib/format';
import { turnover } from '../lib/metrics';
import type { AssetClass, AssetClassId, RebalanceEvent, RebalanceTrigger } from '../types';
import { Card } from './common';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  FlagIcon,
  PulseIcon,
  ScaleIcon,
  SparkIcon,
  UserCheckIcon,
} from './Icons';

interface Props {
  events: RebalanceEvent[];
  assets: AssetClass[];
  /** 해당 일자의 포트폴리오 평가금액 (거래 금액 환산용) */
  valueAt: (date: string) => number;
  periodLabel: string;
}

const TRIGGER_META: Record<RebalanceTrigger, { label: string; icon: ReactNode }> = {
  initial: { label: '최초 구성', icon: <FlagIcon size={11} /> },
  scheduled: { label: '정기', icon: <CalendarIcon size={11} /> },
  drift: { label: '비중 이탈', icon: <ScaleIcon size={11} /> },
  market: { label: '시장 이벤트', icon: <PulseIcon size={11} /> },
  profile: { label: '성향 변경', icon: <UserCheckIcon size={11} /> },
};

const PAGE_SIZE = 4;

export function RebalanceTimeline({ events, assets, valueAt, periodLabel }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(events.slice(0, 2).map((e) => e.id)));
  const [visible, setVisible] = useState(PAGE_SIZE);

  const names = Object.fromEntries(assets.map((a) => [a.id, a.name])) as Record<AssetClassId, string>;
  const completedCount = events.filter((e) => e.status === 'completed').length;
  const shown = events.slice(0, visible);

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
      className="span-7"
      title="리밸런싱 내역"
      subtitle={`${periodLabel} · 실행 ${completedCount}회 · AI 운용 판단 근거 포함`}
      action={
        <button type="button" className="text-btn">
          전체 내역
        </button>
      }
    >
      {events.length === 0 ? (
        <div className="empty">선택한 기간에 리밸런싱 내역이 없습니다.</div>
      ) : (
        <ol className="timeline">
          {shown.map((e) => {
            const open = expanded.has(e.id);
            const meta = TRIGGER_META[e.trigger];
            const bodyId = `tl-body-${e.id}`;
            const planned = e.status === 'planned';
            const value = valueAt(e.date);
            return (
              <li key={e.id} className="tl-item" data-status={e.status}>
                <span className="tl-node" aria-hidden="true">
                  {planned ? <ClockIcon size={11} /> : <CheckIcon size={10} />}
                </span>
                <button
                  type="button"
                  className="tl-head"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => toggle(e.id)}
                >
                  <span>
                    <span className="tl-date">
                      <time dateTime={e.date} className="num">
                        {formatDate(e.date)}
                      </time>
                      <span className="chip">
                        {meta.icon}
                        {meta.label}
                      </span>
                      {planned ? (
                        <span className="chip chip-planned">
                          <ClockIcon size={11} />
                          예정
                        </span>
                      ) : (
                        <span className="chip chip-done">
                          <CheckIcon size={10} />
                          완료
                        </span>
                      )}
                    </span>
                    <span className="tl-title" style={{ display: 'block' }}>
                      {e.title}
                    </span>
                  </span>
                  <ChevronDownIcon size={16} className="tl-chevron" />
                </button>

                {open && (
                  <div className="tl-body" id={bodyId}>
                    <p className="tl-ai">
                      <SparkIcon size={14} />
                      <span>
                        <b style={{ color: 'var(--text-primary)' }}>AI 판단 근거 · </b>
                        {e.rationale}
                      </span>
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                    <table className="trade-table">
                      <caption className="sr-only">{e.title} 매매 내역</caption>
                      <thead>
                        <tr>
                          <th scope="col">자산군</th>
                          <th scope="col">구분</th>
                          <th scope="col">비중 변경</th>
                          <th scope="col">조정</th>
                          <th scope="col">{planned ? '예상 금액' : '거래 금액'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.trades.map((t) => {
                          const delta = t.to - t.from;
                          const buy = delta > 0;
                          return (
                            <tr key={t.assetId}>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <span className="key-rect" style={{ background: ASSET_COLOR[t.assetId], width: 8, height: 8 }} />
                                  {names[t.assetId]}
                                </span>
                              </td>
                              <td className={`trade-side ${buy ? 'up' : 'down'}`}>{buy ? '매수' : '매도'}</td>
                              <td>
                                {formatPct(t.from, { digits: 1 })} → {formatPct(t.to, { digits: 1 })}
                              </td>
                              <td>{formatPctPoint(delta)}</td>
                              <td>{formatKRW(Math.abs(delta) * value)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    <div className="tl-foot">
                      <span>회전율 {formatPct(turnover(e.trades), { digits: 1 })}</span>
                      <span>
                        {planned ? '예상 거래비용' : '거래비용'} {formatKRW(e.cost)}
                      </span>
                      <span>
                        {planned ? '현재' : '실행일'} 평가금액 {formatKRW(value)} 기준
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {events.length > visible && (
        <button type="button" className="tl-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          이전 내역 더 보기 ({events.length - visible}건)
        </button>
      )}
    </Card>
  );
}
