import { useEffect, useRef, useState } from 'react'
import type { Message } from '../types'
import Markdown from './Markdown'
import { CopyIcon, RetryIcon, SparkIcon } from './Icons'

export interface PendingTurn {
  text: string
  thinking: string
  tool: string | null
}

interface MessageListProps {
  messages: Message[]
  pending: PendingTurn | null
  error: string | null
  onRetry: (message: Message) => void
}

export default function MessageList({ messages, pending, error, onRetry }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // Autoscroll only while the reader is already at the bottom — scrolling up to
  // re-read something mid-stream should not yank them back down.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onScroll = () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      stickToBottom.current = distance < 120
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (stickToBottom.current) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending?.text, pending?.thinking])

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id

  return (
    <div className="messages" ref={scrollerRef}>
      <div className="messages__inner">
        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            canRetry={message.id === lastAssistantId && !pending}
            onRetry={() => onRetry(message)}
          />
        ))}

        {pending && (
          <article className="msg msg--assistant">
            <Avatar />
            <div className="msg__body">
              {pending.thinking && (
                <details className="thinking" open>
                  <summary>Reasoning</summary>
                  <p>{pending.thinking}</p>
                </details>
              )}
              {pending.tool && <p className="tool-note">{pending.tool}…</p>}
              {pending.text ? (
                <Markdown source={pending.text} />
              ) : (
                <span className="dots" aria-label="Thinking">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          </article>
        )}

        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  )
}

function Bubble({
  message,
  canRetry,
  onRetry,
}: {
  message: Message
  canRetry: boolean
  onRetry: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  }

  return (
    <article className={`msg msg--${message.role}`}>
      {message.role === 'assistant' && <Avatar />}

      <div className="msg__body">
        {message.role === 'assistant' ? (
          <Markdown source={message.content} />
        ) : (
          <p className="msg__plain">{message.content}</p>
        )}

        <div className="msg__tools">
          <button className="icon-btn icon-btn--sm" onClick={copy} title="Copy">
            <CopyIcon />
          </button>
          {copied && <span className="msg__flash">Copied</span>}
          {canRetry && (
            <button className="icon-btn icon-btn--sm" onClick={onRetry} title="Regenerate">
              <RetryIcon />
            </button>
          )}
          {message.model && <span className="msg__model">{message.model}</span>}
        </div>
      </div>
    </article>
  )
}

const Avatar = () => (
  <div className="avatar avatar--bot">
    <SparkIcon />
  </div>
)
