# Aida

A self-hosted, ChatGPT-style AI assistant. React front end, Node/Express back
end, streaming answers from the Anthropic Claude API, conversations persisted in
SQLite.

**[Try the interface](https://claude.ai/code/artifact/8d86ce46-ceab-4132-8eb6-978644920bdf)** —
a hosted page that runs the real UI. Streaming, stopping, persistence and
settings all work there; answers are scripted from these docs, because a
published page cannot call a model. Source in [`preview/`](preview/).

## What's in the box

- **Token-by-token streaming** over server-sent events, with a working stop button
  (a stopped answer keeps whatever had already been generated).
- **Conversations** in SQLite — list, rename, delete, reload; titles are written
  automatically from the opening message.
- **Markdown answers** with syntax-highlighted, copyable code blocks, tables and
  links. All model output is sanitized before it reaches the DOM.
- **Model picker** across Claude Opus 5, Sonnet 5 and Haiku 4.5, plus an effort
  setting, a per-conversation system prompt, optional reasoning display, and
  optional web search.
- **Regenerate** any answer; the server rewinds the conversation to that point.
- **Dark and light themes**, keyboard-first composer, and a mobile layout with a
  drawer sidebar.
- **Demo mode** — with no API key the server replies from a built-in script, so
  the whole app is usable before you've signed up for anything.

## Quick start

```bash
git clone <this repo> && cd my-first-project
npm install

cp .env.example .env
# optional — without a key the server runs in demo mode
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env

npm run dev
```

- Front end: <http://localhost:5173>
- API: <http://localhost:8787>

`npm run dev` starts both. The Vite dev server proxies `/api` to the API server,
so the browser only ever talks to one origin and CORS never comes up locally.

Get an API key at <https://console.anthropic.com/settings/keys>.

## Docker

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # omit for demo mode
docker compose up --build
```

Open <http://localhost:8080>. nginx serves the built front end and proxies
`/api` to the API container; conversations live in the `aida-data` volume.

## Configuration

All of it is server-side. Copy `.env.example` to `.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key. Empty ⇒ demo mode. |
| `DEFAULT_MODEL` | `claude-opus-5` | Model used when the client doesn't pick one. |
| `PORT` | `8787` | API listen port. |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins, or `*`. |
| `DATA_DIR` | `./data` | Where `aida.sqlite` is written. |
| `VITE_API_BASE_URL` | *(empty)* | Build-time API base for the front end. Empty ⇒ same origin. |

The API key is only ever read by the server. It is never sent to the browser and
never appears in the bundle.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness, active provider, demo-mode flag. |
| `GET` | `/api/models` | Model catalog with per-model capability flags. |
| `GET` | `/api/conversations` | All conversations, most recently used first. |
| `POST` | `/api/conversations` | Create one. |
| `GET` | `/api/conversations/:id` | One conversation and its messages. |
| `PATCH` | `/api/conversations/:id` | Rename, or change model / system prompt. |
| `DELETE` | `/api/conversations/:id` | Delete it and its messages. |
| `DELETE` | `/api/conversations/:id/messages/:messageId` | Drop that message and everything after it. |
| `POST` | `/api/chat` | Send a turn; responds with an SSE stream. |

### `POST /api/chat`

```jsonc
{
  "conversationId": "…",        // omit to start a new conversation
  "message": "Hello",           // omit when retrying
  "model": "claude-opus-5",
  "systemPrompt": "",
  "effort": "high",             // low | medium | high | xhigh | max
  "showThinking": false,
  "webSearch": false,
  "retryFromMessageId": "…"     // re-answer from this message onward
}
```

The response is `text/event-stream`:

| Event | Payload |
| --- | --- |
| `meta` | `{ conversationId, model, provider, userMessage }` — first frame. |
| `delta` | `{ text }` — a piece of the answer. |
| `thinking` | `{ text }` — reasoning summary, when enabled. |
| `tool` | `{ label }` — a server-side tool started, e.g. web search. |
| `refusal` | `{ message }` — a safety classifier declined the request. |
| `title` | `{ title }` — generated title for a new conversation. |
| `done` | `{ message, usage, refused }` — final frame. |
| `error` | `{ message }` — the turn failed after the stream opened. |

Aborting the HTTP request stops generation; the server persists the partial
answer so the transcript matches what the user actually saw.

## How it's put together

```
server/                    Express API (TypeScript, ESM)
  src/db.ts                SQLite schema and queries (better-sqlite3)
  src/llm/models.ts        Model catalog + per-model capability flags
  src/llm/anthropic.ts     Streaming completions via @anthropic-ai/sdk
  src/llm/demo.ts          Scripted provider used when no key is set
  src/routes/chat.ts       The SSE turn handler
  src/routes/conversations.ts
web/                       React 18 + Vite front end
  src/lib/api.ts           Typed API client and the SSE reader
  src/lib/markdown.ts      marked + DOMPurify + highlight.js
  src/components/          Sidebar, MessageList, Composer, SettingsPanel
```

### Notes on the model layer

The current Claude generation rejects request shapes that older models accepted,
so `server/src/llm/models.ts` records what each model takes and the request
builder consults it:

- `temperature` is **not** sent — it returns a 400 on Opus 5 / Sonnet 5.
  `output_config.effort` is the equivalent knob and is what the UI exposes.
- Thinking is configured as `{ type: 'adaptive' }`, not a token budget.
  `display: 'summarized'` is what streams the reasoning panel.
- Web search uses the `web_search_20260209` server tool, and `pause_turn` is
  handled by continuing the turn rather than treating it as the end.
- Requests opt into server-side refusal fallback. If a key doesn't have that
  beta, the first 400 disables it for the process and the request is retried
  without it, so nothing breaks.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | API + front end together, both watching. |
| `npm run build` | Compile the server and build the front end. |
| `npm start` | Run the compiled server. |
| `npm run typecheck` | Typecheck both workspaces. |
