import { useEffect, useRef, useState } from 'react'
import { useSpeech } from './useSpeech'

const AUTO_EVERY = 3

export default function App() {
  const [lang, setLang] = useState('ko-KR')
  const [auto, setAuto] = useState(false)
  const { segments, interim, listening, error, start, stop, clear, supported } = useSpeech(lang)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments, interim])

  const transcript = segments.map((s) => s.text).join('\n')

  // 자동 추천: 마지막 추천 이후 문장이 AUTO_EVERY개 쌓이면 요청한다.
  useEffect(() => {
    if (segments.length < lastCount.current) lastCount.current = 0
    if (auto && !loading && segments.length - lastCount.current >= AUTO_EVERY) recommend()
  }, [segments, auto, loading])

  function exportTxt() {
    const url = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function recommend() {
    lastCount.current = segments.length
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
          <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening} aria-label="인식 언어">
            <option value="ko-KR">한국어</option>
            <option value="en-US">English</option>
          </select>
          <button className={listening ? 'danger' : 'primary'} onClick={listening ? stop : start} disabled={!supported}>
            {listening ? '● 녹음 중지' : '🎙 녹음 시작'}
          </button>
          <button onClick={clear} disabled={!segments.length}>
            지우기
          </button>
          <button onClick={exportTxt} disabled={!segments.length}>
            내보내기
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
        <div className="actions">
          <button className="primary" onClick={recommend} disabled={!segments.length || loading}>
            {loading ? '생성 중…' : '응답 추천받기'}
          </button>
          <label className="auto">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            문장 {AUTO_EVERY}개마다 자동 추천
          </label>
        </div>
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
