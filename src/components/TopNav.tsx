import { USER_NAME } from '../data/mock';
import { BellIcon, LogoIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { label: '홈', href: '#' },
  { label: '수익률', href: '#returns' },
  { label: '자산 비중', href: '#allocation' },
  { label: '리밸런싱', href: '#rebalancing' },
  { label: '투자 성향', href: '#risk-profile' },
];

export function TopNav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href="#">
          <span className="brand-mark">
            <LogoIcon size={16} />
          </span>
          Allocare
        </a>
        <nav className="nav-links" aria-label="주요 메뉴">
          {LINKS.map((l, i) => (
            <a key={l.label} href={l.href} aria-current={i === 0 ? 'page' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button type="button" className="icon-btn" aria-label="알림">
            <BellIcon size={20} />
          </button>
          <ThemeToggle />
          <span className="avatar" aria-label={`${USER_NAME}님`}>
            {USER_NAME.slice(0, 1)}
          </span>
        </div>
      </div>
    </header>
  );
}
