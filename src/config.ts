import { Dialgem } from "@dialgem/sdk"

/** The key comes from the environment only: MCP clients inject it in the server's `env` block. */
export function resolveApiKey(): string | undefined {
  return process.env.DIALGEM_API_KEY?.trim() || undefined
}

export function makeClient(): Dialgem {
  const apiKey = resolveApiKey()
  if (!apiKey) throw new Error("DIALGEM_API_KEY is not set.")
  return new Dialgem({ apiKey })
}
