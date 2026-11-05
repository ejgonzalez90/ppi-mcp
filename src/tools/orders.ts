import { z } from "zod";
import type { ToolHost } from "../trading.js";
import { apiGet, apiPost } from "../ppi-client.js";

const orderFields = {
  accountNumber: z.string(),
  ticker: z.string().describe("Instrument ticker symbol"),
  instrumentType: z.string().describe("Instrument type (e.g. ACCIONES, BONOS)"),
  operation: z.string().describe("COMPRA or VENTA"),
  operationType: z.string().describe("PRECIO-DE-MERCADO or PRECIO-LIMITE"),
  settlement: z.string().describe("Settlement (e.g. A-48HS, INMEDIATA)"),
  quantity: z.number().describe("Quantity"),
  price: z
    .number()
    .optional()
    .describe("Limit price (required for PRECIO-LIMITE)"),
  quantityType: z
    .string()
    .optional()
    .describe("DINERO, PAPELES, or CANTIDAD-TOTAL"),
  operationTerm: z.string().optional().describe("Validity term"),
  operationMaxDate: z
    .string()
    .optional()
    .describe("Expiry date-time (ISO 8601)"),
  activationPrice: z.number().optional().describe("Stop activation price"),
  externalID: z.string().optional().describe("Optional client-side order ID"),
  disclaimers: z
    .array(
      z.object({
        code: z.string().optional(),
        description: z.string().optional(),
        mandatory: z.boolean().optional(),
        accepted: z.boolean().optional(),
      }),
    )
    .optional()
    .describe("Disclaimer acceptances (returned by ppi_order_budget)"),
};

/**
 * PPI acknowledges an order with PENDIENTE-DE-EJECUCION and may then drop it
 * server-side without ever routing it to the market — an order sent at a
 * settlement the instrument does not trade dies this way, and the cancelled
 * order never shows up in /Order/Orders either. Re-read the order so callers
 * see the real outcome instead of the optimistic acknowledgement.
 */
async function withOutcome(
  accountNumber: string,
  confirmation: unknown,
): Promise<unknown> {
  const orderID = (confirmation as { id?: number } | null)?.id;
  if (typeof orderID !== "number" || orderID === 0) return { confirmation };

  try {
    return {
      confirmation,
      outcome: await apiGet("/Order/Detail", { accountNumber, orderID }),
    };
  } catch (err) {
    return {
      confirmation,
      outcome: null,
      outcomeError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function register(server: ToolHost) {
  server.registerTool(
    "ppi_get_active_orders",
    {
      description: "List all currently open/active orders for an account.",
      inputSchema: { accountNumber: z.string() },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Order/ActiveOrders", { accountNumber }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_orders_history",
    {
      description:
        "Retrieve historical orders for an account within a date range.",
      inputSchema: {
        accountNumber: z.string(),
        dateFrom: z.string().describe("Start date (ISO 8601)"),
        dateTo: z.string().describe("End date (ISO 8601)"),
      },
    },
    async ({ accountNumber, dateFrom, dateTo }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Order/Orders", { accountNumber, dateFrom, dateTo }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_order_detail",
    {
      description: "Get full details of a single order by its ID.",
      inputSchema: {
        accountNumber: z.string(),
        orderID: z.number().describe("PPI order ID"),
        externalID: z
          .string()
          .optional()
          .describe("Optional client-side order ID"),
      },
    },
    async ({ accountNumber, orderID, externalID }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Order/Detail", {
              accountNumber,
              orderID,
              externalID,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_order_budget",
    {
      description:
        "Get a pre-trade cost estimate for an order. Returns fees and any required disclaimers that must be accepted before confirming.",
      inputSchema: {
        accountNumber: orderFields.accountNumber,
        ticker: orderFields.ticker,
        instrumentType: orderFields.instrumentType,
        operation: orderFields.operation,
        operationType: orderFields.operationType,
        settlement: orderFields.settlement,
        quantity: orderFields.quantity,
        price: orderFields.price,
        quantityType: orderFields.quantityType,
        operationTerm: orderFields.operationTerm,
        operationMaxDate: orderFields.operationMaxDate,
        externalID: orderFields.externalID,
      },
    },
    async (args) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiPost("/Order/Budget", args), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_confirm_order",
    {
      description:
        "Place a new order. Call ppi_order_budget first to get required disclaimers, then include them (with accepted: true) here. Returns { confirmation, outcome }: `confirmation` is PPI's acknowledgement, `outcome` is the order re-read straight afterwards. Trust `outcome.status` — an accepted order can still come back CANCELADA without ever reaching the market.",
      inputSchema: {
        accountNumber: orderFields.accountNumber,
        ticker: orderFields.ticker,
        instrumentType: orderFields.instrumentType,
        operation: orderFields.operation,
        operationType: orderFields.operationType,
        settlement: orderFields.settlement,
        quantity: orderFields.quantity,
        price: orderFields.price,
        quantityType: orderFields.quantityType,
        operationTerm: orderFields.operationTerm,
        operationMaxDate: orderFields.operationMaxDate,
        activationPrice: orderFields.activationPrice,
        externalID: orderFields.externalID,
        disclaimers: orderFields.disclaimers,
      },
    },
    async (args) => {
      const confirmation = await apiPost("/Order/Confirm", args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await withOutcome(args.accountNumber, confirmation),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "ppi_cancel_order",
    {
      description: "Request cancellation of a specific active order.",
      inputSchema: {
        accountNumber: z.string(),
        orderID: z.number().describe("PPI order ID"),
        externalID: z
          .string()
          .optional()
          .describe("Optional client-side order ID"),
      },
    },
    async (args) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiPost("/Order/Cancel", args), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_mass_cancel_orders",
    {
      description: "Cancel ALL active orders for an account at once.",
      inputSchema: { accountNumber: z.string() },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost(
              `/Order/MassCancel?accountNumber=${encodeURIComponent(accountNumber)}`,
            ),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_transfer_budget",
    {
      description:
        "Get a cost estimate for a funds transfer before executing it.",
      inputSchema: {
        accountNumber: z.string(),
        cuit: z.string(),
        currency: z.string().describe("ARS or USD"),
        cbu: z.string(),
        amount: z.number(),
      },
    },
    async (args) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Order/BudgetTransfer", args),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_confirm_transfer",
    {
      description: "Execute a funds transfer to a registered bank account.",
      inputSchema: {
        accountNumber: z.string(),
        cuit: z.string(),
        currency: z.string().describe("ARS or USD"),
        cbu: z.string(),
        amount: z.number(),
      },
    },
    async (args) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Order/ConfirmTransfer", args),
            null,
            2,
          ),
        },
      ],
    }),
  );
}
