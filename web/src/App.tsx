import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Composer from './components/Composer'
import MessageList, { type PendingTurn } from './components/MessageList'
import SettingsPanel from './components/SettingsPanel'
import Sidebar from './components/Sidebar'
import { MenuIcon, SlidersIcon, SparkIcon } from './components/Icons'
import { api, streamChat } from './lib/api'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadTheme,
  saveSettings,
  saveTheme,
  type Theme,
} from './lib/storage'
import type { Conversation, Message, ModelSpec, Settings } from './types'

const SUGGESTIONS = [
  'SSE로 스트리밍하는 채팅 서버를 어떻게 만드나요?',
  '이 정규식이 무슨 뜻인지 한 줄씩 설명해 줘',
  '회의록을 실행 항목 목록으로 정리해 줘',
  'Explain the CAP theorem to a new backend engineer',
]

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingTurn | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')

  const [models, setModels] = useState<ModelSpec[]>([])
  const [efforts, setEfforts] = useState<Settings['effort'][]>(['high'])
  const [demoMode, setDemoMode] = useState(false)
  const [offline, setOffline] = useState(false)

  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const streaming = pending !== null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  useEffect(() => saveSettings(settings), [settings])

  // Boot: model catalog first, so an unreachable API is reported once rather
  // than as a failure on the user's first message.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const info = await api.info()
        if (cancelled) return
        setModels(info.models)
        setEfforts(info.efforts)
        setDemoMode(info.demoMode)
        setOffline(false)
        setSettings((current) =>
          info.models.some((model) => model.id === current.model)
            ? current
            : { ...current, model: info.defaultModel },
        )
        setConversations(await api.listConversations())
      } catch {
        if (!cancelled) setOffline(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort()
    setActiveId(id)
    setError(null)
    setPending(null)
    try {
      const { conversation, messages: loaded } = await api.getConversation(id)
      setMessages(loaded)
      setSettings((current) => ({
        ...current,
        model: conversation.model,
        systemPrompt: conversation.systemPrompt,
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    }
  }, [])

  function startNewChat() {
    abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    setPending(null)
    setError(null)
    setInput('')
    if (window.innerWidth <= 900) setSidebarOpen(false)
  }

  /**
   * Runs one turn.
   *
   * `retryFrom` re-answers from an existing message: the server drops that
   * message and everything after it, so the local list is trimmed to match
   * before the stream starts.
   */
  const send = useCallback(
    async (text: string, retryFrom?: Message) => {
      if (streaming) return
      if (!text.trim() && !retryFrom) return

      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      setPending({ text: '', thinking: '', tool: null })

      if (retryFrom) {
        setMessages((current) => {
          const index = current.findIndex((message) => message.id === retryFrom.id)
          return index === -1 ? current : current.slice(0, index)
        })
      } else {
        setInput('')
        // Optimistic echo so the user's own message appears instantly; the
        // server's canonical copy replaces it when `meta` arrives.
        setMessages((current) => [
          ...current,
          {
            id: `local-${Date.now()}`,
            conversationId: activeId ?? '',
            role: 'user',
            content: text,
            model: null,
            createdAt: Date.now(),
          },
        ])
      }

      let conversationId = activeId

      await streamChat(
        {
          conversationId: activeId ?? undefined,
          message: retryFrom ? undefined : text,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
          effort: settings.effort,
          showThinking: settings.showThinking,
          webSearch: settings.webSearch,
          retryFromMessageId: retryFrom?.id,
        },
        {
          onMeta: (meta) => {
            conversationId = meta.conversationId
            setActiveId(meta.conversationId)
            if (meta.userMessage) {
              const confirmed = meta.userMessage
              setMessages((current) => {
                const next = [...current]
                const localIndex = next.findIndex((message) => message.id.startsWith('local-'))
                if (localIndex === -1) next.push(confirmed)
                else next[localIndex] = confirmed
                return next
              })
            }
          },
          onDelta: (delta) =>
            setPending((current) => (current ? { ...current, text: current.text + delta } : current)),
          onThinking: (delta) =>
            setPending((current) =>
              current ? { ...current, thinking: current.thinking + delta } : current,
            ),
          onTool: (label) => setPending((current) => (current ? { ...current, tool: label } : current)),
          onRefusal: (message) => setError(message),
          onTitle: (title) =>
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === conversationId ? { ...conversation, title } : conversation,
              ),
            ),
          onDone: ({ message }) => {
            if (message) setMessages((current) => [...current, message])
          },
          onError: (message) => setError(message),
        },
        controller.signal,
      )

      // A stopped stream still persisted whatever had been generated, so the
      // authoritative message list is re-read rather than guessed at.
      setPending(null)
      abortRef.current = null

      try {
        setConversations(await api.listConversations())
        if (conversationId && controller.signal.aborted) {
          const refreshed = await api.getConversation(conversationId)
          setMessages(refreshed.messages)
        }
      } catch {
        /* the turn itself succeeded; a stale sidebar is not worth an alert */
      }
    },
    [activeId, settings, streaming],
  )

  function stop() {
    abortRef.current?.abort()
  }

  async function renameConversation(id: string, title: string) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? { ...conversation, title } : conversation)),
    )
    try {
      await api.renameConversation(id, title)
    } catch {
      setConversations(await api.listConversations().catch(() => conversations))
    }
  }

  async function deleteConversation(id: string) {
    setConversations((current) => current.filter((conversation) => conversation.id !== id))
    if (id === activeId) startNewChat()
    try {
      await api.deleteConversation(id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }

  const activeModel = useMemo(
    () => models.find((model) => model.id === settings.model),
    [models, settings.model],
  )

  const showWelcome = messages.length === 0 && !pending

  return (
    <div className={`app${sidebarOpen ? ' app--with-sidebar' : ''}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        theme={theme}
        onToggle={() => setSidebarOpen(false)}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSelect={(id) => {
          void openConversation(id)
          if (window.innerWidth <= 900) setSidebarOpen(false)
        }}
        onNew={startNewChat}
        onRename={(id, title) => void renameConversation(id, title)}
        onDelete={(id) => void deleteConversation(id)}
      />

      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          {!sidebarOpen && (
            <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Show sidebar">
              <MenuIcon />
            </button>
          )}
          <div className="topbar__title">
            {conversations.find((conversation) => conversation.id === activeId)?.title ?? 'New chat'}
          </div>
          <div className="topbar__right">
            <span className="pill" title={activeModel?.description}>
              {activeModel?.name ?? settings.model}
            </span>
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
            >
              <SlidersIcon />
            </button>
          </div>
        </header>

        {offline && (
          <div className="banner banner--warn">
            API 서버에 연결할 수 없습니다. 백엔드를 실행한 뒤 새로고침하세요 —{' '}
            <code>npm run dev</code>
          </div>
        )}
        {demoMode && !offline && (
          <div className="banner">
            데모 모드입니다. 서버에 <code>ANTHROPIC_API_KEY</code>를 설정하면 실제 모델이 응답합니다.
          </div>
        )}

        {settingsOpen && (
          <SettingsPanel
            models={models}
            efforts={efforts}
            settings={settings}
            disabled={streaming}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {showWelcome ? (
          <div className="welcome">
            <SparkIcon className="welcome__mark" />
            <h1>무엇을 도와드릴까요?</h1>
            <p>Anthropic Claude API 위에 올린 스트리밍 어시스턴트입니다.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => void send(suggestion)} disabled={offline}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            pending={pending}
            error={error}
            onRetry={(message) => void send('', message)}
          />
        )}

        <Composer
          value={input}
          streaming={streaming}
          disabled={offline}
          placeholder={offline ? 'API 서버에 연결할 수 없습니다' : 'Aida에게 무엇이든 물어보세요…'}
          onChange={setInput}
          onSubmit={() => void send(input)}
          onStop={stop}
        />
      </main>
    </div>
  )
}

export { DEFAULT_SETTINGS }
