import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Etf {
  ticker_us: string;
  ppi_ticker: string;
  name: string;
  leverage_factor: number | null;
  is_leveraged: boolean | null;
  is_inverse: boolean | null;
  cedear_ratio: number | null;
}
const catalog = JSON.parse(
  readFileSync(
    new URL("../src/data/etf-catalog.json", import.meta.url),
    "utf8",
  ),
) as { meta: { total_instruments: number }; etfs: Etf[] };

const find = (q: string) =>
  catalog.etfs.filter(
    (e) =>
      e.ticker_us.toLowerCase() === q.toLowerCase() ||
      e.ppi_ticker.toLowerCase() === q.toLowerCase() ||
      e.name.toLowerCase().includes(q.toLowerCase()),
  );

describe("ETF catalog", () => {
  it("meta.total_instruments matches the entries", () => {
    expect(catalog.etfs).toHaveLength(catalog.meta.total_instruments);
  });

  it("has unique PPI tickers and complete required fields", () => {
    const tickers = catalog.etfs.map((e) => e.ppi_ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const e of catalog.etfs) {
      expect(e.ticker_us).toBeTruthy();
      expect(e.name).toBeTruthy();
    }
  });

  it("leverage flags agree with leverage_factor when known", () => {
    for (const e of catalog.etfs) {
      if (e.leverage_factor === null) continue;
      if (e.is_inverse !== null) {
        expect(e.is_inverse).toBe(e.leverage_factor < 0);
      }
      if (e.is_leveraged !== null) {
        expect(e.is_leveraged).toBe(Math.abs(e.leverage_factor) > 1);
      }
    }
  });

  it("lookup by ticker or name fragment works", () => {
    expect(find("AGT")[0]?.name).toContain("Argentina");
    expect(find("mlp").length).toBeGreaterThan(0);
    expect(find("zzz-not-an-etf")).toEqual([]);
  });
});
