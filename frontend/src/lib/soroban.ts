/**
 * Soroban contract interaction helpers.
 *
 * Low-level RPC operations are delegated to `sorobanClient` so that all hooks
 * share a single, configurable polling strategy.
 */

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Transaction,
  nativeToScVal,
  Address,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import type { GovernanceProposalAction } from "./contractData";
import type { Decoder } from "./sorobanClient";
import { readPublicEnv } from "./env";
import { throwIfAborted } from "./requestGuard";
import { NETWORK_PASSPHRASE, TX_TIMEOUT } from "./network";
import { sorobanClient } from "./sorobanClient";

// ============================================================================
// Contract IDs
// ============================================================================

function getContractId(name: string, mockFallback: string): string {
  const value = readPublicEnv(name);

  if (value) {
    return value;
  }

  if (process.env.NEXT_PUBLIC_USE_MOCK_TREASURY === "1") {
    return mockFallback;
  }

  throw new Error(
    `Missing required frontend environment variable: ${name}. Add it to frontend/.env.local before starting the app.`,
  );
}

export const CONTRACT_IDS = {
  treasury: getContractId("NEXT_PUBLIC_TREASURY_CONTRACT_ID", "mock-treasury-contract"),
  governance: getContractId("NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID", "mock-governance-contract"),
  tokenVault: getContractId("NEXT_PUBLIC_VAULT_CONTRACT_ID", "mock-vault-contract"),
  accessControl: getContractId("NEXT_PUBLIC_ACL_CONTRACT_ID", "mock-acl-contract"),
} as const;

const READONLY_SIMULATION_ACCOUNT_ENV =
  "NEXT_PUBLIC_SOROBAN_SIMULATION_ACCOUNT";

const GOVERNANCE_ACTIONS: readonly GovernanceProposalAction[] = [
  "Funding",
  "PolicyChange",
  "AddMember",
  "RemoveMember",
  "General",
];

// ============================================================================
// Soroban RPC Helpers
// ============================================================================

export async function buildContractCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
): Promise<TransactionBuilder> {
  const account = await sorobanClient.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TX_TIMEOUT);

  return tx;
}

export async function signAndSubmit(
  transaction: Transaction,
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  const signedXdr = await signTransaction(transaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  ) as Transaction;

  // Delegate submission + polling to the centralised client so the timeout
  // and retry strategy is applied consistently across all hooks.
  return sorobanClient.send(signedTx);
}

interface ReadContractValueOptions<T> {
  decoder?: Decoder<T>;
  signal?: AbortSignal;
  sourceAddress?: string;
}

async function resolveSourceAddress(
  preferredSourceAddress?: string,
): Promise<string> {
  const sourceAddress =
    preferredSourceAddress?.trim() ||
    readPublicEnv(READONLY_SIMULATION_ACCOUNT_ENV);

  if (!sourceAddress) {
    throw new Error(
      `Unable to load on-chain data without a simulation source account. Connect Freighter or set ${READONLY_SIMULATION_ACCOUNT_ENV}.`,
    );
  }

  return sourceAddress;
}

export async function readContractValue<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  options: ReadContractValueOptions<T> = {},
): Promise<T> {
  throwIfAborted(options.signal);

  const sourceAddress = await resolveSourceAddress(options.sourceAddress);

  // Delegate simulation to the centralised client so all reads share the same
  // abort-signal and retry configuration.
  return sorobanClient.readValue<T>(
    contractId,
    method,
    args,
    sourceAddress,
    options.signal,
    options.decoder,
  );
}

function toAddressScVal(value: string): xdr.ScVal {
  return nativeToScVal(Address.fromString(value), { type: "address" });
}

function toSymbolScVal(value: string, fieldName: string): xdr.ScVal {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return nativeToScVal(normalized, { type: "symbol" });
}

function toStringScVal(value: string, fieldName: string): xdr.ScVal {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return nativeToScVal(normalized, { type: "string" });
}

function toProposalActionScVal(action: string): xdr.ScVal {
  const normalized = action.trim() as GovernanceProposalAction;
  if (!GOVERNANCE_ACTIONS.includes(normalized)) {
    throw new Error(
      `Unsupported governance action "${action}". Expected one of: ${GOVERNANCE_ACTIONS.join(", ")}`,
    );
  }

  return xdr.ScVal.scvVec([toSymbolScVal(normalized, "action")]);
}

