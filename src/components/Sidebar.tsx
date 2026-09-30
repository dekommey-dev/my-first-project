import type { ReactNode } from 'react';
import { HomeIcon, LogoIcon, PieIcon, RefreshIcon, SettingsIcon, UserCheckIcon, WalletIcon } from './Icons';

const NAV: { label: string; icon: ReactNode; href: string }[] = [
  { label: '대시보드', icon: <HomeIcon />, href: '#' },
  { label: '포트폴리오', icon: <PieIcon />, href: '#allocation' },
  { label: '리밸런싱', icon: <RefreshIcon />, href: '#rebalancing' },
  { label: '투자 성향', icon: <UserCheckIcon />, href: '#risk-profile' },
  { label: '입출금', icon: <WalletIcon />, href: '#' },
  { label: '설정', icon: <SettingsIcon />, href: '#' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <LogoIcon size={18} />
        </span>
        Allocare
      </div>
      <nav className="nav" aria-label="주요 메뉴">
        {NAV.map((item, i) => (
          <a key={item.label} href={item.href} aria-current={i === 0 ? 'page' : undefined}>
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">
        <strong>AI 일임 운용 중</strong>
        자동 리밸런싱 · 분기 정기 + 이탈 ±5%p 감시
      </div>
    </aside>
  );
}
