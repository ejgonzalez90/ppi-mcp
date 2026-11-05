import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { register as registerAccount } from "./tools/account.js";
import { register as registerConfig } from "./tools/configuration.js";
import { register as registerMarket } from "./tools/market-data.js";
import { register as registerOrders } from "./tools/orders.js";
import { guardTradingTools, isTradingEnabled } from "./trading.js";

export interface CreatedServer {
  server: McpServer;
  tradingEnabled: boolean;
  /** Trading tools that were registered (ENABLE_TRADING=true). */
  tradingTools: string[];
  /** Trading tools that were left out (ENABLE_TRADING not "true"). */
  skippedTools: string[];
}

export function createMcpServer(
  tradingEnabled: boolean = isTradingEnabled(),
): CreatedServer {
  const server = new McpServer({ name: "ppi-mcp", version: "1.0.0" });
  const { host, skipped, trading } = guardTradingTools(server, tradingEnabled);
  registerAccount(host);
  registerConfig(host);
  registerMarket(host);
  registerOrders(host);
  return { server, tradingEnabled, tradingTools: trading, skippedTools: skipped };
}
