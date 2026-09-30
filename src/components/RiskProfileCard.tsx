import { RISK_GRADES } from '../data/mock';
import { formatDate } from '../lib/format';
import type { RiskProfile } from '../types';
import { Card } from './common';

/** 카드에 노출할 설문 응답 (나머지는 상세 결과에서) */
const SHOWN_ANSWERS = ['투자 목적', '투자 가능 기간', '감내 가능 손실', '투자 경험'];

export function RiskProfileCard({ profile }: { profile: RiskProfile }) {
  const answers = profile.answers.filter((a) => SHOWN_ANSWERS.includes(a.question));
  return (
    <Card id="risk-profile" className="order-5" title="내 투자 성향">
      <div className="profile-type">{profile.label}</div>
      <div className="profile-meta">
        5단계 중 {profile.grade}단계 · 설문 {profile.score}점 · {formatDate(profile.surveyedAt)} 진단
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
        {answers.map((a) => (
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
          <dt>적용 포트폴리오</dt>
          <dd>{profile.modelPortfolio}</dd>
        </div>
      </dl>

      <button type="button" className="btn btn-grey btn-block">
        투자 성향 다시 진단하기
      </button>
    </Card>
  );
}
