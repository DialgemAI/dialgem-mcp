import type { Dialgem } from "@dialgem/sdk"
import { z, type ZodRawShape } from "zod"
import { compact } from "./util.js"

/**
 * read   – no side effects.
 * write  – changes your account's configuration (agents, numbers, contacts).
 * spend  – places a real call or buys a number: costs money or reaches a person.
 *          Off unless the operator opts in, because a model can be talked into things.
 */
export type Tier = "read" | "write" | "spend"

export interface ToolDef {
  name: string
  title: string
  description: string
  tier: Tier
  destructive?: boolean
  shape: ZodRawShape
  run: (c: Dialgem, args: Record<string, any>) => Promise<unknown>
}

const id = (what: string) => z.string().min(1).describe(what)
const agentFields = {
  system_prompt: z.string().optional().describe("What the agent is and how it should behave"),
  voice_id: z.string().optional().describe("provider_voice_id from list_voices"),
  first_message: z.string().optional().describe("What the agent says when the call connects"),
  llm_model: z.string().optional(),
  language: z.string().optional().describe("e.g. en-US"),
  extra: z.record(z.unknown()).optional().describe("Any other agent fields, passed through as-is"),
}
const agentBody = (a: Record<string, any>) => {
  const { extra, ...rest } = a
  return { ...(extra ?? {}), ...compact(rest) }
}

/** A call without the bulky per-turn arrays; the transcript is kept as text. */
function slimCall(call: Record<string, any>, full: boolean) {
  if (full) return call
  const { transcript, events, ...rest } = call
  return rest
}

