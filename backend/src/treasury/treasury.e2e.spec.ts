jest.mock("../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../config", () => ({
  config: {
    sorobanRpcUrl: "https://soroban-test.example.com",
    contractIds: ["CTREASURY"],
  },
  loadConfig: jest.fn(),
  getContractIds: jest.fn().mockReturnValue(["CTREASURY"]),
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

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TreasuryController } from "./treasury.controller";
import { TreasuryService } from "./treasury.service";
import { CacheService } from "../cache/cache.service";
import { pool } from "../db";

const mockedQuery = pool.query as jest.Mock;

function eventRow() {
  return {
    id: 7,
    contract_id: "CTREASURY",
    topic_1: "treasury",
    topic_2: "deposit",
    event_name: "Treasury Deposit",
    event_topics: ["treasury", "deposit"],
    event_data: { amount: "1000" },
    ledger: 42,
    timestamp: 1700000000,
    cursor: "cursor-7",
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

describe("Treasury API (e2e)", () => {
  const ORIGINAL_ENV = process.env;
  let app: INestApplication;

  beforeAll(async () => {
    process.env = { ...ORIGINAL_ENV, TREASURY_CONTRACT_ID: "CTREASURY" };
    const moduleRef = await Test.createTestingModule({
      controllers: [TreasuryController],
      providers: [TreasuryService, CacheService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TREASURY_CONTRACT_ID = "CTREASURY";
  });

  afterAll(async () => {
    await app.close();
    process.env = ORIGINAL_ENV;
  });

  it("serves balance from the configured treasury service", async () => {
    await request(app.getHttpServer())
      .get("/api/treasury/balance")
      .expect(200)
      .expect({ balance: "1000.0000000" });
  });

  it("serves transactions from the mocked test database", async () => {
    mockedQuery.mockResolvedValue({ rows: [eventRow()] });

    const response = await request(app.getHttpServer())
      .get("/api/treasury/transactions?page=1&limit=5")
      .expect(200);

    expect(response.body).toEqual([expect.objectContaining({ id: 7 })]);
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [
      "CTREASURY",
      5,
      0,
    ]);
  });

  it("returns 404 for missing transaction rows", async () => {
    mockedQuery.mockResolvedValue({ rows: [] });

    await request(app.getHttpServer())
      .get("/api/treasury/transactions/404")
      .expect(404);
  });
});
