import { describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.js";
import { TRADING_TOOLS, isTradingEnabled } from "../src/trading.js";

function registeredTools(server: unknown): string[] {
  // McpServer keeps registered tools in a plain object keyed by name.
  return Object.keys(
    (server as { _registeredTools: Record<string, unknown> })._registeredTools,
  );
}

describe("ENABLE_TRADING guard", () => {
  it("only enables trading for the exact string 'true'", () => {
    expect(isTradingEnabled({ ENABLE_TRADING: "true" })).toBe(true);
    for (const v of [undefined, "", "false", "TRUE", "1", "yes"]) {
      expect(isTradingEnabled({ ENABLE_TRADING: v })).toBe(false);
    }
  });

  it("omits every trading tool when disabled", () => {
    const { server, skippedTools, tradingTools } = createMcpServer(false);
    const names = registeredTools(server);
    for (const t of TRADING_TOOLS) expect(names).not.toContain(t);
    expect(skippedTools.sort()).toEqual([...TRADING_TOOLS].sort());
    expect(tradingTools).toEqual([]);
  });

  it("keeps read-only and budget tools when disabled", () => {
    const names = registeredTools(createMcpServer(false).server);
    for (const t of [
      "ppi_get_accounts",
      "ppi_get_balances_and_positions",
      "ppi_get_orders_history",
      "ppi_order_budget",
      "ppi_transfer_budget",
      "ppi_get_current_price",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("registers every trading tool when enabled", () => {
    const { server, skippedTools, tradingTools } = createMcpServer(true);
    const names = registeredTools(server);
    for (const t of TRADING_TOOLS) expect(names).toContain(t);
    expect(skippedTools).toEqual([]);
    expect(tradingTools.length).toBe(TRADING_TOOLS.size);
  });
});
