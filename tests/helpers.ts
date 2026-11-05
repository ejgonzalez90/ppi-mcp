import { vi } from "vitest";

export type Reply = { status?: number; body?: unknown; text?: string };

/** Replace global fetch with a mock; the network is never touched. */
export function mockFetch(handler: (url: URL, init?: RequestInit) => Reply) {
  const fn = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const { status = 200, body, text } = handler(new URL(String(input)), init);
    return new Response(text ?? JSON.stringify(body ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const futureToken = (access = "tok") => ({
  accessToken: access,
  refreshToken: "ref",
  expirationDate: new Date(Date.now() + 3_600_000).toISOString(),
  tokenType: "Bearer",
});
