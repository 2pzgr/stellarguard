import { Injectable, Logger } from "@nestjs/common";
import { pool } from "../db";
import { CacheService } from "../cache/cache.service";
import { z } from "zod";

export const ProposalSchema = z.object({
  id: z.number(),
  contract_id: z.string(),
  topic_1: z.string().nullable(),
  topic_2: z.string().nullable(),
  event_data: z.any(),
  ledger: z.number(),
  timestamp: z.number().nullable(),
  cursor: z.string().nullable(),
  created_at: z.string(),
});

export interface GovernanceConfig {
  admin: string;
  member_count: number;
  quorum_percent: number;
  voting_period: number;
  proposal_count: number;
}

export interface Proposal {
  id: number;
  title: string;
  description: string;
  action: string;
  proposer: string;
  votes_for: number;
  votes_against: number;
  total_votes: number;
  status: string;
  created_at: number;
  ends_at: number;
  amount: string;
  target: string;
}

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(private readonly cache: CacheService) {}

  async getProposals(
    page: number = 1,
    limit: number = 10,
    status?: string,
    action?: string,
  ) {
    const offset = (page - 1) * limit;
    const contractId = process.env.GOVERNANCE_CONTRACT_ID;

    if (!contractId) {
      throw new Error("GOVERNANCE_CONTRACT_ID not configured");
    }

    const whereClauses: string[] = [];
    const params: unknown[] = [contractId];
    let paramIndex = 2;

    whereClauses.push("contract_id = $1");
    whereClauses.push("topic_2 = $" + paramIndex++);
    params.push("propose");

    if (status) {
      whereClauses.push("event_data->>'status' = $" + paramIndex++);
      params.push(status);
    }

    if (action) {
      whereClauses.push("event_data->>'action' = $" + paramIndex++);
      params.push(action);
    }

    const whereSQL = whereClauses.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM events WHERE ${whereSQL}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const dataResult = await pool.query(
      `SELECT * FROM events WHERE ${whereSQL} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams,
    );

    return {
      data: dataResult.rows.map((row) => ProposalSchema.parse(row)),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getProposalById(id: string): Promise<Proposal | null> {
    const contractId = process.env.GOVERNANCE_CONTRACT_ID;

    if (!contractId) {
      throw new Error("GOVERNANCE_CONTRACT_ID not configured");
    }

    const result = await pool.query(
      `SELECT * FROM events 
       WHERE contract_id = $1 
       AND topic_2 = $2 
       AND event_data->>'proposal_id' = $3`,
      [contractId, "propose", id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const eventData = row.event_data as Record<string, unknown>;

    return {
      id: parseInt(id),
      title: (eventData.title as string) || "",
      description: (eventData.description as string) || "",
      action: (eventData.action as string) || "",
      proposer: (eventData.proposer as string) || "",
      votes_for: (eventData.votes_for as number) || 0,
      votes_against: (eventData.votes_against as number) || 0,
      total_votes: (eventData.total_votes as number) || 0,
      status: (eventData.status as string) || "",
      created_at: (eventData.created_at as number) || 0,
      ends_at: (eventData.ends_at as number) || 0,
      amount: (eventData.amount as string) || "0",
      target: (eventData.target as string) || "",
    };
  }

  async getMembers(): Promise<string[]> {
    const cacheKey = "governance:members";
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    // In a real implementation, this would query the contract
    // For now, return mock members
    const members = ["GABC123...", "GDEF456...", "GHIJ789..."];
    await this.cache.set(cacheKey, members, 300);
    return members;
  }

  async getConfig(): Promise<GovernanceConfig> {
    const contractId = process.env.GOVERNANCE_CONTRACT_ID;

    if (!contractId) {
      throw new Error("GOVERNANCE_CONTRACT_ID not configured");
    }

    const cacheKey = `governance:config:${contractId}`;
    const cached = await this.cache.get<GovernanceConfig>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT event_data FROM events
       WHERE contract_id = $1 AND topic_1 = $2 AND topic_2 = $3
       ORDER BY ledger DESC, id DESC
       LIMIT 1`,
      [contractId, "gov", "init"],
    );

    if (result.rows.length === 0) {
      throw new Error("Governance config not found - no init event indexed");
    }

    const data = result.rows[0].event_data as Record<string, unknown>;

    const configData: GovernanceConfig = {
      admin: (data.admin as string) || "",
      member_count: (data.member_count as number) || 0,
      quorum_percent: (data.quorum_percent as number) || 0,
      voting_period: (data.voting_period as number) || 0,
      proposal_count: (data.proposal_count as number) || 0,
    };

    await this.cache.set(cacheKey, configData, 60);
    return configData;
  }

  async getProposalVotes(id: string) {
    const contractId = process.env.GOVERNANCE_CONTRACT_ID;

    if (!contractId) {
      throw new Error("GOVERNANCE_CONTRACT_ID not configured");
    }

    // Query vote events for this proposal
    const result = await pool.query(
      `SELECT * FROM events 
       WHERE contract_id = $1 
       AND topic_2 = $2 
       AND event_data->>'proposal_id' = $3
       ORDER BY created_at DESC`,
      [contractId, "vote", id],
    );

    return {
      proposal_id: parseInt(id),
      votes: result.rows.map((row) => ({
        voter: row.event_data?.voter || "unknown",
        vote_for: row.event_data?.vote_for || false,
        timestamp: row.timestamp,
      })),
      summary: {
        votes_for: result.rows.filter((r) => r.event_data?.vote_for === true)
          .length,
        votes_against: result.rows.filter(
          (r) => r.event_data?.vote_for === false,
        ).length,
        total_votes: result.rows.length,
      },
    };
  }
}
