# @dialgem/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for [Dialgem](https://dialgem.com). It lets an AI
assistant (Claude Desktop, Claude Code, Cursor…) manage your voice agents, calls and phone numbers. Built on
[`@dialgem/sdk`](https://github.com/DialgemAI/dialgem-sdk-typescript). For a terminal tool, see `@dialgem/cli`.

## Setup

```json
{
  "mcpServers": {
    "dialgem": {
      "command": "npx",
      "args": ["-y", "@dialgem/mcp"],
      "env": { "DIALGEM_API_KEY": "zk_..." }
    }
  }
}
```

Claude Code: `claude mcp add dialgem -e DIALGEM_API_KEY=zk_... -- npx -y @dialgem/mcp`

The key is read from `DIALGEM_API_KEY` only. Use a scoped key where you can.

## Tools

| Tier | Tools | Exposed |
|---|---|---|
| read | `whoami`, `list_agents`, `get_agent`, `list_voices`, `list_calls`, `get_call`, `list_phone_numbers`, `search_phone_numbers`, `list_contacts` | always |
| write | `create_agent`, `update_agent`, `delete_agent`, `publish_agent_version`, `chat_with_agent`, `stop_call`, `assign_phone_number` | unless `--read-only` |
| spend | `start_phone_call`, `buy_phone_number` | only with `--allow-spend` |

`--allow-spend` is off by default because those two tools ring a real person or charge your account, and a model
can be steered into calling them by text in a transcript or a prompt. Env equivalents: `DIALGEM_MCP_READ_ONLY=1`,
`DIALGEM_MCP_ALLOW_SPEND=1`.

## Development

```
pnpm install && pnpm build && pnpm test
```

## License

Apache-2.0. Copyright 2026 Achroweb Solutions. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
