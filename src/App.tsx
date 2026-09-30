import { useMemo, useState } from 'react';
import { AllocationDonut } from './components/AllocationDonut';
import { BellIcon } from './components/Icons';
import { KpiRow } from './components/KpiRow';
import { RebalanceTimeline } from './components/RebalanceTimeline';
import { ReturnsChart } from './components/ReturnsChart';
import { RiskProfileCard } from './components/RiskProfileCard';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
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
import { formatDate } from './lib/format';
import {
  PERIOD_OPTIONS,
  buildAllocation,
  eventsInPeriod,
  lastPoint,
  maxDrawdown,
  sliceAndRebase,
} from './lib/metrics';
import type { Period } from './types';

/** 설문 '감내 가능 손실' 응답 (-15%) */
const LOSS_TOLERANCE = 0.15;

export function App() {
  const [period, setPeriod] = useState<Period>('1Y');
  const periodLabel = PERIOD_OPTIONS.find((o) => o.id === period)!.label;

  const points = useMemo(() => sliceAndRebase(returnSeries, period), [period]);
  const events = useMemo(() => eventsInPeriod(rebalanceEvents, AS_OF, period), [period]);
  const allocation = useMemo(() => buildAllocation(assetClasses, totalValue), []);

  const valueByDate = useMemo(
    () => new Map(returnSeries.map((p) => [p.date, PRINCIPAL * (1 + p.portfolio)])),
    [],
  );
  const valueAt = (date: string) => valueByDate.get(date) ?? totalValue;

  const end = lastPoint(points);
  const startValue = valueAt(points[0]?.date ?? AS_OF);
  const nextPlanned = rebalanceEvents.find((e) => e.status === 'planned');

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{USER_NAME}님의 AI 포트폴리오</h1>
            <p>
              {riskProfile.label} · {riskProfile.modelPortfolio} · {formatDate(AS_OF)} 종가 기준
            </p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" aria-label="알림">
              <BellIcon />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="filter-row" role="group" aria-label="조회 기간">
          <span className="filter-label">조회 기간</span>
          <div className="segmented">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.id} type="button" aria-pressed={period === o.id} onClick={() => setPeriod(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
          <span className="filter-note">
            {formatDate(points[0]?.date ?? AS_OF)} ~ {formatDate(AS_OF)} · 수익률·리밸런싱 내역에 적용
          </span>
        </div>

        <KpiRow
          totalValue={totalValue}
          principal={PRINCIPAL}
          periodLabel={periodLabel}
          periodReturn={end.portfolio}
          periodPnL={totalValue - startValue}
          benchmarkReturn={end.benchmark}
          benchmarkName={BENCHMARK_NAME}
          mdd={maxDrawdown(points, 'portfolio')}
          benchmarkMdd={maxDrawdown(points, 'benchmark')}
          lossTolerance={LOSS_TOLERANCE}
        />

        <div className="grid">
          <ReturnsChart
            points={points}
            period={period}
            periodLabel={periodLabel}
            benchmarkName={BENCHMARK_NAME}
            events={events}
          />
          <RiskProfileCard profile={riskProfile} />
          <AllocationDonut allocation={allocation} totalValue={totalValue} nextRebalanceDate={nextPlanned?.date} />
          <RebalanceTimeline
            key={period}
            events={events}
            assets={assetClasses}
            valueAt={valueAt}
            periodLabel={periodLabel}
          />
        </div>
      </main>
    </div>
  );
}
