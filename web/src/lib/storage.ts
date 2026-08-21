import type { Settings } from '../types'

const KEY = 'aida.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  model: 'claude-opus-5',
  systemPrompt: '',
  effort: 'high',
  showThinking: false,
  webSearch: false,
}

/** Every access is guarded: private windows and blocked site data both throw. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable — settings simply do not persist */
  }
}

const THEME_KEY = 'aida.theme.v1'
export type Theme = 'light' | 'dark'

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}
