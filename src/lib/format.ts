const krw = new Intl.NumberFormat('ko-KR');

/** 123456789 → "123,456,789원" */
export function formatKRW(value: number): string {
  return `${krw.format(Math.round(value))}원`;
}

/** 123456789 → "1억 2,346만원", 8370000 → "837만원" */
export function formatKRWCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const eok = Math.floor(abs / 1e8);
  const man = Math.round((abs % 1e8) / 1e4);
  if (eok > 0 && man > 0) return `${sign}${eok}억 ${krw.format(man)}만원`;
  if (eok > 0) return `${sign}${eok}억원`;
  if (man > 0) return `${sign}${krw.format(man)}만원`;
  return `${sign}${krw.format(Math.round(abs))}원`;
}

/** 0.1234 → "+12.34%" (signed=true) / "12.34%" */
export function formatPct(ratio: number, { digits = 2, signed = false } = {}): string {
  const value = ratio * 100;
  const rounded = Number(value.toFixed(digits));
  const sign = signed && rounded > 0 ? '+' : '';
  // -0.00 방지
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return `${sign}${safe.toFixed(digits)}%`;
}

/** 0.012 → "+1.2%p" */
export function formatPctPoint(ratio: number, digits = 1): string {
  const value = Number((ratio * 100).toFixed(digits));
  const safe = Object.is(value, -0) ? 0 : value;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe.toFixed(digits)}%p`;
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

/** "2026-09-29" → "2026.09.29" */
export function formatDate(date: string): string {
  return date.replaceAll('-', '.');
}

/** "2026-09-29" → "9월 29일" */
export function formatMonthDay(date: string): string {
  const [, m, d] = parts(date);
  return `${m}월 ${d}일`;
}

/** "2026-09-29" → "26.09" */
export function formatYearMonth(date: string): string {
  const [y, m] = parts(date);
  return `${String(y).slice(2)}.${String(m).padStart(2, '0')}`;
}

export type Direction = 'up' | 'down' | 'flat';

export function direction(value: number, epsilon = 1e-9): Direction {
  if (value > epsilon) return 'up';
  if (value < -epsilon) return 'down';
  return 'flat';
}

/** 받침 유무에 따라 조사를 고른다: withJosa('해외주식', '이', '가') → "해외주식이" */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const batchim = isHangul && (code - 0xac00) % 28 !== 0;
  return `${word}${batchim ? withBatchim : withoutBatchim}`;
}
