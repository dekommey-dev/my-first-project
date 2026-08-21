import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { Marked } from 'marked'

const marked = new Marked({ gfm: true, breaks: true })

/**
 * Renders assistant markdown to HTML.
 *
 * Model output is untrusted input as far as the DOM is concerned — a reply can
 * contain raw HTML, either because the user asked for it or because something
 * upstream injected it — so everything is sanitized before it is inserted.
 */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'srcset'],
  })
}

/** Highlights code blocks and gives each one a language label and copy button. */
export function decorateCodeBlocks(root: HTMLElement): void {
  for (const block of root.querySelectorAll<HTMLElement>('pre > code')) {
    const pre = block.parentElement as HTMLPreElement
    if (pre.dataset.decorated === 'true') continue

    const declared = /language-([\w+-]+)/.exec(block.className)?.[1]
    const language = declared && hljs.getLanguage(declared) ? declared : undefined

    try {
      const result = language
        ? hljs.highlight(block.textContent ?? '', { language })
        : hljs.highlightAuto(block.textContent ?? '')
      block.innerHTML = result.value
      pre.dataset.language = language ?? result.language ?? 'text'
    } catch {
      pre.dataset.language = language ?? 'text'
    }

    pre.dataset.decorated = 'true'
    pre.append(buildCopyButton(() => block.textContent ?? ''))
  }

  for (const anchor of root.querySelectorAll('a[href]')) {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  }
}

function buildCopyButton(getText: () => string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'code-copy'
  button.textContent = 'Copy'
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText())
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Copy failed'
    }
    setTimeout(() => {
      button.textContent = 'Copy'
    }, 1400)
  })
  return button
}
