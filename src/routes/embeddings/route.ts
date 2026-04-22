import { Hono } from "hono"
import consola from "consola"

import { forwardError } from "~/lib/error"
import {
  createEmbeddings,
  type EmbeddingRequest,
} from "~/services/copilot/create-embeddings"

export const embeddingRoutes = new Hono()

embeddingRoutes.post("/", async (c) => {
  try {
    const payload = await c.req.json<EmbeddingRequest>()
    consola.debug("Embeddings request payload:", JSON.stringify(payload))
    const response = await createEmbeddings(payload)

    return c.json(response)
  } catch (error) {
    return await forwardError(c, error)
  }
})
