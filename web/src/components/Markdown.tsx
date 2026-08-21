import { useEffect, useMemo, useRef } from 'react'
import { decorateCodeBlocks, renderMarkdown } from '../lib/markdown'

/**
 * Renders sanitized markdown, then upgrades code blocks after paint.
 *
 * Highlighting runs in an effect rather than during render because it needs
 * real DOM nodes to attach a copy button to, and because re-highlighting a
 * half-streamed code fence on every token would be wasted work.
 */
export default function Markdown({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) decorateCodeBlocks(ref.current)
  }, [html])

  return <div ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
