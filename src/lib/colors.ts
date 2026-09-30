import type { AssetClassId } from '../types';

/** 자산군 → 범주형 팔레트 슬롯 (고정 순서, 필터로 재배정하지 않음) */
export const ASSET_COLOR: Record<AssetClassId, string> = {
  'kr-equity': 'var(--series-1)',
  'global-equity': 'var(--series-2)',
  bond: 'var(--series-3)',
  alternative: 'var(--series-4)',
  cash: 'var(--series-5)',
};
