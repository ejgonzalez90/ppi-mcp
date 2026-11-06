# ppi-mcp

An unofficial [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Portfolio Personal Inversiones (PPI)](https://www.portfoliopersonal.com/) REST API, so AI agents such as Claude Code can read your portfolio, quotes and order history and, if you opt in, place orders.

> **Disclaimer.** This project is **not affiliated with, endorsed by, or supported by PPI**. It is provided as-is, **use it at your own risk**. Trading involves financial risk, and an AI agent can make mistakes. **Tools that move money or change state at the broker are disabled by default** and only exist when you set `ENABLE_TRADING=true`. Read the code and try it against the PPI sandbox before pointing it at a real account.

**Transport:** Streamable HTTP, listening on `http://0.0.0.0:7575/mcp` inside the container. The examples publish it on `127.0.0.1` only, because the server has no authentication of its own.

## Features

- 38 tools covering accounts, balances and positions, movements, market data, order history, pre-trade budgets, and reference data (instrument types, markets, settlements, holidays).
- Safe by default: 8 state-changing tools (orders, transfers, bank accounts, investor profile) are not registered unless `ENABLE_TRADING=true`.
- Automatic authentication: login and token refresh are handled for you.
- `ppi_confirm_order` re-reads the order after placing it and returns `{ confirmation, outcome }`, because PPI can acknowledge an order and then cancel it server-side without it ever reaching the market.
- `ppi_get_current_price` and `ppi_get_order_book` attach a `settlementWarning` when PPI answers an `A-48HS`/`A-72HS` request with the `A-24HS` data (a settlement the instrument does not actually trade).
- Ships a catalog of 148 ETF/FCI-EXTERIOR instruments in `src/data/etf-catalog.json`.

## Quick start

Create an env file first (see [Configuration](#configuration)):

```bash
cp .env.example .env
# edit .env and fill in your PPI credentials
```

### a) Docker, prebuilt image

```bash
docker run -d --name ppi-mcp --restart unless-stopped \
  --env-file .env -p 127.0.0.1:7575:7575 ghcr.io/ejgonzalez90/ppi-mcp:latest
```

### b) Docker Compose, build locally

```bash
docker compose up -d
```

This builds the image from the `Dockerfile`, reads `.env`, restarts automatically, and publishes port 7575.

### c) Node.js (development)

Requires Node.js 22+.

```bash
npm ci
npm run dev        # tsx --env-file=.env src/index.ts
```

Or build and run: `npm run build && npm start` (export the variables from `.env` yourself in this case).

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `PPI_API_KEY` | Yes | PPI API key |
| `PPI_API_SECRET` | Yes | PPI API secret |
| `PPI_AUTHORIZED_CLIENT` | Yes | Authorized client identifier |
| `PPI_CLIENT_KEY` | Yes | Client key |
| `PPI_BASE_URL` | No | API base URL. Defaults to the PPI **sandbox** (`https://clientapi_sandbox.portfoliopersonal.com`) |
| `PPI_API_VERSION` | No | API version (default `1.0`) |
| `ENABLE_TRADING` | No | Set to exactly `true` to register the trading tools. Default: off |
| `PORT` | No | Listen port (default `7575`) |

### Getting PPI API credentials

The four `PPI_*` credentials come from PPI: the `.env.example` says to obtain them from your PPI client portal or through an API access request with PPI. This repository cannot tell you more than that; consult PPI's own documentation and support. Out of the box the server talks to the PPI sandbox; set `PPI_BASE_URL` to the base URL PPI gives you for your account to use real data.

### Debug endpoint

When `NODE_ENV` is not `production`, `GET /debug` reports uptime, active sessions and whether each credential is set (never the values).

## Connecting an MCP client

### Claude Code

```bash
claude mcp add --transport http ppi-mcp http://localhost:7575/mcp
```

### Other MCP clients

Any client that supports Streamable HTTP can point at the same URL. For clients configured with JSON, the shape is typically:

```json
{
  "mcpServers": {
    "ppi-mcp": {
      "type": "http",
      "url": "http://localhost:7575/mcp"
    }
  }
}
```

The server has no authentication of its own: anyone who can reach port 7575 can use your PPI credentials. Keep it bound to localhost or a trusted network, never expose it to the internet.

## Tools

Tools marked **trading** are only registered when `ENABLE_TRADING=true`. The budget/estimate tools execute nothing and are always available.

### Account

| Tool | Description | Trading |
|------|-------------|:-------:|
| `ppi_login` | Force re-authentication (normally automatic) | |
| `ppi_get_accounts` | List trading accounts for the authenticated user | |
| `ppi_get_bank_accounts` | Registered bank accounts for an account | |
| `ppi_get_available_balance` | Available cash balance | |
| `ppi_get_balances_and_positions` | Balances and open positions | |
| `ppi_get_movements` | Transaction history within a date range | |
| `ppi_get_investing_profile` | Investor profile for an account | |
| `ppi_get_investing_profile_questions` | Investor profile questionnaire | |
| `ppi_get_investing_profile_instrument_types` | Permitted instrument types | |
| `ppi_create_investing_profile` | Create/update the investor profile | yes |
| `ppi_add_bank_account` | Register a domestic (CBU) bank account | yes |
| `ppi_cancel_bank_account` | Remove a registered bank account | yes |
| `ppi_add_foreign_bank_account` | Register an international bank account | yes |

### Market data

| Tool | Description | Trading |
|------|-------------|:-------:|
| `ppi_search_instrument` | Search by ticker, name, market, or type | |
| `ppi_get_historical_prices` | Historical OHLCV data | |
| `ppi_get_current_price` | Current quote (with settlement alias warning) | |
| `ppi_get_intraday` | Intraday data | |
| `ppi_get_bond_estimate` | Estimated yield/return for a bond | |
| `ppi_get_order_book` | Live bids and asks (with settlement alias warning) | |

### Orders and transfers

| Tool | Description | Trading |
|------|-------------|:-------:|
| `ppi_get_active_orders` | Open orders for an account | |
| `ppi_get_orders_history` | Historical orders within a date range | |
| `ppi_get_order_detail` | Full detail for a single order | |
| `ppi_order_budget` | Pre-trade cost estimate and required disclaimers | |
| `ppi_transfer_budget` | Cost estimate for a funds transfer | |
| `ppi_confirm_order` | Place an order (call `ppi_order_budget` first) | yes |
| `ppi_cancel_order` | Cancel a specific order | yes |
| `ppi_mass_cancel_orders` | Cancel all active orders for an account | yes |
| `ppi_confirm_transfer` | Execute a funds transfer | yes |

### Configuration (reference data)

| Tool | Description | Trading |
|------|-------------|:-------:|
| `ppi_get_instrument_types` | Available security types | |
| `ppi_get_markets` | Available markets | |
| `ppi_get_settlements` | Settlement options | |
| `ppi_get_quantity_types` | Order quantity types | |
| `ppi_get_operation_terms` | Order validity terms | |
| `ppi_get_operation_types` | Order types | |
| `ppi_get_operations` | Operation directions | |
| `ppi_get_holidays` | Holiday calendar | |
| `ppi_is_local_holiday` | Whether today is an Argentine holiday | |
| `ppi_is_usa_holiday` | Whether today is a US holiday | |

At startup the server logs one line saying whether trading is enabled and how many trading tools were registered or skipped.

## Development

```bash
npm ci
npm run dev           # run from source with .env
npm run build         # tsc -> dist/
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest, fully offline (fetch is mocked)
npm run prettier:fix  # format src/**/*.ts
```

Docker targets: `dev` (hot reload with a mounted `src/`), `builder`, and `runtime` (the default final image). See [CLAUDE.md](CLAUDE.md) for architecture notes and how to add a tool.

## License

[MIT](LICENSE) © 2026 ejgonzalez90
