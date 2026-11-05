import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { futureToken, mockFetch } from "./helpers.js";

async function loadClient() {
  vi.resetModules(); // the token cache is module state
  return import("../src/ppi-client.js");
}

const isLogin = (url: URL) => url.pathname.endsWith("/LoginApi");

beforeEach(() => {
  vi.stubEnv("PPI_BASE_URL", "https://ppi.test");
  vi.stubEnv("PPI_API_KEY", "k");
  vi.stubEnv("PPI_API_SECRET", "s");
  vi.stubEnv("PPI_AUTHORIZED_CLIENT", "c");
  vi.stubEnv("PPI_CLIENT_KEY", "ck");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ppi-client", () => {
  it("logs in once, sends bearer + auth headers, and reuses the token", async () => {
    const fetchMock = mockFetch((url) =>
      isLogin(url) ? { body: futureToken("abc") } : { body: { ok: true } },
    );
    const { apiGet } = await loadClient();

    await apiGet("/Account/Accounts");
    await apiGet("/Account/Accounts");

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(3); // 1 login + 2 requests
    const headers = calls[1][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer abc");
    expect(headers.ApiKey).toBe("k");
    expect(headers.ClientKey).toBe("ck");
  });

  it("builds query strings and skips undefined/null params", async () => {
    const fetchMock = mockFetch((url) =>
      isLogin(url) ? { body: futureToken() } : { body: [] },
    );
    const { apiGet } = await loadClient();
    await apiGet("/X", { a: 1, b: undefined, c: null, d: "z" });
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(url.search).toBe("?a=1&d=z");
    expect(url.pathname).toBe("/api/1.0/X");
  });

  it("maps a non-2xx API response to 'PPI API <status>: <body>'", async () => {
    mockFetch((url) =>
      isLogin(url) ? { body: futureToken() } : { status: 500, text: "boom" },
    );
    const { apiGet, apiPost } = await loadClient();
    await expect(apiGet("/X")).rejects.toThrow("PPI API 500: boom");
    await expect(apiPost("/Y", { a: 1 })).rejects.toThrow("PPI API 500: boom");
  });

  it("maps a failed login to 'Login failed: <status> <body>'", async () => {
    mockFetch(() => ({ status: 401, text: "bad creds" }));
    const { apiGet } = await loadClient();
    await expect(apiGet("/X")).rejects.toThrow("Login failed: 401 bad creds");
  });

  it("refreshes a nearly-expired token instead of logging in again", async () => {
    let logins = 0;
    let refreshes = 0;
    const expiring = {
      ...futureToken("old"),
      expirationDate: new Date(Date.now() + 1000).toISOString(),
    };
    mockFetch((url) => {
      if (isLogin(url)) {
        logins++;
        return { body: expiring };
      }
      if (url.pathname.endsWith("/RefreshToken")) {
        refreshes++;
        return { body: futureToken("new") };
      }
      return { body: {} };
    });
    const { apiGet } = await loadClient();
    await apiGet("/X"); // login; token is already inside the 60s window
    await apiGet("/X"); // must refresh, not log in again
    expect(logins).toBe(1);
    expect(refreshes).toBe(1);
  });

  it("manualLogin masks the access token", async () => {
    mockFetch(() => ({ body: futureToken("secret") }));
    const { manualLogin } = await loadClient();
    const out = (await manualLogin()) as { accessToken: string };
    expect(out.accessToken).toBe("***");
  });
});
