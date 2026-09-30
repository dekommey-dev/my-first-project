import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './Icons';

type Theme = 'light' | 'dark';
const KEY = 'allocare-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** 호스트가 이미 지정한 테마(data-theme)가 있으면 존중하고, 없으면 OS 설정을 따른다. */
function initialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return systemTheme();
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? initialTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* 저장소 차단 시 세션 내에서만 유지 */
        }
      }}
    >
      {theme === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
    </button>
  );
}
