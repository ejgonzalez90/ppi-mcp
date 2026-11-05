import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** The only part of McpServer that tool modules rely on. */
export type ToolHost = Pick<McpServer, "registerTool">;

/**
 * Tools that move money or change state at the broker. They are registered
 * only when ENABLE_TRADING=true. Read-only tools (including budget/estimate
 * calls, which execute nothing) are always available.
 */
export const TRADING_TOOLS: ReadonlySet<string> = new Set([
  "ppi_confirm_order",
  "ppi_cancel_order",
  "ppi_mass_cancel_orders",
  "ppi_confirm_transfer",
  "ppi_add_bank_account",
  "ppi_add_foreign_bank_account",
  "ppi_cancel_bank_account",
  "ppi_create_investing_profile",
]);

export function isTradingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.ENABLE_TRADING === "true";
}

/**
 * Wrap a server so registrations of trading tools are dropped unless trading
 * is enabled. `skipped` and `registered` are filled in as tools register.
 */
export function guardTradingTools(
  server: ToolHost,
  enabled: boolean,
): { host: ToolHost; skipped: string[]; trading: string[] } {
  const skipped: string[] = [];
  const trading: string[] = [];
  const host: ToolHost = {
    registerTool: ((name: string, ...rest: unknown[]) => {
      if (TRADING_TOOLS.has(name)) {
        if (!enabled) {
          skipped.push(name);
          return undefined;
        }
        trading.push(name);
      }
      return (server.registerTool as (...a: unknown[]) => unknown)(
        name,
        ...rest,
      );
    }) as ToolHost["registerTool"],
  };
  return { host, skipped, trading };
}
