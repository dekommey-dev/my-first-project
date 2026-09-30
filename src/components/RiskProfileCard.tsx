import { RISK_GRADES } from '../data/mock';
import { formatDate } from '../lib/format';
import type { RiskProfile } from '../types';
import { Card } from './common';
import { ShieldIcon } from './Icons';

export function RiskProfileCard({ profile }: { profile: RiskProfile }) {
  return (
    <Card
      id="risk-profile"
      className="span-4"
      title="투자 성향 분석"
      subtitle={`설문 기반 진단 · ${formatDate(profile.surveyedAt)}`}
      action={
        <button type="button" className="text-btn">
          상세 결과
        </button>
      }
    >
      <div className="profile-hero">
        <div className="profile-badge">
          <ShieldIcon size={28} />
        </div>
        <div>
          <div className="profile-grade">
            {profile.grade}등급 / 5등급 · 설문 점수 <span className="num">{profile.score}</span>점
          </div>
          <div className="profile-label">{profile.label}</div>
          {profile.previousLabel && (
            <div className="profile-change">
              이전 진단: {profile.previousLabel} → {profile.label}
            </div>
          )}
        </div>
      </div>

      <div
        className="meter"
        role="meter"
        aria-label="투자 위험 선호도"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={profile.grade}
        aria-valuetext={`5단계 중 ${profile.grade}단계, ${profile.label}`}
      >
        <div className="meter-track">
          {RISK_GRADES.map((g, i) => (
            <div key={g} className="meter-seg" data-filled={i < profile.grade} />
          ))}
        </div>
        <div className="meter-labels" aria-hidden="true">
          {RISK_GRADES.map((g, i) => (
            <span key={g} data-current={i + 1 === profile.grade}>
              {g}
            </span>
          ))}
        </div>
      </div>

      <p className="profile-summary">{profile.summary}</p>

      <dl className="kv">
        {profile.answers.map((a) => (
          <div key={a.question}>
            <dt>{a.question}</dt>
            <dd>{a.answer}</dd>
          </div>
        ))}
        <div>
          <dt>기대 수익률</dt>
          <dd>{profile.expectedReturn}</dd>
        </div>
        <div>
          <dt>예상 변동성</dt>
          <dd>{profile.expectedVolatility}</dd>
        </div>
      </dl>

      <div className="profile-model">
        <span>
          적용 모델 <strong>{profile.modelPortfolio}</strong>
          <br />
          다음 정기 재진단 {formatDate(profile.nextSurveyAt)}
        </span>
        <button type="button" className="primary-btn">
          성향 재진단
        </button>
      </div>
    </Card>
  );
}
