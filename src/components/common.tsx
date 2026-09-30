import type { ReactNode } from 'react';
import { direction } from '../lib/format';
import { ArrowDownIcon, ArrowUpIcon, ChartIcon, TableIcon } from './Icons';

interface CardProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  id?: string;
}

export function Card({ title, subtitle, action, className = '', children, id }: CardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`card ${className}`} aria-labelledby={headingId} id={id}>
      <header className="card-head">
        <div>
          <h2 className="card-title" id={headingId}>
            {title}
          </h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** 부호 + 화살표 아이콘 + 색상으로 방향을 표시한다 (색상 단독 의존 없음). */
export function Delta({ value, children }: { value: number; children: ReactNode }) {
  const dir = direction(value);
  return (
    <b className={`${dir} num`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {dir === 'up' && <ArrowUpIcon size={12} />}
      {dir === 'down' && <ArrowDownIcon size={12} />}
      {children}
    </b>
  );
}

export function ViewToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="text-btn" onClick={onToggle} aria-pressed={table}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {table ? <ChartIcon size={14} /> : <TableIcon size={14} />}
        {table ? '차트로 보기' : '표로 보기'}
      </span>
    </button>
  );
}
