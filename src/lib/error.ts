import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import consola from "consola"

export class HTTPError extends Error {
  response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.response = response
  }
}

export async function forwardError(c: Context, error: unknown) {
  if (error instanceof HTTPError) {
    const errorText = await error.response.text()
    let errorJson: unknown
    try {
      errorJson = JSON.parse(errorText)
    } catch {
      errorJson = errorText
    }
    consola.error(
      `HTTP ${error.response.status} error from ${error.response.url}:`,
      errorJson,
    )
    return c.json(
      {
        error: {
          message: errorText,
          type: "error",
        },
      },
      error.response.status as ContentfulStatusCode,
    )
  }

  const err = error instanceof Error ? error : new Error(String(error))
  consola.error(`Unexpected error: ${err.message}`, err.stack ?? err)
  return c.json(
    {
      error: {
        message: err.message,
        type: "error",
      },
    },
    500,
  )
}
