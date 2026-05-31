jest.mock("../config", () => ({
  config: {
    sorobanRpcUrl: "https://soroban-test.example.com",
    contractIds: ["CGOV"],
  },
  loadConfig: jest.fn(),
  getContractIds: jest.fn().mockReturnValue(["CGOV"]),
}));

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GovernanceController } from "./governance.controller";
import { GovernanceService } from "./governance.service";

describe("GovernanceController", () => {
  let service: jest.Mocked<
    Pick<
      GovernanceService,
      | "getProposals"
      | "getProposalById"
      | "getProposalVotes"
      | "getMembers"
      | "getConfig"
    >
  >;
  let controller: GovernanceController;

  beforeEach(() => {
    service = {
      getProposals: jest.fn(),
      getProposalById: jest.fn(),
      getProposalVotes: jest.fn(),
      getMembers: jest.fn(),
      getConfig: jest.fn(),
    };
    controller = new GovernanceController(service as unknown as GovernanceService);
  });

  describe("getProposals", () => {
    it("passes pagination and filters to the service", async () => {
      service.getProposals.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });

      await controller.getProposals("1", "10", "Active", "Funding");

      expect(service.getProposals).toHaveBeenCalledWith(1, 10, "Active", "Funding");
    });

    it("validates pagination parameters", async () => {
      await expect(controller.getProposals("0", "10")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.getProposals).not.toHaveBeenCalled();
    });

    it("rejects limit exceeding 100", async () => {
      await expect(controller.getProposals("1", "101")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.getProposals).not.toHaveBeenCalled();
    });

    it("returns proposals envelope with pagination", async () => {
      service.getProposals.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0 },
      });

      const result = await controller.getProposals();

      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 10, total: 0 },
      });
    });
  });

  describe("getProposal", () => {
    it("throws NotFoundException when proposal is missing", async () => {
      service.getProposalById.mockResolvedValue(null);

      await expect(controller.getProposal("99")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the proposal when found", async () => {
      const proposal = {
        id: 1,
        title: "Test",
        description: "Desc",
        action: "Funding",
        proposer: "GA",
        votes_for: 5,
        votes_against: 2,
        total_votes: 7,
        status: "Active",
        created_at: 1700000000,
        ends_at: 1700100000,
        amount: "1000",
        target: "GB",
      };
      service.getProposalById.mockResolvedValue(proposal);

      const result = await controller.getProposal("1");
      expect(result).toBe(proposal);
    });
  });

  describe("getProposalVotes", () => {
    it("returns votes from the service", async () => {
      const votes = { proposal_id: 1, votes: [], summary: { votes_for: 0, votes_against: 0, total_votes: 0 } };
      service.getProposalVotes.mockResolvedValue(votes);

      await expect(controller.getProposalVotes("1")).resolves.toBe(votes);
    });
  });

  describe("getMembers", () => {
    it("returns members in an envelope", async () => {
      service.getMembers.mockResolvedValue(["GA", "GB"]);

      await expect(controller.getMembers()).resolves.toEqual({
        members: ["GA", "GB"],
      });
    });
  });

  describe("getConfig", () => {
    it("returns config directly from the service", async () => {
      const config = {
        admin: "GADMIN",
        member_count: 3,
        quorum_percent: 50,
        voting_period: 1000,
        proposal_count: 10,
      };
      service.getConfig.mockResolvedValue(config);

      await expect(controller.getConfig()).resolves.toBe(config);
    });
  });
});
