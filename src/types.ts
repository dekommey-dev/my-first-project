/** 금융투자협회 표준 5단계 투자 성향 */
export type RiskGrade = 1 | 2 | 3 | 4 | 5;

export interface SurveyAnswer {
  question: string;
  answer: string;
}

export interface RiskProfile {
  grade: RiskGrade;
  label: string;
  /** 설문 점수 (0–100) */
  score: number;
  surveyedAt: string;
  nextSurveyAt: string;
  previousLabel?: string;
  summary: string;
  modelPortfolio: string;
  expectedReturn: string;
  expectedVolatility: string;
  answers: SurveyAnswer[];
}

export type AssetClassId = 'kr-equity' | 'global-equity' | 'bond' | 'alternative' | 'cash';

export interface AssetClass {
  id: AssetClassId;
  name: string;
  /** 대표 편입 상품 */
  holdings: string;
  /** 현재 비중 (0–1) */
  weight: number;
  /** 목표 비중 (0–1) */
  targetWeight: number;
}

export interface AssetAllocation extends AssetClass {
  value: number;
  /** 현재 − 목표 (0–1 스케일, %p 표시 시 ×100) */
  drift: number;
}

export interface ReturnPoint {
  date: string;
  /** 누적 수익률 (0.1 = +10%) */
  portfolio: number;
  benchmark: number;
}

export type RebalanceTrigger = 'initial' | 'scheduled' | 'drift' | 'market' | 'profile';
export type RebalanceStatus = 'completed' | 'planned';

export interface RebalanceTrade {
  assetId: AssetClassId;
  from: number;
  to: number;
}

export interface RebalanceEvent {
  id: string;
  date: string;
  trigger: RebalanceTrigger;
  status: RebalanceStatus;
  title: string;
  rationale: string;
  trades: RebalanceTrade[];
  /** 거래 비용 (원) */
  cost: number;
}

export type Period = '1M' | '3M' | '6M' | '1Y' | 'ALL';
