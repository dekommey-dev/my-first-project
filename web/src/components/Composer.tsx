import { useEffect, useRef } from 'react'
import { SendIcon, StopIcon } from './Icons'

interface ComposerProps {
  value: string
  streaming: boolean
  disabled: boolean
  placeholder: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
}

const MAX_HEIGHT = 224

export default function Composer({
  value,
  streaming,
  disabled,
  placeholder,
  onChange,
  onSubmit,
  onStop,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow with the text up to a ceiling, then scroll inside the box.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter (and IME composition) inserts a newline.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!streaming) onSubmit()
  }

  return (
    <div className="composer">
      <div className="composer__box">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Message"
        />

        {streaming ? (
          <button className="send send--stop" onClick={onStop} title="Stop generating">
            <StopIcon />
          </button>
        ) : (
          <button
            className="send"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            title="Send (Enter)"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <p className="composer__hint">
        Enter to send · Shift+Enter for a new line. Responses can be wrong — check anything important.
      </p>
    </div>
  )
}
