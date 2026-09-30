import { useMemo, useState } from 'react';
import { AllocationDonut } from './components/AllocationDonut';
import { HeroCard } from './components/HeroCard';
import { InsightCard } from './components/InsightCard';
import { RebalanceTimeline } from './components/RebalanceTimeline';
import { ReturnsChart } from './components/ReturnsChart';
import { RiskProfileCard } from './components/RiskProfileCard';
import { TopNav } from './components/TopNav';
import {
  AS_OF,
  BENCHMARK_NAME,
  PRINCIPAL,
  USER_NAME,
  assetClasses,
  rebalanceEvents,
  returnSeries,
  riskProfile,
  totalValue,
} from './data/mock';
import { buildAllocation, sliceAndRebase } from './lib/metrics';
import type { Period } from './types';

/** 설문 '감내 가능 손실' 응답 (-15%) */
const LOSS_TOLERANCE = 0.15;

export function App() {
  const [period, setPeriod] = useState<Period>('1Y');

  const points = useMemo(() => sliceAndRebase(returnSeries, period), [period]);
  const allocation = useMemo(() => buildAllocation(assetClasses, totalValue), []);
  const valueByDate = useMemo(
    () => new Map(returnSeries.map((p) => [p.date, PRINCIPAL * (1 + p.portfolio)])),
    [],
  );
  const valueAt = (date: string) => valueByDate.get(date) ?? totalValue;

  const planned = rebalanceEvents.find((e) => e.status === 'planned');
  const history = rebalanceEvents.filter((e) => e.status === 'completed');
  const periodPnL = totalValue - valueAt(points[0]?.date ?? AS_OF);

  return (
    <>
      <TopNav />
      <main className="page">
        <div className="col">
          <HeroCard
            userName={USER_NAME}
            totalValue={totalValue}
            principal={PRINCIPAL}
            profileLabel={riskProfile.label}
            asOf={AS_OF}
          />
          <ReturnsChart
            points={points}
            period={period}
            onPeriodChange={setPeriod}
            benchmarkName={BENCHMARK_NAME}
            events={history}
            pnl={periodPnL}
            lossTolerance={LOSS_TOLERANCE}
          />
          <RebalanceTimeline events={history} assets={assetClasses} valueAt={valueAt} />
        </div>
        <div className="col">
          {planned && <InsightCard event={planned} assets={assetClasses} totalValue={totalValue} />}
          <AllocationDonut allocation={allocation} totalValue={totalValue} nextRebalanceDate={planned?.date} />
          <RiskProfileCard profile={riskProfile} />
        </div>
      </main>
    </>
  );
}
