import { z } from "zod";
import type { ToolHost } from "../trading.js";
import { apiGet } from "../ppi-client.js";

/**
 * Asked for a book or quote at A-48HS or A-72HS, PPI answers with the A-24HS
 * data rather than an empty result or an error. A settlement the instrument
 * does not trade is therefore indistinguishable from one it does — the depth
 * looks real, down to the millisecond timestamp. An order sent at the aliased
 * settlement is dropped before it reaches the market, so flag the alias here.
 */
const ALIASED_SETTLEMENTS = new Set(["A-48HS", "A-72HS"]);
const REFERENCE_SETTLEMENT = "A-24HS";

export async function getQuote(
  path: string,
  params: { Ticker: string; Type: string; Settlement?: string },
): Promise<unknown> {
  const data = await apiGet(path, params);
  const { Settlement } = params;

  if (!Settlement || !ALIASED_SETTLEMENTS.has(Settlement)) return data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data;
  }

  let reference: unknown;
  try {
    reference = await apiGet(path, {
      ...params,
      Settlement: REFERENCE_SETTLEMENT,
    });
  } catch {
    return data; // Can't compare, so don't claim anything.
  }
  if (JSON.stringify(data) !== JSON.stringify(reference)) return data;

  return {
    ...data,
    settlementWarning:
      `PPI returned byte-identical data for ${Settlement} and ${REFERENCE_SETTLEMENT}, ` +
      `so this is the ${REFERENCE_SETTLEMENT} response echoed back rather than a ` +
      `${Settlement} market of its own. Do not read it as proof that ${params.Ticker} ` +
      `trades at ${Settlement}: an order sent at an unsupported settlement is cancelled ` +
      `server-side without reaching the market and without appearing in the order ` +
      `history. Price the order off ${REFERENCE_SETTLEMENT} instead, and check that it ` +
      `is quoting before sending.`,
  };
}

export function register(server: ToolHost) {
  server.registerTool(
    "ppi_search_instrument",
    {
      description:
        "Search for securities/instruments by ticker, name, market, or type.",
      inputSchema: {
        ticker: z.string().describe("Ticker symbol (required)"),
        name: z.string().optional().describe("Instrument name filter"),
        market: z
          .string()
          .optional()
          .describe("Market code filter (e.g. BYMA, NYSE)"),
        type: z
          .string()
          .optional()
          .describe("Instrument type filter (e.g. ACCIONES, BONOS)"),
      },
    },
    async ({ ticker, name, market, type }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/MarketData/SearchInstrument", {
              Ticker: ticker,
              Name: name,
              Market: market,
              Type: type,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_historical_prices",
    {
      description:
        "Get historical OHLCV price data for an instrument over a date range.",
      inputSchema: {
        ticker: z.string().describe("Ticker symbol"),
        type: z.string().describe("Instrument type (e.g. ACCIONES)"),
        dateFrom: z.string().describe("Start date (ISO 8601)"),
        dateTo: z.string().describe("End date (ISO 8601)"),
        settlement: z
          .string()
          .optional()
          .describe("Settlement type (e.g. A-48HS)"),
      },
    },
    async ({ ticker, type, dateFrom, dateTo, settlement }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/MarketData/Search", {
              Ticker: ticker,
              Type: type,
              DateFrom: dateFrom,
              DateTo: dateTo,
              Settlement: settlement,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_current_price",
    {
      description:
        "Get real-time market price and quote data for an instrument. A `settlementWarning` in the response means the requested settlement is an alias of A-24HS and is not tradable for this instrument.",
      inputSchema: {
        ticker: z.string().describe("Ticker symbol"),
        type: z.string().describe("Instrument type"),
        settlement: z.string().optional().describe("Settlement type"),
      },
    },
    async ({ ticker, type, settlement }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await getQuote("/MarketData/Current", {
              Ticker: ticker,
              Type: type,
              Settlement: settlement,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_intraday",
    {
      description: "Get intraday tick/candle data for an instrument.",
      inputSchema: {
        ticker: z.string().describe("Ticker symbol"),
        type: z.string().describe("Instrument type"),
        settlement: z.string().optional().describe("Settlement type"),
      },
    },
    async ({ ticker, type, settlement }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/MarketData/Intraday", {
              Ticker: ticker,
              Type: type,
              Settlement: settlement,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_bond_estimate",
    {
      description: "Calculate estimated return/yield for a bond position.",
      inputSchema: {
        ticker: z.string().describe("Bond ticker symbol"),
        date: z.string().describe("Settlement date (ISO 8601)"),
        quantity: z.number().describe("Quantity of bonds"),
        price: z.number().describe("Purchase price"),
        exchangeRate: z.number().optional().describe("FX rate (if applicable)"),
      },
    },
    async ({ ticker, date, quantity, price, exchangeRate }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/MarketData/Bonds/Estimate", {
              Ticker: ticker,
              Date: date,
              Quantity: quantity,
              Price: price,
              ExchangeRate: exchangeRate,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_order_book",
    {
      description:
        "Get the live order book (bids and asks) for an instrument. A `settlementWarning` in the response means the requested settlement is an alias of A-24HS and is not tradable for this instrument — do not read the depth as proof the settlement exists.",
      inputSchema: {
        ticker: z.string().describe("Ticker symbol"),
        type: z.string().describe("Instrument type"),
        settlement: z.string().optional().describe("Settlement type"),
      },
    },
    async ({ ticker, type, settlement }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await getQuote("/MarketData/Book", {
              Ticker: ticker,
              Type: type,
              Settlement: settlement,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );
}
