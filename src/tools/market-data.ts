import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../ppi-client.js";

export function register(server: McpServer) {
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
        "Get real-time market price and quote data for an instrument.",
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
            await apiGet("/MarketData/Current", {
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
      description: "Get the live order book (bids and asks) for an instrument.",
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
            await apiGet("/MarketData/Book", {
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
