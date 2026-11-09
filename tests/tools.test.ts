import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { compact } from "../src/util.js"
import { TOOLS, selectTools } from "../src/tools.js"

describe("selectTools", () => {
  it("hides spend tools by default", () => {
    const names = selectTools({ readOnly: false, allowSpend: false }).map((t) => t.name)
    expect(names).toContain("create_agent")
    expect(names).not.toContain("start_phone_call")
    expect(names).not.toContain("buy_phone_number")
  })
  it("read-only exposes only read tools, even with allowSpend", () => {
    const tools = selectTools({ readOnly: true, allowSpend: true })
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((t) => t.tier === "read")).toBe(true)
  })
  it("allowSpend adds the spend tools", () => {
    const names = selectTools({ readOnly: false, allowSpend: true }).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(["start_phone_call", "buy_phone_number"]))
  })
  it("tool names are unique and schemas are valid zod", () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length)
    for (const t of TOOLS) expect(() => z.object(t.shape)).not.toThrow()
  })
})

describe("tool handlers", () => {
  it("start_phone_call maps `from` to the wire name from_", async () => {
    const createPhoneCall = vi.fn().mockResolvedValue({ call_id: "c1" })
    const tool = TOOLS.find((t) => t.name === "start_phone_call")!
    await tool.run({ calls: { createPhoneCall } } as never, { from: "+1", to: "+2", agent_id: "a" })
    expect(createPhoneCall).toHaveBeenCalledWith({ from_: "+1", to: "+2", agent_id: "a" })
  })
  it("update_agent forwards only the fields given, merging `extra`", async () => {
    const update = vi.fn().mockResolvedValue({})
    const tool = TOOLS.find((t) => t.name === "update_agent")!
    await tool.run({ agents: { update } } as never, { agent_id: "a1", first_message: "Hi", extra: { temperature: 0.2 } })
    expect(update).toHaveBeenCalledWith("a1", { temperature: 0.2, first_message: "Hi" })
  })
  it("get_call drops the per-turn arrays unless full", async () => {
    const call = { id: "c", transcript: [1], events: [2], transcript_text: "hi" }
    const retrieve = vi.fn().mockResolvedValue(call)
    const tool = TOOLS.find((t) => t.name === "get_call")!
    expect(await tool.run({ calls: { retrieve } } as never, { call_id: "c", full: false })).toEqual({ id: "c", transcript_text: "hi" })
    expect(await tool.run({ calls: { retrieve } } as never, { call_id: "c", full: true })).toEqual(call)
  })
})

describe("util", () => {
  it("compact removes undefined only", () => expect(compact({ a: undefined, b: 0, c: "" })).toEqual({ b: 0, c: "" }))
})
