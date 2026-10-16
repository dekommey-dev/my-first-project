import { useEffect, useRef, useState } from 'react'
import { useSpeech } from './useSpeech'

export default function App() {
  const { segments, interim, listening, error, start, stop, clear, supported } = useSpeech()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments, interim])

  const transcript = segments.map((s) => s.text).join('\n')

  async function recommend() {
    setLoading(true)
    setApiError('')
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '요청 실패')
      setSuggestions(json.suggestions)
    } catch (e) {
      setApiError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header>
        <h1>회의 도우미</h1>
        <div className="actions">
          <button className={listening ? 'danger' : 'primary'} onClick={listening ? stop : start} disabled={!supported}>
            {listening ? '● 녹음 중지' : '🎙 녹음 시작'}
          </button>
          <button onClick={clear} disabled={!segments.length}>
            지우기
          </button>
        </div>
      </header>

      {(error || !supported) && <p className="error">{error || '이 브라우저는 음성 인식을 지원하지 않습니다.'}</p>}

      <section className="panel">
        <h2>실시간 전사</h2>
        <div className="transcript">
          {!segments.length && !interim && <p className="muted">녹음을 시작하면 말한 내용이 여기에 표시됩니다.</p>}
          {segments.map((s) => (
            <p key={s.id}>{s.text}</p>
          ))}
          {interim && <p className="muted">{interim}</p>}
          <div ref={endRef} />
        </div>
      </section>

      <section className="panel">
        <h2>추천 응답</h2>
        <button className="primary" onClick={recommend} disabled={!segments.length || loading}>
          {loading ? '생성 중…' : '응답 추천받기'}
        </button>
        {apiError && <p className="error">{apiError}</p>}
        <ul className="suggestions">
          {suggestions.map((s, i) => (
            <li key={i}>
              <span>{s}</span>
              <button onClick={() => navigator.clipboard.writeText(s)}>복사</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
