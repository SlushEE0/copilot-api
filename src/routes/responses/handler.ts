import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import { isNullish } from "~/lib/utils"
import {
  createResponses,
  type ResponseObject,
  type ResponsesPayload,
} from "~/services/copilot/create-responses"

export async function handleResponse(c: Context) {
  await checkRateLimit(state)

  let payload = await c.req.json<ResponsesPayload>()
  consola.debug("Request payload:", JSON.stringify(payload).slice(-400))

  const selectedModel = state.models?.data.find(
    (model) => model.id === payload.model,
  )

  if (isNullish(payload.max_output_tokens)) {
    payload = {
      ...payload,
      max_output_tokens: selectedModel?.capabilities.limits.max_output_tokens,
    }
    consola.debug(
      "Set max_output_tokens to:",
      JSON.stringify(payload.max_output_tokens),
    )
  }

  if (state.manualApprove) await awaitApproval()

  const response = await createResponses(payload)

  if (isNonStreaming(response)) {
    consola.debug("Non-streaming response:", JSON.stringify(response))
    return c.json(response)
  }

  consola.debug("Streaming response")
  return streamSSE(c, async (stream) => {
    for await (const chunk of response) {
      consola.debug("Streaming chunk:", JSON.stringify(chunk))
      if (!chunk.data) continue
      await stream.writeSSE({
        event: chunk.event,
        data: chunk.data,
      })
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createResponses>>,
): response is ResponseObject => Object.hasOwn(response, "output")
