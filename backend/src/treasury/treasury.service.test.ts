jest.mock("../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../config", () => ({
  config: {
    sorobanRpcUrl: "https://soroban-test.example.com",
    redisUrl: "redis://localhost:6379",
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

    it("returns the placeholder balance when configured", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      const result = await service.getBalance();
      expect(result).toBe("1000.0000000");
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
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: "5" }] })
        .mockResolvedValueOnce({ rows: [buildEventRow()] });

      const result = await service.getTransactions();

      expect(mockedQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("SELECT COUNT(*) FROM events WHERE contract_id = $1"),
        ["CTREASURY"],
      );
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM events WHERE contract_id = $1"),
        ["CTREASURY", 10, 0],
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.contract_id).toBe("CTREASURY");
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 5 });
    });

    it("computes the offset for non-first pages", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getTransactions(3, 25);

      // Page 3, limit 25 → offset 50
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM events WHERE contract_id = $1"),
        ["CTREASURY", 25, 50],
      );
    });

    it("validates each row through the Zod schema", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      const valid = buildEventRow({ id: 5 });
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: "1" }] })
        .mockResolvedValueOnce({ rows: [valid] });

      const result = await service.getTransactions();

      expect(result.data[0]).toMatchObject({
        id: 5,
        contract_id: "CTREASURY",
        topic_1: "treasury",
        topic_2: "deposit",
      });
    });

    it("rejects when a row fails Zod validation", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: "1" }] })
        .mockResolvedValueOnce({
          rows: [{ ...buildEventRow(), id: "not-a-number" }],
        });

      await expect(service.getTransactions()).rejects.toBeDefined();
    });

    it("clamps invalid page and limit inputs", async () => {
      process.env.TREASURY_CONTRACT_ID = "CTREASURY";
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getTransactions(0, 200);

      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        ["CTREASURY", 100, 0],
      );
    });
  });

  describe("getTransactionById", () => {
    it("returns null when no row is found", async () => {
      mockedQuery.mockResolvedValue({ rows: [] });
      const result = await service.getTransactionById("999");
      expect(result).toBeNull();
    });

    it("returns the parsed transaction when found", async () => {
      mockedQuery.mockResolvedValue({ rows: [buildEventRow({ id: 42 })] });
      const result = await service.getTransactionById("42");
      expect(result?.id).toBe(42);
    });

    it("queries by id parameter", async () => {
      mockedQuery.mockResolvedValue({ rows: [] });
      await service.getTransactionById("17");
      expect(mockedQuery).toHaveBeenCalledWith(
        "SELECT * FROM events WHERE id = $1",
        ["17"],
      );
    });
  });

  describe("getSigners", () => {
    it("returns an array of signer strings", async () => {
      const result = await service.getSigners();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result[0]).toBe("string");
    });
  });
});
