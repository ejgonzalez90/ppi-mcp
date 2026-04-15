# CLAUDE.md — ppi-mcp

MCP server for the Portfolio Personal Inversiones (PPI) REST API. Uses **Streamable HTTP transport** on port 7575 — clients connect over HTTP rather than stdio.

## Tech stack

- **Runtime:** Node.js 22, TypeScript (ESM)
- **MCP SDK:** `@modelcontextprotocol/sdk` — `McpServer` + `StreamableHTTPServerTransport`
- **HTTP server:** Node.js built-in `node:http`
- **Validation:** `zod` v4
- **Build:** `tsc` → `dist/`; dev: `tsx watch`

## Source structure

```
src/
├── index.ts              # HTTP server, session management, request routing
├── ppi-client.ts         # apiGet(), apiPost(), manualLogin() — wraps all PPI API calls
└── tools/
    ├── account.ts        # ppi_login, ppi_get_accounts, ppi_get_bank_accounts, ppi_get_available_balance,
    │                     # ppi_get_balances_and_positions, ppi_get_movements, ppi_get_investing_profile,
    │                     # ppi_get_investing_profile_questions, ppi_get_investing_profile_instrument_types,
    │                     # ppi_create_investing_profile, ppi_add_bank_account, ppi_cancel_bank_account,
    │                     # ppi_add_foreign_bank_account
    ├── configuration.ts  # ppi_get_instrument_types, ppi_get_markets, ppi_get_settlements,
    │                     # ppi_get_quantity_types, ppi_get_operation_terms, ppi_get_operation_types,
    │                     # ppi_get_operations, ppi_get_holidays, ppi_is_local_holiday, ppi_is_usa_holiday
    ├── market-data.ts    # ppi_search_instrument, ppi_get_historical_prices, ppi_get_current_price,
    │                     # ppi_get_intraday, ppi_get_bond_estimate, ppi_get_order_book
    └── orders.ts         # ppi_get_active_orders, ppi_get_orders_history, ppi_get_order_detail,
                          # ppi_order_budget, ppi_confirm_order, ppi_cancel_order, ppi_mass_cancel_orders,
                          # ppi_transfer_budget, ppi_confirm_transfer
```

## Key patterns

- All HTTP calls go through `apiGet(path, params?)` or `apiPost(path, body?)` in `ppi-client.ts`. Never call the PPI API directly.
- Authentication is handled by `ppi-client.ts` automatically on first request. `ppi_login` is exposed as a tool for manual re-auth but is rarely needed.
- **Session management**: each MCP `initialize` request creates a fresh `McpServer` + `StreamableHTTPServerTransport` pair, stored in the `sessions` Map by session ID. This is required because `StreamableHTTPServerTransport` returns 400 on a second `initialize`. Sessions are cleaned up in `transport.onclose`.
- All tool handlers return `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }`.
- Ordering workflow: always call `ppi_order_budget` before `ppi_confirm_order` — budget returns required disclaimers that must be passed back with `accepted: true`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PPI_API_KEY` | Yes | PPI API key |
| `PPI_API_SECRET` | Yes | PPI API secret |
| `PPI_AUTHORIZED_CLIENT` | Yes | Authorized client identifier |
| `PPI_CLIENT_KEY` | Yes | Client key |
| `PPI_BASE_URL` | No | Override base URL (default: PPI sandbox) |
| `PPI_API_VERSION` | No | API version (default: `1.0`) |
| `PORT` | No | Override listen port (default: `7575`) |

## Commands

```bash
npm run build      # tsc → dist/
npm run start      # node dist/index.js
npm run dev        # tsx --env-file=.env src/index.ts
npm run prettier:fix  # format src/**/*.ts

# Docker
docker build --target runtime -t ppi-mcp:latest .
docker build --target dev -t ppi-mcp:dev .
docker run -i --rm --env-file .env -p 7575:7575 ppi-mcp:latest
docker run -i --rm --env-file .env -p 7575:7575 -v "$(pwd)/src:/app/src" ppi-mcp:dev
```

## Debug endpoint

In `NODE_ENV !== "production"`, `GET /debug` returns server health, uptime, active session count, and credential presence check. Useful to verify the container started correctly before connecting an MCP client.

## Transport: Streamable HTTP

Unlike `iol-mcp` (stdio), this server listens on `http://0.0.0.0:7575/mcp`. The MCP endpoint is `POST /mcp` (new session) or `POST/GET /mcp` with `Mcp-Session-Id` header (existing session). Unknown session IDs return 404; missing session ID on non-initialize requests returns 400.

## Adding a new tool

1. Add to the appropriate file under `src/tools/`, or create a new one.
2. Register with `server.registerTool(name, { description, inputSchema }, handler)`.
3. Import and call your `register` function from `src/index.ts` inside `createMcpServer()`.
4. Use only `apiGet()` or `apiPost()` for PPI API calls.
