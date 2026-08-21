import type { Effort, ModelSpec, Settings } from '../types'

interface SettingsPanelProps {
  models: ModelSpec[]
  efforts: Effort[]
  settings: Settings
  disabled: boolean
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

export default function SettingsPanel({
  models,
  efforts,
  settings,
  disabled,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const active = models.find((model) => model.id === settings.model)

  return (
    <div className="settings" role="dialog" aria-label="Conversation settings">
      <header className="settings__head">
        <h2>Settings</h2>
        <button className="ghost-btn" onClick={onClose}>
          Done
        </button>
      </header>

      <label className="field">
        <span className="field__label">Model</span>
        <select
          value={settings.model}
          disabled={disabled}
          onChange={(event) => onChange({ model: event.target.value })}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        {active && <span className="field__hint">{active.description}</span>}
      </label>

      <label className="field">
        <span className="field__label">Effort</span>
        <select
          value={settings.effort}
          disabled={disabled || !active?.supportsEffort}
          onChange={(event) => onChange({ effort: event.target.value as Effort })}
        >
          {efforts.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
        <span className="field__hint">
          {active?.supportsEffort
            ? 'How much thinking the model spends per turn. Higher costs more and answers better.'
            : `${active?.name ?? 'This model'} does not accept an effort setting.`}
        </span>
      </label>

      <label className="field">
        <span className="field__label">System prompt</span>
        <textarea
          rows={5}
          placeholder="You are a helpful assistant…"
          value={settings.systemPrompt}
          disabled={disabled}
          onChange={(event) => onChange({ systemPrompt: event.target.value })}
        />
        <span className="field__hint">Applies to the current conversation.</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.showThinking}
          disabled={disabled || !active?.supportsAdaptiveThinking}
          onChange={(event) => onChange({ showThinking: event.target.checked })}
        />
        <span>
          <strong>Show reasoning</strong>
          <small>Streams a summary of the model's thinking above each answer.</small>
        </span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.webSearch}
          disabled={disabled || !active?.supportsWebSearch}
          onChange={(event) => onChange({ webSearch: event.target.checked })}
        />
        <span>
          <strong>Web search</strong>
          <small>Lets the model look things up before answering.</small>
        </span>
      </label>
    </div>
  )
}
