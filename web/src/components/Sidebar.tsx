import { useEffect, useRef, useState } from 'react'
import type { Conversation } from '../types'
import { MenuIcon, MoonIcon, PencilIcon, PlusIcon, SparkIcon, SunIcon, TrashIcon } from './Icons'
import type { Theme } from '../lib/storage'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  open: boolean
  theme: Theme
  onToggle: () => void
  onToggleTheme: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export default function Sidebar({
  conversations,
  activeId,
  open,
  theme,
  onToggle,
  onToggleTheme,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  function startRename(conversation: Conversation) {
    setEditingId(conversation.id)
    setDraft(conversation.title)
  }

  function commitRename() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim())
    setEditingId(null)
  }

  return (
    <aside className={`sidebar${open ? '' : ' sidebar--collapsed'}`} aria-label="Conversations">
      <div className="sidebar__head">
        <div className="brand">
          <SparkIcon className="brand__mark" />
          <span>Aida</span>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Hide sidebar" aria-label="Hide sidebar">
          <MenuIcon />
        </button>
      </div>

      <button className="new-chat" onClick={onNew}>
        <PlusIcon />
        New chat
      </button>

      <nav className="conv-list">
        {conversations.length === 0 && <p className="conv-empty">No conversations yet.</p>}

        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId
          const isEditing = conversation.id === editingId

          return (
            <div key={conversation.id} className={`conv${isActive ? ' conv--active' : ''}`}>
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="conv__input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename()
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <>
                  <button className="conv__title" onClick={() => onSelect(conversation.id)}>
                    {conversation.title}
                  </button>
                  <span className="conv__actions">
                    <button
                      className="icon-btn icon-btn--sm"
                      title="Rename"
                      aria-label={`Rename ${conversation.title}`}
                      onClick={() => startRename(conversation)}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      title="Delete"
                      aria-label={`Delete ${conversation.title}`}
                      onClick={() => onDelete(conversation.id)}
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar__foot">
        <button className="ghost-btn" onClick={onToggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  )
}
