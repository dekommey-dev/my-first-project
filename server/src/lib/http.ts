import type { Response } from 'express'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'error',
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`, 'not_found')
export const badRequest = (message: string) => new HttpError(400, message, 'bad_request')

/** Wraps an async express handler so rejected promises reach the error middleware. */
export function asyncRoute<T extends (...args: never[]) => Promise<unknown>>(handler: T) {
  return (...args: Parameters<T>) => {
    const next = args[2] as unknown as (err: unknown) => void
    ;(handler(...args) as Promise<unknown>).catch(next)
  }
}

/** Puts a response into SSE mode and returns a writer for named events. */
export function openEventStream(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops nginx from buffering the stream and defeating the whole point.
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  let open = true
  res.on('close', () => {
    open = false
  })

  return {
    get open() {
      return open
    },
    send(event: string, data: unknown) {
      if (!open) return
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    },
    close() {
      if (!open) return
      open = false
      res.end()
    },
  }
}

export type EventStream = ReturnType<typeof openEventStream>