async function buildTransactionXdr(
  builderPromise: Promise<TransactionBuilder>,
): Promise<string> {
  const builder = await builderPromise;
  return builder.build().toXDR();
}

// ============================================================================
// Treasury Transaction Builders
// ============================================================================

export async function buildDepositTx(
  contractId: string,
  from: string,
  amount: bigint | number,
): Promise<TransactionBuilder> {
  const args = [toAddressScVal(from), nativeToScVal(amount, { type: "i128" })];

  return buildContractCall(contractId, "deposit", args, from);
}

export async function buildProposeWithdrawalTx(
  contractId: string,
  proposer: string,
  to: string,
  amount: bigint | number,
  memo: string,
): Promise<TransactionBuilder> {
  const args = [
    toAddressScVal(proposer),
    toAddressScVal(to),
    nativeToScVal(amount, { type: "i128" }),
    nativeToScVal(memo, { type: "string" }),
  ];

  return buildContractCall(contractId, "propose_withdrawal", args, proposer);
}

export async function buildApproveTx(
  contractId: string,
  signer: string,
  txId: number,
): Promise<TransactionBuilder> {
  const args = [toAddressScVal(signer), nativeToScVal(txId, { type: "u64" })];

  return buildContractCall(contractId, "approve", args, signer);
}

export async function buildExecuteTx(
  contractId: string,
  executor: string,
  txId: number,
): Promise<TransactionBuilder> {
  const args = [toAddressScVal(executor), nativeToScVal(txId, { type: "u64" })];

  return buildContractCall(contractId, "execute", args, executor);
}

// ============================================================================
// Governance Transaction Builders
// ============================================================================

export async function buildCreateProposalTx(
  contractId: string,
  proposer: string,
  title: string,
  description: string,
  action: GovernanceProposalAction,
  amount: bigint | number,
  target: string,
): Promise<TransactionBuilder> {
  const args = [
    toAddressScVal(proposer),
    toStringScVal(title, "title"),
    toStringScVal(description, "description"),
    toProposalActionScVal(action),
    nativeToScVal(amount, { type: "i128" }),
    toAddressScVal(target),
  ];

  return buildContractCall(contractId, "create_proposal", args, proposer);
}

export async function buildCreateProposalXdr(
  contractId: string,
  proposer: string,
  title: string,
  description: string,
  action: GovernanceProposalAction,
  amount: bigint | number,
  target: string,
): Promise<string> {
  return buildTransactionXdr(
    buildCreateProposalTx(
      contractId,
      proposer,
      title,
      description,
      action,
      amount,
      target,
    ),
  );
}

export async function buildVoteTx(
  contractId: string,
  voter: string,
  proposalId: number,
  voteFor: boolean,
): Promise<TransactionBuilder> {
  const args = [
    toAddressScVal(voter),
    nativeToScVal(proposalId, { type: "u64" }),
    nativeToScVal(voteFor, { type: "bool" }),
  ];

  return buildContractCall(contractId, "vote", args, voter);
}

export async function buildVoteXdr(
  contractId: string,
  voter: string,
  proposalId: number,
  voteFor: boolean,
): Promise<string> {
  return buildTransactionXdr(
    buildVoteTx(contractId, voter, proposalId, voteFor),
  );
}

export async function buildFinalizeTx(
  contractId: string,
  caller: string,
  proposalId: number,
): Promise<TransactionBuilder> {
  const args = [
    toAddressScVal(caller),
    nativeToScVal(proposalId, { type: "u64" }),
  ];

  return buildContractCall(contractId, "finalize", args, caller);
}

export async function buildFinalizeXdr(
  contractId: string,
  caller: string,
  proposalId: number,
): Promise<string> {
  return buildTransactionXdr(buildFinalizeTx(contractId, caller, proposalId));
}

export async function buildExecuteProposalTx(
  contractId: string,
  executor: string,
  proposalId: number,
): Promise<TransactionBuilder> {
  const args = [
    toAddressScVal(executor),
    nativeToScVal(proposalId, { type: "u64" }),
  ];

  return buildContractCall(contractId, "execute_proposal", args, executor);
}

export async function buildExecuteProposalXdr(
  contractId: string,
  executor: string,
  proposalId: number,
): Promise<string> {
  return buildTransactionXdr(
    buildExecuteProposalTx(contractId, executor, proposalId),
  );
}
