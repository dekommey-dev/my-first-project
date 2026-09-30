import type { ReactNode } from 'react';
import { direction } from '../lib/format';
import { ArrowDownIcon, ArrowUpIcon } from './Icons';

interface CardProps {
  id: string;
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ id, title, action, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`} id={id} aria-labelledby={title ? `${id}-title` : undefined}>
      {title && (
        <header className="card-head">
          <h2 className="card-title" id={`${id}-title`}>
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** 부호 + 화살표 + 색으로 방향을 표시한다 (색상 단독 의존 없음). */
export function Delta({ value, children, arrow = true }: { value: number; children: ReactNode; arrow?: boolean }) {
  const dir = direction(value);
  return (
    <span className={`${dir} num`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {arrow && dir === 'up' && <ArrowUpIcon size="0.8em" />}
      {arrow && dir === 'down' && <ArrowDownIcon size="0.8em" />}
      {children}
    </span>
  );
}

/** 매수/매도 태그 — 국내 관례대로 매수 빨강, 매도 파랑 */
export function SideTag({ buy }: { buy: boolean }) {
  return <span className={`side-tag ${buy ? 'side-buy' : 'side-sell'}`}>{buy ? '매수' : '매도'}</span>;
}
