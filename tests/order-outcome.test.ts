import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { futureToken, mockFetch } from "./helpers.js";

async function load() {
  vi.resetModules();
  const orders = await import("../src/tools/orders.js");
  const market = await import("../src/tools/market-data.js");
  return { ...orders, ...market };
}

beforeEach(() => {
  vi.stubEnv("PPI_BASE_URL", "https://ppi.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const isLogin = (url: URL) => url.pathname.endsWith("/LoginApi");

describe("withOutcome (order re-read)", () => {
  it("re-reads the order and returns confirmation + outcome", async () => {
    mockFetch((url) =>
      isLogin(url)
        ? { body: futureToken() }
        : { body: { id: 42, status: "CANCELADA" } },
    );
    const { withOutcome } = await load();
    const res = (await withOutcome("ACC", { id: 42 })) as {
      outcome: { status: string };
    };
    expect(res.outcome.status).toBe("CANCELADA");
  });

  it("skips the re-read when the confirmation has no usable order id", async () => {
    const fetchMock = mockFetch(() => ({ body: {} }));
    const { withOutcome } = await load();
    expect(await withOutcome("ACC", { id: 0 })).toEqual({
      confirmation: { id: 0 },
    });
    expect(await withOutcome("ACC", null)).toEqual({ confirmation: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports outcomeError instead of throwing if the re-read fails", async () => {
    mockFetch((url) =>
      isLogin(url) ? { body: futureToken() } : { status: 503, text: "down" },
    );
    const { withOutcome } = await load();
    const res = (await withOutcome("ACC", { id: 7 })) as Record<
      string,
      unknown
    >;
    expect(res.outcome).toBeNull();
    expect(res.outcomeError).toBe("PPI API 503: down");
  });
});

describe("getQuote (settlement alias detection)", () => {
  const params = { Ticker: "XLVD", Type: "CEDEARS" };

  it("flags A-48HS data identical to A-24HS", async () => {
    mockFetch((url) =>
      isLogin(url)
        ? { body: futureToken() }
        : { body: { price: 10, date: "2026-01-01T10:00:00.123" } },
    );
    const { getQuote } = await load();
    const res = (await getQuote("/MarketData/Book", {
      ...params,
      Settlement: "A-48HS",
    })) as { settlementWarning?: string };
    expect(res.settlementWarning).toContain("A-48HS");
    expect(res.settlementWarning).toContain("A-24HS");
  });

  it("does not flag genuinely different A-48HS data", async () => {
    mockFetch((url) =>
      isLogin(url)
        ? { body: futureToken() }
        : {
            body: {
              price: url.searchParams.get("Settlement") === "A-24HS" ? 10 : 11,
            },
          },
    );
    const { getQuote } = await load();
    const res = await getQuote("/MarketData/Book", {
      ...params,
      Settlement: "A-48HS",
    });
    expect(res).toEqual({ price: 11 });
  });

  it("does not query a reference for A-24HS or INMEDIATA", async () => {
    const fetchMock = mockFetch((url) =>
      isLogin(url) ? { body: futureToken() } : { body: { price: 1 } },
    );
    const { getQuote } = await load();
    await getQuote("/MarketData/Book", { ...params, Settlement: "A-24HS" });
    await getQuote("/MarketData/Book", { ...params, Settlement: "INMEDIATA" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 login + 2 data calls
  });

  it("returns the original data if the reference call fails", async () => {
    let n = 0;
    mockFetch((url) => {
      if (isLogin(url)) return { body: futureToken() };
      return ++n === 1 ? { body: { price: 5 } } : { status: 500, text: "x" };
    });
    const { getQuote } = await load();
    const res = await getQuote("/MarketData/Book", {
      ...params,
      Settlement: "A-72HS",
    });
    expect(res).toEqual({ price: 5 });
  });
});
