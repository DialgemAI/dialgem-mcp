import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeClient, resolveApiKey } from "./config.js"
import { selectTools } from "./tools.js"

const args = new Set(process.argv.slice(2))
const flag = (name: string, env: string) => args.has(name) || /^(1|true|yes)$/i.test(process.env[env] ?? "")

if (args.has("--help") || args.has("-h")) {
  console.error(
    [
      "dialgem-mcp: Dialgem tools over the Model Context Protocol (stdio).",
      "",
      "  --read-only    expose only tools that change nothing   (DIALGEM_MCP_READ_ONLY=1)",
      "  --allow-spend  also expose tools that place calls or buy numbers (DIALGEM_MCP_ALLOW_SPEND=1)",
      "",
      "Auth: DIALGEM_API_KEY, set in the server's env block.",
    ].join("\n"),
  )
  process.exit(0)
}

if (!resolveApiKey()) {
  console.error("dialgem-mcp: no API key. Set DIALGEM_API_KEY in the server's env block.")
  process.exit(1)
}

const readOnly = flag("--read-only", "DIALGEM_MCP_READ_ONLY")
const allowSpend = flag("--allow-spend", "DIALGEM_MCP_ALLOW_SPEND")
const client = makeClient()

const server = new McpServer({ name: "dialgem", version: "0.1.0" })

for (const tool of selectTools({ readOnly, allowSpend })) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.shape,
      annotations: {
        readOnlyHint: tool.tier === "read",
        destructiveHint: Boolean(tool.destructive),
        openWorldHint: tool.tier === "spend",
      },
    },
    async (input: Record<string, unknown>) => {
      try {
        const result = await tool.run(client, input)
        return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { ok: true }, null, 2) }] }
      } catch (e) {
        const message = (e as Error).message
        return { isError: true, content: [{ type: "text" as const, text: message }] }
      }
    },
  )
}

// stdout carries the protocol; anything human-readable goes to stderr.
await server.connect(new StdioServerTransport())
console.error(`dialgem-mcp ready${readOnly ? " (read-only)" : ""}${allowSpend && !readOnly ? " (spend tools on)" : ""}`)
