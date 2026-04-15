import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, apiPost, manualLogin } from "../ppi-client.js";

export function register(server: McpServer) {
  server.registerTool(
    "ppi_login",
    {
      description:
        "Force a fresh authentication against the PPI API. Usually not needed as the client authenticates automatically.",
    },
    async () => ({
      content: [
        { type: "text", text: JSON.stringify(await manualLogin(), null, 2) },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_accounts",
    {
      description:
        "Retrieve all available trading accounts for the authenticated user.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await apiGet("/Account/Accounts"), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_bank_accounts",
    {
      description: "List registered bank accounts for a given trading account.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
      },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/BankAccounts", { accountNumber }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_available_balance",
    {
      description:
        "Get the available cash balance for trading on a given account.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
      },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/AvailableBalance", { accountNumber }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_balances_and_positions",
    {
      description: "Retrieve balances and open positions for a given account.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
      },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/BalancesAndPositions", { accountNumber }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_movements",
    {
      description:
        "Get account transaction history within a date range, optionally filtered by ticker.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
        dateFrom: z.string().describe("Start date (ISO 8601, e.g. 2024-01-01)"),
        dateTo: z.string().describe("End date (ISO 8601, e.g. 2024-12-31)"),
        ticker: z
          .string()
          .optional()
          .describe("Optional ticker symbol to filter"),
      },
    },
    async ({ accountNumber, dateFrom, dateTo, ticker }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/Movements", {
              accountNumber,
              dateFrom,
              dateTo,
              ticker,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_investing_profile",
    {
      description: "Retrieve the investor profile for a given account.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
      },
    },
    async ({ accountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/InvestingProfile", { accountNumber }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_investing_profile_questions",
    {
      description:
        "Fetch the questionnaire used to determine the investor profile.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/InvestingProfileQuestions"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_get_investing_profile_instrument_types",
    {
      description:
        "List the permitted investment instrument types for the investor profile.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiGet("/Account/InvestingProfileInstrumentTypes"),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_create_investing_profile",
    {
      description:
        "Create or update the investor profile for an account based on questionnaire answers.",
      inputSchema: {
        accountNumber: z.string().describe("Trading account number"),
        answers: z
          .array(z.record(z.string(), z.unknown()))
          .describe("Array of answers to profile questions"),
        instrumentTypes: z
          .array(z.string())
          .describe("Array of allowed instrument type codes"),
      },
    },
    async ({ accountNumber, answers, instrumentTypes }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Account/InvestingProfile", {
              accountNumber,
              answers,
              instrumentTypes,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_add_bank_account",
    {
      description:
        "Register a domestic (Argentine) bank account for an account.",
      inputSchema: {
        accountNumber: z.string(),
        currency: z.string().describe("e.g. ARS or USD"),
        cbu: z.string(),
        cuit: z.string(),
        alias: z.string().optional(),
        bankAccountNumber: z.string().optional(),
      },
    },
    async ({
      accountNumber,
      currency,
      cbu,
      cuit,
      alias,
      bankAccountNumber,
    }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Account/BankAccount", {
              accountNumber,
              currency,
              cbu,
              cuit,
              alias,
              bankAccountNumber,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_cancel_bank_account",
    {
      description: "Request removal of a registered domestic bank account.",
      inputSchema: {
        accountNumber: z.string(),
        cbu: z.string(),
        bankAccountNumber: z.string().optional(),
      },
    },
    async ({ accountNumber, cbu, bankAccountNumber }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Account/CancelBankAccount", {
              accountNumber,
              cbu,
              bankAccountNumber,
            }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    "ppi_add_foreign_bank_account",
    {
      description: "Register an international bank account for an account.",
      inputSchema: {
        accountNumber: z.string(),
        cuit: z.string(),
        swift: z.string(),
        bankName: z.string(),
        bankAddress: z.string().optional(),
        beneficiaryName: z.string().optional(),
        beneficiaryAddress: z.string().optional(),
        beneficiaryAccount: z.string().optional(),
        intermediarySwift: z.string().optional(),
        intermediaryBankName: z.string().optional(),
        intermediaryBankAddress: z.string().optional(),
      },
    },
    async (args) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await apiPost("/Account/ForeignBankAccount", args),
            null,
            2,
          ),
        },
      ],
    }),
  );
}
