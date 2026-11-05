#!/usr/bin/env node
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

import { createMcpServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 7575);
const IS_DEV = process.env.NODE_ENV !== "production";

function log(level: "INFO" | "WARN" | "ERROR", msg: string, extra?: unknown) {
  const ts = new Date().toISOString();
  const line =
    extra !== undefined
      ? `[${ts}] ${level} ${msg} ${JSON.stringify(extra)}`
      : `[${ts}] ${level} ${msg}`;
  console.error(line);
}

log(
  "INFO",
  `Starting ppi-mcp (NODE_ENV=${process.env.NODE_ENV ?? "undefined"}, port=${PORT})`,
);
log("INFO", "PPI credentials check", {
  PPI_API_KEY: process.env.PPI_API_KEY ? "set" : "MISSING",
  PPI_API_SECRET: process.env.PPI_API_SECRET ? "set" : "MISSING",
  PPI_AUTHORIZED_CLIENT: process.env.PPI_AUTHORIZED_CLIENT ? "set" : "MISSING",
  PPI_CLIENT_KEY: process.env.PPI_CLIENT_KEY ? "set" : "MISSING",
  PPI_BASE_URL: process.env.PPI_BASE_URL ?? "(default sandbox)",
  PPI_API_VERSION: process.env.PPI_API_VERSION ?? "(default 1.0)",
});

// Log once at startup how many trading tools are enabled or skipped.
const startup = createMcpServer();
log(
  "INFO",
  startup.tradingEnabled
    ? `Trading ENABLED (ENABLE_TRADING=true): ${startup.tradingTools.length} trading tools registered`
    : `Trading DISABLED (set ENABLE_TRADING=true to enable): ${startup.skippedTools.length} trading tools skipped`,
);

// Per-session transports — each MCP initialize request gets a fresh server +
// transport pair. This is required because StreamableHTTPServerTransport returns
// 400 "Server already initialized" when an already-initialized transport receives
// a second initialize request (e.g. on client reconnect).
const sessions = new Map<string, StreamableHTTPServerTransport>();

function handleDebug(_req: IncomingMessage, res: ServerResponse) {
  const info = {
    status: "ok",
    server: "ppi-mcp",
    uptime: process.uptime(),
    activeSessions: sessions.size,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "undefined",
      PORT,
      PPI_API_KEY: process.env.PPI_API_KEY ? "set" : "MISSING",
      PPI_API_SECRET: process.env.PPI_API_SECRET ? "set" : "MISSING",
      PPI_AUTHORIZED_CLIENT: process.env.PPI_AUTHORIZED_CLIENT
        ? "set"
        : "MISSING",
      PPI_CLIENT_KEY: process.env.PPI_CLIENT_KEY ? "set" : "MISSING",
      PPI_BASE_URL: process.env.PPI_BASE_URL ?? "(default sandbox)",
      PPI_API_VERSION: process.env.PPI_API_VERSION ?? "(default 1.0)",
    },
  };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(info, null, 2));
}

const httpServer = createServer(async (req, res) => {
  if (IS_DEV && req.method === "GET" && req.url === "/debug") {
    handleDebug(req, res);
    return;
  }

  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }

  let body: unknown;
  if (req.method === "POST") {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
    try {
      body = JSON.parse(raw);
    } catch {
      log("WARN", "Invalid JSON body");
      res.writeHead(400).end("Invalid JSON");
      return;
    }
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  let transport: StreamableHTTPServerTransport;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session — reuse its transport.
    transport = sessions.get(sessionId)!;
  } else if (!sessionId && req.method === "POST") {
    // New session — must be an initialize request. Create a fresh pair.
    const newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    newTransport.onclose = () => {
      const sid = newTransport.sessionId;
      if (sid) {
        sessions.delete(sid);
        log("INFO", `Session closed, removed from pool`, { sessionId: sid });
      }
    };

    const { server: mcpServer } = createMcpServer();
    await mcpServer.connect(newTransport);

    transport = newTransport;
  } else {
    // Session ID provided but unknown, or unexpected method without session.
    log("WARN", "Unknown or missing session", {
      sessionId,
      method: req.method,
    });
    res
      .writeHead(sessionId ? 404 : 400)
      .end(sessionId ? "Session not found" : "Mcp-Session-Id header required");
    return;
  }

  try {
    await transport.handleRequest(req, res, body);

    // Store the session after the initialize request has been processed and
    // the transport has generated its session ID.
    const sid = transport.sessionId;
    if (sid && !sessions.has(sid)) {
      sessions.set(sid, transport);
      log("INFO", `New session created`, { sessionId: sid });
    }

    log("INFO", `${req.method} ${req.url} -> ${res.statusCode}`);
  } catch (err) {
    log("ERROR", "Transport error", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.writeHead(500).end("Internal server error");
  }
});

httpServer.listen(PORT, () => {
  log("INFO", `ppi-mcp listening on http://0.0.0.0:${PORT}/mcp`);
  if (IS_DEV) log("INFO", `Debug endpoint: http://localhost:${PORT}/debug`);
});
