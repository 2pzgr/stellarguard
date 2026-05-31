jest.mock("../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockedCacheGet = jest.fn();
const mockedCacheSet = jest.fn();

jest.mock("../cache/cache.service", () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: mockedCacheGet,
    set: mockedCacheSet,
  })),
}));

import { GovernanceService } from "./governance.service";
import { pool } from "../db";
import { CacheService } from "../cache/cache.service";

const mockedQuery = pool.query as jest.Mock;

function buildEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    contract_id: "CGOV",
    topic_1: "gov",
    topic_2: "propose",
    event_name: "Governance Propose",
    event_topics: ["gov", "propose"],
    event_data: {
      proposal_id: "1",
      title: "Test Proposal",
      description: "A test proposal",
      action: "Funding",
      proposer: "GABCDEF123...",
      votes_for: 5,
      votes_against: 2,
      total_votes: 7,
      status: "Active",
      created_at: 1700000000,
      ends_at: 1700100000,
      amount: "1000",
      target: "GXYZ789...",
    },
    ledger: 100,
    timestamp: 1700000000,
    cursor: "cursor-1",
    created_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("GovernanceService", () => {
  const ORIGINAL_ENV = process.env;
  let service: GovernanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    service = new GovernanceService(new CacheService());
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("getProposals", () => {
    it("throws when GOVERNANCE_CONTRACT_ID is not configured", async () => {
      delete process.env.GOVERNANCE_CONTRACT_ID;
      await expect(service.getProposals()).rejects.toThrow(
        "GOVERNANCE_CONTRACT_ID not configured",
      );
    });

    it("queries with default pagination (page 1, limit 10)", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [buildEventRow()], rowCount: 1 });

      const result = await service.getProposals();

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM events WHERE contract_id = $1"),
        ["CGOV", "propose", 10, 0],
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1 });
    });

    it("computes offset for non-first pages", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.getProposals(3, 25);

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [
        "CGOV",
        "propose",
        25,
        50,
      ]);
    });

    it("filters by status when valid status is provided", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      const active = buildEventRow({ id: 1, event_data: { ...buildEventRow().event_data, status: "Active" } });
      mockedQuery.mockResolvedValue({ rows: [active], rowCount: 1 });

      await service.getProposals(1, 10, "Active");

      const [[query, params]] = mockedQuery.mock.calls;
      expect(query).toContain("event_data->>'status'");
      expect(params).toEqual(["CGOV", "propose", "Active", 10, 0]);
    });

    it("ignores status filter when status is unsupported", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.getProposals(1, 10, "UnknownStatus");

      const [[query]] = mockedQuery.mock.calls;
      expect(query).not.toContain("event_data->>'status'");
    });

    it("filters by action when valid action is provided", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      const funding = buildEventRow({ id: 1, event_data: { ...buildEventRow().event_data, action: "Funding" } });
      mockedQuery.mockResolvedValue({ rows: [funding], rowCount: 1 });

      await service.getProposals(1, 10, undefined, "Funding");

      const [[query, params]] = mockedQuery.mock.calls;
      expect(query).toContain("event_data->>'action'");
      expect(params).toEqual(["CGOV", "propose", "Funding", 10, 0]);
    });

    it("ignores action filter when action is unsupported", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.getProposals(1, 10, undefined, "UnknownAction");

      const [[query]] = mockedQuery.mock.calls;
      expect(query).not.toContain("event_data->>'action'");
    });

    it("filters by both status and action simultaneously", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.getProposals(1, 10, "Passed", "General");

      const [[query, params]] = mockedQuery.mock.calls;
      expect(query).toContain("event_data->>'status'");
      expect(query).toContain("event_data->>'action'");
      expect(params).toEqual(["CGOV", "propose", "Passed", "General", 10, 0]);
    });
  });

  describe("getProposalById", () => {
    it("throws when GOVERNANCE_CONTRACT_ID is not configured", async () => {
      delete process.env.GOVERNANCE_CONTRACT_ID;
      await expect(service.getProposalById("1")).rejects.toThrow(
        "GOVERNANCE_CONTRACT_ID not configured",
      );
    });

    it("returns null when no row is found", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [] });

      const result = await service.getProposalById("999");
      expect(result).toBeNull();
    });

    it("returns the parsed proposal when found", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({ rows: [buildEventRow({ id: 42 })] });

      const result = await service.getProposalById("42");
      expect(result?.id).toBe(42);
      expect(result?.title).toBe("Test Proposal");
      expect(result?.action).toBe("Funding");
      expect(result?.status).toBe("Active");
    });
  });

  describe("getMembers", () => {
    it("throws when GOVERNANCE_CONTRACT_ID is not configured", async () => {
      delete process.env.GOVERNANCE_CONTRACT_ID;
      await expect(service.getMembers()).rejects.toThrow(
        "GOVERNANCE_CONTRACT_ID not configured",
      );
    });

    it("returns cached members when available", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedCacheGet.mockResolvedValue(["GABCDE12345", "GFGHIJ67890"]);

      const result = await service.getMembers();

      expect(result).toEqual(["GABCDE12345", "GFGHIJ67890"]);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it("derives members from governance init event", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedCacheGet.mockResolvedValue(null);
      mockedQuery.mockResolvedValue({
        rows: [
          {
            event_data: {
              members: ["GABCDE12345", "GFGHIJ67890", "GKLMNO11121"],
              _eventName: "Governance Initialize",
            },
          },
        ],
      });

      const result = await service.getMembers();

      expect(result).toEqual(["GABCDE12345", "GFGHIJ67890", "GKLMNO11121"]);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE contract_id = $1"),
        ["CGOV", "gov", "init"],
      );
    });

    it("returns empty array when no init event exists", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedCacheGet.mockResolvedValue(null);
      mockedQuery.mockResolvedValue({ rows: [] });

      const result = await service.getMembers();

      expect(result).toEqual([]);
    });

    it("caches the derived members", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedCacheGet.mockResolvedValue(null);
      mockedQuery.mockResolvedValue({
        rows: [
          {
            event_data: {
              members: ["GABCDE12345"],
              _eventName: "Governance Initialize",
            },
          },
        ],
      });

      await service.getMembers();

      expect(mockedCacheSet).toHaveBeenCalledWith(
        "governance:members",
        ["GABCDE12345"],
        300,
      );
    });

    it("handles missing members field in event data gracefully", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedCacheGet.mockResolvedValue(null);
      mockedQuery.mockResolvedValue({
        rows: [
          {
            event_data: {
              _eventName: "Governance Initialize",
            },
          },
        ],
      });

      const result = await service.getMembers();
      expect(result).toEqual([]);
    });
  });

  describe("getConfig", () => {
    it("throws when GOVERNANCE_CONTRACT_ID is not configured", async () => {
      delete process.env.GOVERNANCE_CONTRACT_ID;
      await expect(service.getConfig()).rejects.toThrow(
        "GOVERNANCE_CONTRACT_ID not configured",
      );
    });

    it("returns the mock config shape when configured", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      const result = await service.getConfig();
      expect(result).toEqual({
        admin: expect.any(String),
        member_count: expect.any(Number),
        quorum_percent: expect.any(Number),
        voting_period: expect.any(Number),
        proposal_count: expect.any(Number),
      });
    });
  });

  describe("getProposalVotes", () => {
    it("returns votes for a proposal", async () => {
      process.env.GOVERNANCE_CONTRACT_ID = "CGOV";
      mockedQuery.mockResolvedValue({
        rows: [
          {
            event_data: { voter: "GABCDE", vote_for: true },
            timestamp: 1700000010,
          },
          {
            event_data: { voter: "GFGHIJ", vote_for: false },
            timestamp: 1700000020,
          },
        ],
      });

      const result = await service.getProposalVotes("1");

      expect(result.proposal_id).toBe(1);
      expect(result.votes).toHaveLength(2);
      expect(result.summary).toEqual({
        votes_for: 1,
        votes_against: 1,
        total_votes: 2,
      });
    });
  });
});
