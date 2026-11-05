import { z } from "zod";
import type { ToolHost } from "../trading.js";
import { apiGet } from "../ppi-client.js";

export function register(server: ToolHost) {
  server.registerTool(
    "ppi_get_instrument_types",
    {
      description:
        "List all available security/instrument types (e.g. BONOS, ACCIONES, ETF, CEDEARS, etc.).",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/InstrumentTypes"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_markets",
    {
      description:
        "Retrieve the list of available markets (e.g. ROFEX, OTC, NYSE, BYMA).",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiGet("/Configuration/Markets"), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_settlements",
    {
      description:
        "Get available settlement options (e.g. INMEDIATA, A-24HS, A-48HS, A-72HS).",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/Settlements"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_quantity_types",
    {
      description:
        "Get order quantity types (e.g. DINERO, PAPELES, CANTIDAD-TOTAL).",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/QuantityTypes"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_operation_terms",
    { description: "Get available operation validity terms." },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/OperationTerms"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_operation_types",
    { description: "Get order types (e.g. PRECIO-DE-MERCADO, PRECIO-LIMITE)." },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/OperationTypes"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_operations",
    { description: "Get available operation directions (e.g. COMPRA, VENTA)." },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/Operations"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_holidays",
    {
      description: "Get the holiday calendar for a date range.",
      inputSchema: {
        start: z.string().describe("Start date (ISO 8601)"),
        end: z.string().describe("End date (ISO 8601)"),
        isUSA: z
          .boolean()
          .optional()
          .describe(
            "true for US holidays, false (default) for Argentine holidays",
          ),
      },
    },
    async ({ start, end, isUSA }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/Holidays", { start, end, isUSA }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_is_local_holiday",
    { description: "Check whether today is a local (Argentine) holiday." },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/IsLocalHoliday"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_is_usa_holiday",
    { description: "Check whether today is a US holiday." },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Configuration/IsUSAHoliday"),
            null,
            2,
          ),
        },
      ],
    }),
  );
}
