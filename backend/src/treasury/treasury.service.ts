import { Injectable, Logger } from "@nestjs/common";
import { SorobanRpc } from "@stellar/stellar-sdk";
import { config } from "../config";
import { pool } from "../db";
import { CacheService } from "../cache/cache.service";
import { z } from "zod";

// Define transaction schema for validation
export const TransactionSchema = z.object({
  id: z.number(),
  contract_id: z.string(),
  topic_1: z.string().nullable(),
  topic_2: z.string().nullable(),
  event_name: z.string().nullable(),
  event_topics: z.any(),
  event_data: z.any(),
  ledger: z.number(),
  timestamp: z.number().nullable(),
  cursor: z.string().nullable(),
  created_at: z.string(),
});

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);
  private readonly server: SorobanRpc.Server;

  constructor(private readonly cache: CacheService) {
    this.server = new SorobanRpc.Server(config.sorobanRpcUrl);
  }

  async getBalance(): Promise<string> {
    const contractId = process.env.TREASURY_CONTRACT_ID;
    if (!contractId) throw new Error("TREASURY_CONTRACT_ID not configured");

    const cacheKey = `treasury:balance:${contractId}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    // For now, return a placeholder balance
    // In a real implementation, this would query the contract via RPC
    // or read from the indexed database
    const balance = "1000.0000000";
    await this.cache.set(cacheKey, balance, 30);
    return balance;
  }

  async getConfig() {
    const contractId = process.env.TREASURY_CONTRACT_ID;
    if (!contractId) throw new Error("TREASURY_CONTRACT_ID not configured");

    const cacheKey = `treasury:config:${contractId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Mocking config return based on contract struct
    const configData = {
      admin: "G...",
      threshold: 2,
      signer_count: 3,
      balance: "1000000000",
      tx_count: 10,
    };
    await this.cache.set(cacheKey, configData, 60);
    return configData;
  }

  async getTransactions(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const contractId = process.env.TREASURY_CONTRACT_ID;

    const result = await pool.query(
      "SELECT * FROM events WHERE contract_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [contractId, limit, offset],
    );

    return result.rows.map((row) => TransactionSchema.parse(row));
  }

  async getTransactionById(id: string) {
    const contractId = process.env.TREASURY_CONTRACT_ID;
    if (!contractId) throw new Error("TREASURY_CONTRACT_ID not configured");

    const result = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND contract_id = $2",
      [id, contractId],
    );

    if (result.rows.length === 0) return null;
    return TransactionSchema.parse(result.rows[0]);
  }

  async getSigners() {
    const cacheKey = "treasury:signers";
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const signers = ["GBVQBPV3...", "GDI67..."];
    await this.cache.set(cacheKey, signers, 300);
    return signers;
  }
}
