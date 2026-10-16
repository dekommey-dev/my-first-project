import { useCallback, useEffect, useRef, useState } from 'react'

export interface Segment {
  id: number
  text: string
}

// Web Speech API 타입이 lib.dom에 없어 최소한만 선언한다.
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

const Ctor: (new () => Recognition) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export function useSpeech(lang = 'ko-KR') {
  const [segments, setSegments] = useState<Segment[]>([])
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const wanted = useRef(false)
  const nextId = useRef(0)

  const stop = useCallback(() => {
    wanted.current = false
    rec.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!Ctor) return setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.')
    setError('')
    const r = new Ctor()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript as string
        if (e.results[i].isFinal) setSegments((s) => [...s, { id: nextId.current++, text: t.trim() }])
        else partial += t
      }
      setInterim(partial)
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      setError(e.error === 'not-allowed' ? '마이크 권한이 필요합니다.' : `음성 인식 오류: ${e.error}`)
      stop()
    }
    // 브라우저가 무음으로 세션을 끊어도 사용자가 멈추기 전까지 재시작한다.
    r.onend = () => {
      setInterim('')
      if (wanted.current) r.start()
    }
    rec.current = r
    wanted.current = true
    r.start()
    setListening(true)
  }, [lang, stop])

  useEffect(() => () => stop(), [stop])

  const clear = useCallback(() => {
    setSegments([])
    setInterim('')
  }, [])

  return { segments, interim, listening, error, start, stop, clear, supported: !!Ctor }
}
