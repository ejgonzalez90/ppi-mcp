const BASE_URL =
  process.env.PPI_BASE_URL ?? "https://clientapi_sandbox.portfoliopersonal.com";
const API_VERSION = process.env.PPI_API_VERSION ?? "1.0";

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expirationDate: string;
  tokenType: string;
}

let tokenData: TokenData | null = null;

function authHeaders(): Record<string, string> {
  return {
    ApiKey: process.env.PPI_API_KEY ?? "",
    ApiSecret: process.env.PPI_API_SECRET ?? "",
    AuthorizedClient: process.env.PPI_AUTHORIZED_CLIENT ?? "",
    ClientKey: process.env.PPI_CLIENT_KEY ?? "",
  };
}

function log(msg: string) {
  console.error(`[${new Date().toISOString()}] INFO [ppi-client] ${msg}`);
}

async function freshLogin(): Promise<void> {
  const url = `${BASE_URL}/api/${API_VERSION}/Account/LoginApi`;
  log(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  tokenData = (await res.json()) as TokenData;
  log("Login successful");
}

async function ensureToken(): Promise<string> {
  if (tokenData) {
    const msLeft = new Date(tokenData.expirationDate).getTime() - Date.now();
    if (msLeft > 60_000) return tokenData.accessToken;

    // Try refresh
    try {
      const url = `${BASE_URL}/api/${API_VERSION}/Account/RefreshToken`;
      log(`POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ refreshToken: tokenData.refreshToken }),
      });
      if (res.ok) {
        tokenData = (await res.json()) as TokenData;
        log("Token refreshed");
        return tokenData.accessToken;
      }
    } catch {
      // fall through to fresh login
    }
  }

  await freshLogin();
  return tokenData!.accessToken;
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

export async function apiGet(
  path: string,
  params?: QueryParams,
): Promise<unknown> {
  const token = await ensureToken();
  const url = new URL(`${BASE_URL}/api/${API_VERSION}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, ...authHeaders() },
  });
  if (!res.ok) throw new Error(`PPI API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const token = await ensureToken();
  const url = `${BASE_URL}/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PPI API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Force a new login and return the token response. */
export async function manualLogin(): Promise<unknown> {
  tokenData = null;
  await freshLogin();
  return { ...tokenData!, accessToken: "***" }; // mask token in output
}
