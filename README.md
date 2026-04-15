# ppi-mcp

MCP server for the [Portfolio Personal Inversiones (PPI)](https://www.portfoliopersonal.com/) REST API. Exposes 38 tools covering account management, market data, order placement/cancellation, funds transfers, and reference configuration.

**Transport:** Streamable HTTP — listens on `http://0.0.0.0:7575/mcp`.

## Prerequisites

- Docker **or** Node.js 22+
- PPI API credentials (obtained from the PPI client portal)

## Quick start

### 1. Configure credentials

```bash
cp .env.example .env
# Edit .env — set PPI_API_KEY, PPI_API_SECRET, PPI_AUTHORIZED_CLIENT, PPI_CLIENT_KEY
```

### 2. Build and run

```bash
# Production
docker build --target runtime -t ppi-mcp:latest .
docker run -i --rm --env-file .env -p 7575:7575 ppi-mcp:latest

# Development (hot reload — src/ volume-mounted, tsx watch restarts on .ts save)
docker build --target dev -t ppi-mcp:dev .
docker run -i --rm --env-file .env -p 7575:7575 -v "$(pwd)/src:/app/src" ppi-mcp:dev
```

Or via VS Code tasks: **ppi-mcp: Run: production** / **ppi-mcp: Dev: hot reload**.

### 3. Connect from an MCP client

Point the client at `http://localhost:7575/mcp`.

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

## Debug endpoint

In development (`NODE_ENV != production`), a `GET /debug` endpoint returns server health, active session count, and credential status:

```bash
curl http://localhost:7575/debug
```

## Tools

### Account
| Tool | Description |
|------|-------------|
| `ppi_login` | Force re-authentication (auto-triggered normally) |
| `ppi_get_accounts` | List trading accounts for the authenticated user |
| `ppi_get_bank_accounts` | Registered bank accounts for an account |
| `ppi_get_available_balance` | Available cash balance |
| `ppi_get_balances_and_positions` | Balances and open positions |
| `ppi_get_movements` | Transaction history within a date range |
| `ppi_get_investing_profile` | Investor profile for an account |
| `ppi_get_investing_profile_questions` | Investor profile questionnaire |
| `ppi_get_investing_profile_instrument_types` | Permitted instrument types |
| `ppi_create_investing_profile` | Create/update investor profile |
| `ppi_add_bank_account` | Register a domestic (CBU) bank account |
| `ppi_cancel_bank_account` | Remove a registered bank account |
| `ppi_add_foreign_bank_account` | Register an international bank account (SWIFT) |

### Market data
| Tool | Description |
|------|-------------|
| `ppi_search_instrument` | Search by ticker, name, market, or type |
| `ppi_get_historical_prices` | Historical OHLCV data |
| `ppi_get_current_price` | Real-time quote |
| `ppi_get_intraday` | Intraday tick/candle data |
| `ppi_get_bond_estimate` | Estimated yield/return for a bond position |
| `ppi_get_order_book` | Live bids and asks |

### Orders
| Tool | Description |
|------|-------------|
| `ppi_get_active_orders` | Open orders for an account |
| `ppi_get_orders_history` | Historical orders within a date range |
| `ppi_get_order_detail` | Full detail for a single order |
| `ppi_order_budget` | Pre-trade cost estimate + disclaimers |
| `ppi_confirm_order` | Place an order (call `ppi_order_budget` first) |
| `ppi_cancel_order` | Cancel a specific order |
| `ppi_mass_cancel_orders` | Cancel all active orders at once |
| `ppi_transfer_budget` | Cost estimate for a funds transfer |
| `ppi_confirm_transfer` | Execute a funds transfer |

### Configuration (reference data)
| Tool | Description |
|------|-------------|
| `ppi_get_instrument_types` | Available security types (ACCIONES, BONOS, ETF, etc.) |
| `ppi_get_markets` | Available markets (BYMA, ROFEX, NYSE, etc.) |
| `ppi_get_settlements` | Settlement options (INMEDIATA, A-24HS, A-48HS, etc.) |
| `ppi_get_quantity_types` | Order quantity types (DINERO, PAPELES, CANTIDAD-TOTAL) |
| `ppi_get_operation_terms` | Order validity terms |
| `ppi_get_operation_types` | Order types (PRECIO-DE-MERCADO, PRECIO-LIMITE) |
| `ppi_get_operations` | Operation directions (COMPRA, VENTA) |
| `ppi_get_holidays` | Holiday calendar (Argentine or US) |
| `ppi_is_local_holiday` | Whether today is an Argentine holiday |
| `ppi_is_usa_holiday` | Whether today is a US holiday |
