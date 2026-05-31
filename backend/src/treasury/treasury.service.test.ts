jest.mock("../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../config", () => ({
  config: {
    sorobanRpcUrl: "https://soroban-test.example.com",
  },
}));

jest.mock("../cache/cache.service", () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@stellar/stellar-sdk", () => ({
  SorobanRpc: {
    Server: jest.fn().mockImplementation(() => ({})),
  },
  Address: jest.fn(),
  Contract: jest.fn(),
}));

import { TreasuryService } from "./treasury.service";
import { CacheService } from "../cache/cache.service";
import { pool } from "../db";

const mockedQuery = pool.query as jest.Mock;

function buildEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    contract_id: "CTREASURY",
    topic_1: "treasury",
    topic_2: "deposit",
    event_name: "Treasury Deposit",
    event_topics: ["treasury", "deposit"],
    event_data: { amount: "1000" },
    ledger: 100,
    timestamp: 1700000000,
    cursor: "cursor-1",
    created_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TreasuryService", () => {
  const ORIGINAL_ENV = process.env;
  let service: TreasuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    service = new TreasuryService(new CacheService());
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("getBalance", () => {
    it("throws when TREASURY_CONTRACT_ID is not configured", async () => {
      delete process.env.TREASURY_CONTRACT_ID;
      await expect(service.getBalance()).rejects.toThrow(
        "TREASURY_CONTRACT_ID not configured",
      );
    });

    it("returns 0 when no deposit events exist", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [{ total: 0 }] });

      const result = await service.getBalance();
      expect(result).toBe("0.0000000");
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("SUM(CAST((event_data->>'amount')"),
        ["CTREASURY"],
      );
    });

    it("sums deposit amounts from indexed events", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [{ total: 50000000 }] });

      const result = await service.getBalance();
      expect(result).toBe("5.0000000");
    });

    it("converts stroops to decimal format with 7 places", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [{ total: 123456789 }] });

      const result = await service.getBalance();
      expect(result).toBe("12.3456789");
    });

    it("returns cached balance on subsequent calls", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";

      const mockCache = new CacheService();
      const getSpy = jest.spyOn(mockCache, 'get').mockResolvedValue(null);
      const setSpy = jest.spyOn(mockCache, 'set').mockResolvedValue(undefined);

      service = new TreasuryService(mockCache);
      mockedQuery.mockResolvedValue({ rows: [{ total: 10000000 }] });

      const result1 = await service.getBalance();

      getSpy.mockResolvedValueOnce("1.0000000");
      const result2 = await service.getBalance();

      expect(result1).toBe("1.0000000");
      expect(result2).toBe("1.0000000");
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("getConfig", () => {
    it("throws when TREASURY_CONTRACT_ID is not configured", async () => {
      delete process.env.TREASURY_CONTRACT_ID;
      await expect(service.getConfig()).rejects.toThrow(
        "TREASURY_CONTRACT_ID not configured",
      );
    });

    it("returns the mock config shape when configured", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      const result = await service.getConfig();
      expect(result).toEqual({
        admin: expect.any(String),
        threshold: expect.any(Number),
        signer_count: expect.any(Number),
        balance: expect.any(String),
        tx_count: expect.any(Number),
      });
    });
  });

  describe("getTransactions", () => {
    it("queries with default pagination (page 1, limit 10)", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [buildEventRow()] });

      const result = await service.getTransactions();

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM events WHERE contract_id = $1"),
        ["CTREASURY", 10, 0],
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.contract_id).toBe("CTREASURY");
    });

    it("computes the offset for non-first pages", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [] });

      await service.getTransactions(3, 25);

      // Page 3, limit 25 → offset 50
      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [
        "CTREASURY",
        25,
        50,
      ]);
    });

    it("validates each row through the Zod schema", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      const valid = buildEventRow({ id: 5 });
      mockedQuery.mockResolvedValue({ rows: [valid] });

      const result = await service.getTransactions();

      expect(result[0]).toMatchObject({
        id: 5,
        contract_id: "CTREASURY",
        topic_1: "treasury",
        topic_2: "deposit",
      });
    });

    it("rejects when a row fails Zod validation", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({
        rows: [{ ...buildEventRow(), id: "not-a-number" }],
      });

      await expect(service.getTransactions()).rejects.toBeDefined();
    });
  });

  describe("getTransactionById", () => {
    it("throws when TREASURY_CONTRACT_ID is not configured", async () => {
      delete process.env.TREASURY_CONTRACT_ID;
      await expect(service.getTransactionById("42")).rejects.toThrow(
        "TREASURY_CONTRACT_ID not configured",
      );
    });

    it("returns null when no row is found", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [] });
      const result = await service.getTransactionById("999");
      expect(result).toBeNull();
    });

    it("returns the parsed transaction when found", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({
        rows: [buildEventRow({ id: 42, contract_id: "CTREASURY" })],
      });
      const result = await service.getTransactionById("42");
      expect(result?.id).toBe(42);
      expect(result?.contract_id).toBe("CTREASURY");
    });

    it("queries by id and contract_id parameters", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [] });
      await service.getTransactionById("17");
      expect(mockedQuery).toHaveBeenCalledWith(
        "SELECT * FROM events WHERE id = $1 AND contract_id = $2",
        ["17", "CTREASURY"],
      );
    });

    it("cannot return a transaction from a different contract (SQL scoping)", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      // Even if a row exists with the same id under a different contract,
      // the SQL WHERE clause ensures it is not returned.
      mockedQuery.mockResolvedValue({ rows: [] });
      const result = await service.getTransactionById("42");
      expect(result).toBeNull();
      expect(mockedQuery).toHaveBeenCalledWith(
        "SELECT * FROM events WHERE id = $1 AND contract_id = $2",
        ["42", "CTREASURY"],
      );
    });
  });

  describe("getSigners", () => {
    it("throws when TREASURY_CONTRACT_ID is not configured", async () => {
      delete process.env.TREASURY_CONTRACT_ID;
      await expect(service.getSigners()).rejects.toThrow(
        "TREASURY_CONTRACT_ID not configured",
      );
    });

    it("returns empty array when no signer events exist", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [] });

      const result = await service.getSigners();
      expect(result).toEqual([]);
    });

    it("accumulates signers from add_sig events", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({
        rows: [
          { topic_2: "add_sig", event_data: { value: ["GABC123", 1] } },
          { topic_2: "add_sig", event_data: { value: ["GDEF456", 2] } },
        ],
      });

      const result = await service.getSigners();
      expect(result).toEqual(["GABC123", "GDEF456"]);
    });

    it("removes signers from rem_sig events", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({
        rows: [
          { topic_2: "add_sig", event_data: { value: ["GABC123", 1] } },
          { topic_2: "add_sig", event_data: { value: ["GDEF456", 2] } },
          { topic_2: "rem_sig", event_data: { value: ["GABC123", 1] } },
        ],
      });

      const result = await service.getSigners();
      expect(result).toEqual(["GDEF456"]);
    });

    it("returns full addresses with no static placeholder data", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({
        rows: [
          {
            topic_2: "add_sig",
            event_data: {
              value: [
                "GBVQBPV3TGCV7NZMHNMTV4DPSLULQ4G7XFO5AFYMM3LVHW6PXMCYTOM",
                1,
              ],
            },
          },
        ],
      });

      const result = await service.getSigners();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "GBVQBPV3TGCV7NZMHNMTV4DPSLULQ4G7XFO5AFYMM3LVHW6PXMCYTOM",
      );
      // Ensure no truncated placeholders remain
      expect(result[0]).not.toContain("...");
    });

    it("queries correct contract_id and event topics", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery.mockResolvedValue({ rows: [] });

      await service.getSigners();

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("topic_2 IN ('add_sig', 'rem_sig')"),
        ["CTREASURY"],
      );
    });
  });
});
