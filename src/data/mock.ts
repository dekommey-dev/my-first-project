/**
 * 목업 데이터 — 백엔드 API가 붙기 전까지 대시보드를 구동한다.
 * 모든 값은 결정적으로 생성되며, 자산 평가액은 수익률 시계열에서 역산해 서로 모순되지 않게 한다.
 */
import { gaussian, mulberry32 } from '../lib/random';
import { plannedTrades, turnover } from '../lib/metrics';
import type { AssetClass, RebalanceEvent, ReturnPoint, RiskProfile } from '../types';

export const AS_OF = '2026-09-29';
export const INCEPTION = '2024-10-01';
export const PRINCIPAL = 100_000_000;
export const USER_NAME = '김투자';
export const BENCHMARK_NAME = '글로벌 60/40 혼합지수';

export const riskProfile: RiskProfile = {
  grade: 3,
  label: '위험중립형',
  score: 56,
  surveyedAt: '2026-03-12',
  nextSurveyAt: '2027-03-12',
  previousLabel: '적극투자형',
  summary:
    '예금 이상의 수익을 기대하되, 원금 대비 -15% 수준의 일시적 손실까지는 감내할 수 있는 성향입니다. 5년 내 주택 구입 계획을 반영해 채권 비중을 높였습니다.',
  modelPortfolio: '글로벌 밸런스 50/50',
  expectedReturn: '연 5~7%',
  expectedVolatility: '연 8~10%',
  answers: [
    { question: '투자 목적', answer: '자산 증식 (주택 자금)' },
    { question: '투자 가능 기간', answer: '3년 이상 ~ 5년 미만' },
    { question: '감내 가능 손실', answer: '원금 대비 -15% 이내' },
    { question: '투자 경험', answer: '주식·ETF 3년 이상' },
    { question: '소득 대비 투자 비중', answer: '연 소득의 20~30%' },
    { question: '소득 안정성', answer: '정기 소득 (안정적)' },
  ],
};

export const RISK_GRADES = ['안정형', '안정추구형', '위험중립형', '적극투자형', '공격투자형'] as const;

export const assetClasses: AssetClass[] = [
  { id: 'kr-equity', name: '국내주식', holdings: 'KODEX 200, TIGER 코스닥150', weight: 0.162, targetWeight: 0.17 },
  { id: 'global-equity', name: '해외주식', holdings: 'S&P500, MSCI 선진국 ETF', weight: 0.358, targetWeight: 0.33 },
  { id: 'bond', name: '채권', holdings: '국고채 10년, 미국 중기채', weight: 0.305, targetWeight: 0.32 },
  { id: 'alternative', name: '대체투자', holdings: '글로벌 리츠, 금 현물', weight: 0.104, targetWeight: 0.1 },
  { id: 'cash', name: '현금성 자산', holdings: 'MMF, 단기 RP', weight: 0.071, targetWeight: 0.08 },
];

/* ---------- 누적 수익률 시계열 ---------- */

/**
 * 누적 수익률 기준점 — 구간별로 드리프트를 보정해 각 시점의 누적 수익률을 이 값에 맞춘다.
 * 마지막 기준점은 AS_OF(현재) 누적 수익률이다.
 */
const ANCHORS: { date: string; portfolio: number; benchmark: number }[] = [
  { date: '2025-03-31', portfolio: 0.048, benchmark: 0.039 },
  { date: '2025-09-30', portfolio: 0.103, benchmark: 0.071 },
  { date: '2026-03-31', portfolio: 0.142, benchmark: 0.098 },
  { date: AS_OF, portfolio: 0.2184, benchmark: 0.1563 },
];

/** 특정 거래일에 주입하는 시장 충격 [포트폴리오, 벤치마크] 일간 수익률 */
const SHOCKS: Record<string, [number, number]> = {
  '2025-04-03': [-0.026, -0.029],
  '2025-04-04': [-0.029, -0.032],
  '2025-04-07': [-0.011, -0.014],
  '2025-04-09': [0.031, 0.034],
  '2025-04-10': [0.009, 0.011],
  '2026-04-07': [-0.017, -0.018],
  '2026-04-08': [-0.021, -0.023],
  '2026-04-13': [0.014, 0.012],
};