export const TOOLS: ToolDef[] = [
  {
    name: "whoami",
    title: "Current organization",
    description: "Show which Dialgem organization and API key this server is using, and the key's scopes.",
    tier: "read",
    shape: {},
    run: (c) => c.apiKey.retrieve(),
  },
  {
    name: "list_agents",
    title: "List agents",
    description: "List every voice agent in the organization.",
    tier: "read",
    shape: {},
    run: (c) => c.agents.list(),
  },
  {
    name: "get_agent",
    title: "Get agent",
    description: "Get one agent with its full configuration.",
    tier: "read",
    shape: { agent_id: id("Agent id") },
    run: (c, a) => c.agents.retrieve(a.agent_id),
  },
  {
    name: "create_agent",
    title: "Create agent",
    description: "Create a voice agent. Only the name is required.",
    tier: "write",
    shape: { name: id("Display name"), ...agentFields },
    run: (c, { name, ...rest }) => c.agents.create({ name, ...agentBody(rest) } as never),
  },
  {
    name: "update_agent",
    title: "Update agent",
    description: "Change an agent. Only the fields you pass are modified. This edits the live draft.",
    tier: "write",
    shape: { agent_id: id("Agent id"), name: z.string().optional(), ...agentFields },
    run: (c, { agent_id, ...rest }) => c.agents.update(agent_id, agentBody(rest) as never),
  },
  {
    name: "delete_agent",
    title: "Delete agent",
    description: "Permanently delete an agent.",
    tier: "write",
    destructive: true,
    shape: { agent_id: id("Agent id") },
    run: (c, a) => c.agents.delete(a.agent_id),
  },
  {
    name: "publish_agent_version",
    title: "Publish agent version",
    description: "Freeze the agent's current draft as a numbered version that a number or call can pin.",
    tier: "write",
    shape: { agent_id: id("Agent id") },
    run: (c, a) => c.agents.versions.publish(a.agent_id),
  },
  {
    name: "chat_with_agent",
    title: "Chat with agent",
    description:
      "Send one text message to an agent and return its reply. Use it to test a prompt without placing a phone call.",
    tier: "write",
    shape: { agent_id: id("Agent id"), message: id("What the caller says") },
    run: async (c, a) => {
      const chat = await c.chats.create({ agent_id: a.agent_id } as never)
      try {
        return await c.chats.sendMessage(chat.id, a.message)
      } finally {
        await c.chats.end(chat.id).catch(() => undefined)
      }
    },
  },
  {
    name: "list_voices",
    title: "List voices",
    description: "List the voices an agent can use. Pass provider_voice_id as the agent's voice_id.",
    tier: "read",
    shape: {},
    run: (c) => c.voices.list(),
  },
  {
    name: "list_calls",
    title: "List calls",
    description: "List recent calls, newest first, with optional filters.",
    tier: "read",
    shape: {
      agent_id: z.string().optional(),
      status: z.string().optional().describe("e.g. completed, active, failed"),
      direction: z.enum(["inbound", "outbound"]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    run: async (c, a) => {
      const page = await c.calls.list(compact(a) as never)
      return page.data.map((x) => slimCall(x as never, false))
    },
  },
  {
    name: "get_call",
    title: "Get call",
    description: "Get one call: status, cost, analysis and transcript text. Set full to also get per-turn data and events.",
    tier: "read",
    shape: { call_id: id("Call id"), full: z.boolean().default(false) },
    run: async (c, a) => slimCall((await c.calls.retrieve(a.call_id)) as never, a.full),
  },
  {
    name: "stop_call",
    title: "Hang up call",
    description: "End a call that is in progress.",
    tier: "write",
    destructive: true,
    shape: { call_id: id("Call id") },
    run: (c, a) => c.calls.stop(a.call_id),
  },
  {
    name: "start_phone_call",
    title: "Place outbound call",
    description:
      "Place a real outbound phone call from one of your numbers to the given number. It rings a person and uses credit.",
    tier: "spend",
    shape: {
      from: id("One of your numbers, E.164"),
      to: id("Number to call, E.164"),
      agent_id: id("Agent that handles the call"),
      dynamic_variables: z.record(z.string()).optional().describe("Values for {{variables}} in the prompt"),
    },
    run: (c, a) =>
      c.calls.createPhoneCall(
        compact({ from_: a.from, to: a.to, agent_id: a.agent_id, dialgem_llm_dynamic_variables: a.dynamic_variables }) as never,
      ),
  },
  {
    name: "list_phone_numbers",
    title: "List phone numbers",
    description: "List the phone numbers the organization owns and which agent answers each.",
    tier: "read",
    shape: {},
    run: (c) => c.phoneNumbers.list(),
  },
  {
    name: "search_phone_numbers",
    title: "Search available numbers",
    description: "Find phone numbers available to buy. Does not buy anything.",
    tier: "read",
    shape: {
      country: z.string().default("US"),
      area_code: z.string().optional(),
      contains: z.string().optional().describe("Digits the number should contain"),
      limit: z.number().int().min(1).max(50).default(10),
    },
    run: (c, a) => c.phoneNumbers.search(compact(a)),
  },
  {
    name: "buy_phone_number",
    title: "Buy phone number",
    description: "Buy a phone number returned by search_phone_numbers. Charges the account.",
    tier: "spend",
    shape: { phone_number: id("E.164 number from search results"), nickname: z.string().optional() },
    run: (c, a) => c.phoneNumbers.buy(compact(a) as never),
  },
  {
    name: "assign_phone_number",
    title: "Assign number to agent",
    description: "Make an agent answer inbound calls on a number. Pass the number's id, not the digits.",
    tier: "write",
    shape: {
      phone_number_id: id("Phone number id from list_phone_numbers"),
      agent_id: id("Agent id"),
      agent_version: z.number().int().min(1).optional().describe("Pin a published version; omit for the live draft"),
    },
    run: (c, a) => c.phoneNumbers.assign(a.phone_number_id, compact({ agent_id: a.agent_id, agent_version: a.agent_version }) as never),
  },
  {
    name: "list_contacts",
    title: "List contacts",
    description: "List contacts, optionally filtered by a search string.",
    tier: "read",
    shape: { limit: z.number().int().min(1).max(100).default(20) },
    run: async (c, a) => (await c.contacts.list(a as never)).data,
  },
]

/** The tools a given server configuration exposes. */
export function selectTools(opts: { readOnly: boolean; allowSpend: boolean }): ToolDef[] {
  return TOOLS.filter((t) => {
    if (t.tier === "read") return true
    if (opts.readOnly) return false
    return t.tier === "write" || opts.allowSpend
  })
}
