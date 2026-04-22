import consola from "consola"
import { events } from "fetch-event-stream"

import { copilotHeaders, copilotBaseUrl } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

export const createResponses = async (payload: ResponsesPayload) => {
  if (!state.copilotToken) throw new Error("Copilot token not found")

  const enableVision =
    Array.isArray(payload.input)
    && payload.input.some(
      (x) =>
        Array.isArray(x.content)
        && x.content.some((part) => part.type === "input_image"),
    )

  const isAgentCall =
    Array.isArray(payload.input)
    && payload.input.some((msg) => ["assistant", "tool"].includes(msg.role))

  const headers: Record<string, string> = {
    ...copilotHeaders(state, enableVision),
    "X-Initiator": isAgentCall ? "agent" : "user",
  }

  const response = await fetch(`${copilotBaseUrl(state)}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    consola.error(
      `Failed to create response: HTTP ${response.status} ${response.statusText} from ${response.url}`,
    )
    throw new HTTPError("Failed to create response", response)
  }

  if (payload.stream) {
    return events(response)
  }

  return (await response.json()) as ResponseObject
}

// Payload types

export interface ResponsesPayload {
  model: string
  input: string | Array<InputMessage>
  stream?: boolean | null
  temperature?: number | null
  top_p?: number | null
  max_output_tokens?: number | null
  tools?: Array<ResponseTool> | null
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; name: string }
    | null
  previous_response_id?: string | null
  instructions?: string | null
  reasoning?: { effort: "low" | "medium" | "high" } | null
  metadata?: Record<string, string> | null
  user?: string | null
}

export interface InputMessage {
  role: "user" | "assistant" | "system" | "developer" | "tool"
  content: string | Array<InputContentPart>
  name?: string
  tool_call_id?: string
}

export type InputContentPart = InputTextPart | InputImagePart | InputFilePart

export interface InputTextPart {
  type: "input_text"
  text: string
}

export interface InputImagePart {
  type: "input_image"
  image_url?: { url: string; detail?: "low" | "high" | "auto" }
  file_id?: string
}

export interface InputFilePart {
  type: "input_file"
  file_id?: string
  file_url?: string
  filename?: string
}

export interface ResponseTool {
  type: "function"
  name: string
  description?: string
  parameters?: Record<string, unknown>
  strict?: boolean | null
}

// Response types (non-streaming)

export interface ResponseObject {
  id: string
  object: "response"
  created_at: number
  model: string
  output: Array<OutputItem>
  status: "completed" | "incomplete" | "failed" | "cancelled"
  usage?: ResponseUsage
  instructions?: string | null
  error?: ResponseError | null
  metadata?: Record<string, string> | null
}

export type OutputItem = MessageOutputItem | FunctionCallOutputItem

export interface MessageOutputItem {
  type: "message"
  id: string
  role: "assistant"
  content: Array<OutputContentPart>
  status: "completed" | "incomplete"
}

export type OutputContentPart = OutputTextPart | RefusalPart

export interface OutputTextPart {
  type: "output_text"
  text: string
  annotations?: Array<unknown>
}

export interface RefusalPart {
  type: "refusal"
  refusal: string
}

export interface FunctionCallOutputItem {
  type: "function_call"
  id: string
  call_id: string
  name: string
  arguments: string
  status: "completed"
}

export interface ResponseUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: {
    cached_tokens: number
  }
  output_tokens_details?: {
    reasoning_tokens: number
  }
}

export interface ResponseError {
  code: string
  message: string
}