function businessDays(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function generateReturns(): ReturnPoint[] {
  const days = businessDays(INCEPTION, AS_OF);
  const normal = gaussian(mulberry32(20241001));

  // 1) 상관된 일간 로그수익률 생성 (연 변동성 약 7~8%), 충격일은 고정값으로 대체
  const port: number[] = [];
  const bench: number[] = [];
  const isShock: boolean[] = [];
  for (const date of days.slice(1)) {
    const market = normal();
    const shock = SHOCKS[date];
    port.push(shock ? Math.log(1 + shock[0]) : 0.0042 * market + 0.0016 * normal());
    bench.push(shock ? Math.log(1 + shock[1]) : 0.0039 * market + 0.0013 * normal());
    isShock.push(Boolean(shock));
  }

  // 2) 기준점 구간마다 충격일을 제외한 날에 드리프트를 더해 누적 수익률을 기준점에 맞춘다
  const calibrate = (series: number[], key: 'portfolio' | 'benchmark') => {
    const out = series.slice();
    let from = 0;
    let prevLevel = 0;
    for (const anchor of ANCHORS) {
      // days[i + 1]이 series[i]의 날짜
      let to = days.findIndex((d) => d > anchor.date) - 1;
      if (to < 0) to = days.length - 1;
      const idx = Array.from({ length: to - from }, (_, k) => from + k);
      const free = idx.filter((i) => !isShock[i]);
      const current = idx.reduce((sum, i) => sum + out[i], 0);
      const level = Math.log(1 + anchor[key]);
      const adjust = (level - prevLevel - current) / free.length;
      for (const i of free) out[i] += adjust;
      from = to;
      prevLevel = level;
    }
    return out;
  };
  const p = calibrate(port, 'portfolio');
  const b = calibrate(bench, 'benchmark');

  // 3) 누적
  const points: ReturnPoint[] = [{ date: days[0], portfolio: 0, benchmark: 0 }];
  let lp = 0;
  let lb = 0;
  for (let i = 0; i < p.length; i++) {
    lp += p[i];
    lb += b[i];
    points.push({ date: days[i + 1], portfolio: Math.expm1(lp), benchmark: Math.expm1(lb) });
  }
  return points;
}

export const returnSeries: ReturnPoint[] = generateReturns();

export const totalValue = PRINCIPAL * (1 + returnSeries[returnSeries.length - 1].portfolio);

/* ---------- 리밸런싱 내역 ---------- */

const upcomingTrades = plannedTrades(assetClasses);

export const rebalanceEvents: RebalanceEvent[] = [
  {
    id: 'rb-2026-10-15',
    date: '2026-10-15',
    trigger: 'scheduled',
    status: 'planned',
    title: '4분기 정기 리밸런싱 예정',
    rationale:
      '해외주식이 목표 대비 +2.8%p 초과 상태입니다. 이탈 임계치(±5%p)에는 미달해 정기 일정에 맞춰 해외주식 일부를 차익 실현하고 채권·현금성 자산을 보강할 예정입니다.',
    trades: upcomingTrades,
    cost: Math.round(turnover(upcomingTrades) * totalValue * 0.0005),
  },
  {
    id: 'rb-2026-08-06',
    date: '2026-08-06',
    trigger: 'drift',
    status: 'completed',
    title: '비중 이탈 리밸런싱',
    rationale:
      '미국 기술주 강세로 해외주식 비중이 목표 대비 +5.1%p까지 확대되어 임계치를 초과했습니다. 초과분을 매도해 채권과 국내주식으로 재배분했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.163, to: 0.17 },
      { assetId: 'global-equity', from: 0.381, to: 0.33 },
      { assetId: 'bond', from: 0.284, to: 0.32 },
      { assetId: 'cash', from: 0.072, to: 0.08 },
    ],
    cost: 31_200,
  },
  {
    id: 'rb-2026-07-01',
    date: '2026-07-01',
    trigger: 'scheduled',
    status: 'completed',
    title: '3분기 정기 리밸런싱',
    rationale:
      '분기 정기 점검 결과 해외주식 +2.2%p, 채권 -1.9%p 이탈을 확인해 목표 비중으로 복원했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.176, to: 0.17 },
      { assetId: 'global-equity', from: 0.352, to: 0.33 },
      { assetId: 'bond', from: 0.301, to: 0.32 },
      { assetId: 'alternative', from: 0.102, to: 0.1 },
      { assetId: 'cash', from: 0.069, to: 0.08 },
    ],
    cost: 16_900,
  },
  {
    id: 'rb-2026-04-09',
    date: '2026-04-09',
    trigger: 'market',
    status: 'completed',
    title: '시장 변동성 대응 조정',
    rationale:
      '변동성 지수(VIX)가 이틀 연속 급등해 위험 예산을 초과했습니다. 전술적 조정 한도(±3%p) 내에서 주식 비중을 줄이고 채권을 늘렸습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.163, to: 0.16 },
      { assetId: 'global-equity', from: 0.318, to: 0.3 },
      { assetId: 'bond', from: 0.33, to: 0.35 },
      { assetId: 'cash', from: 0.089, to: 0.09 },
    ],
    cost: 11_800,
  },
  {
    id: 'rb-2026-04-01',
    date: '2026-04-01',
    trigger: 'scheduled',
    status: 'completed',
    title: '2분기 정기 리밸런싱',
    rationale: '성향 변경 후 첫 정기 점검입니다. 소폭 이탈(±1%p 이내)을 목표 비중으로 정렬했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.168, to: 0.17 },
      { assetId: 'global-equity', from: 0.338, to: 0.33 },
      { assetId: 'bond', from: 0.315, to: 0.32 },
      { assetId: 'cash', from: 0.079, to: 0.08 },
    ],
    cost: 5_400,
  },
  {
    id: 'rb-2026-03-12',
    date: '2026-03-12',
    trigger: 'profile',
    status: 'completed',
    title: '투자 성향 변경 반영',
    rationale:
      '재진단 설문에서 투자 가능 기간이 5년 미만으로 단축되어 성향이 적극투자형 → 위험중립형으로 변경되었습니다. 모델 포트폴리오를 글로벌 밸런스 50/50으로 전환했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.205, to: 0.17 },
      { assetId: 'global-equity', from: 0.428, to: 0.33 },
      { assetId: 'bond', from: 0.215, to: 0.32 },
      { assetId: 'alternative', from: 0.097, to: 0.1 },
      { assetId: 'cash', from: 0.055, to: 0.08 },
    ],
    cost: 64_300,
  },
  {
    id: 'rb-2026-01-02',
    date: '2026-01-02',
    trigger: 'scheduled',
    status: 'completed',
    title: '1분기 정기 리밸런싱',
    rationale: '국내주식 반등으로 +1.4%p 초과된 비중을 채권으로 재배분했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.214, to: 0.2 },
      { assetId: 'global-equity', from: 0.431, to: 0.42 },
      { assetId: 'bond', from: 0.206, to: 0.22 },
      { assetId: 'alternative', from: 0.095, to: 0.1 },
      { assetId: 'cash', from: 0.054, to: 0.06 },
    ],
    cost: 13_700,
  },
  {
    id: 'rb-2025-10-01',
    date: '2025-10-01',
    trigger: 'scheduled',
    status: 'completed',
    title: '4분기 정기 리밸런싱',
    rationale: '해외주식 +1.3%p, 채권 -1.1%p 이탈을 목표 비중으로 복원했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.207, to: 0.2 },
      { assetId: 'global-equity', from: 0.433, to: 0.42 },
      { assetId: 'bond', from: 0.209, to: 0.22 },
      { assetId: 'alternative', from: 0.097, to: 0.1 },
      { assetId: 'cash', from: 0.054, to: 0.06 },
    ],
    cost: 12_100,
  },
  {
    id: 'rb-2025-07-01',
    date: '2025-07-01',
    trigger: 'scheduled',
    status: 'completed',
    title: '3분기 정기 리밸런싱',
    rationale: '4월 방어적 조정을 해제하고 전략적 목표 비중으로 복귀했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.186, to: 0.2 },
      { assetId: 'global-equity', from: 0.401, to: 0.42 },
      { assetId: 'bond', from: 0.243, to: 0.22 },
      { assetId: 'alternative', from: 0.094, to: 0.1 },
      { assetId: 'cash', from: 0.076, to: 0.06 },
    ],
    cost: 17_500,
  },
  {
    id: 'rb-2025-04-07',
    date: '2025-04-07',
    trigger: 'market',
    status: 'completed',
    title: '관세 충격 대응 조정',
    rationale:
      '글로벌 관세 발표로 주식시장이 3거래일 연속 급락했습니다. 손실 한도 관리를 위해 주식 비중을 일시적으로 줄이고 채권·현금을 늘렸습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.196, to: 0.19 },
      { assetId: 'global-equity', from: 0.391, to: 0.38 },
      { assetId: 'bond', from: 0.241, to: 0.25 },
      { assetId: 'cash', from: 0.072, to: 0.08 },
    ],
    cost: 9_800,
  },
  {
    id: 'rb-2025-04-01',
    date: '2025-04-01',
    trigger: 'scheduled',
    status: 'completed',
    title: '2분기 정기 리밸런싱',
    rationale: '해외주식 +1.8%p 초과분을 국내주식과 채권으로 재배분했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.194, to: 0.2 },
      { assetId: 'global-equity', from: 0.438, to: 0.42 },
      { assetId: 'bond', from: 0.214, to: 0.22 },
      { assetId: 'alternative', from: 0.098, to: 0.1 },
      { assetId: 'cash', from: 0.056, to: 0.06 },
    ],
    cost: 10_400,
  },
  {
    id: 'rb-2025-01-02',
    date: '2025-01-02',
    trigger: 'scheduled',
    status: 'completed',
    title: '1분기 정기 리밸런싱',
    rationale: '첫 분기 운용 후 해외주식 +2.7%p 초과분을 목표 비중으로 조정했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0.188, to: 0.2 },
      { assetId: 'global-equity', from: 0.447, to: 0.42 },
      { assetId: 'bond', from: 0.212, to: 0.22 },
      { assetId: 'alternative', from: 0.097, to: 0.1 },
      { assetId: 'cash', from: 0.056, to: 0.06 },
    ],
    cost: 14_600,
  },
  {
    id: 'rb-2024-10-01',
    date: '2024-10-01',
    trigger: 'initial',
    status: 'completed',
    title: '최초 포트폴리오 구성',
    rationale:
      '설문 결과(적극투자형)에 따라 글로벌 그로스 60/40 모델 포트폴리오로 투자 원금 1억 원을 분산 매수했습니다.',
    trades: [
      { assetId: 'kr-equity', from: 0, to: 0.2 },
      { assetId: 'global-equity', from: 0, to: 0.42 },
      { assetId: 'bond', from: 0, to: 0.22 },
      { assetId: 'alternative', from: 0, to: 0.1 },
      { assetId: 'cash', from: 0, to: 0.06 },
    ],
    cost: 48_000,
  },
];
