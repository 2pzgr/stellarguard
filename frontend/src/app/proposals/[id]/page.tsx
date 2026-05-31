"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { VoteButton } from "@/components/VoteButton";
import { StatusBadge } from "@/components/StatusBadge";
import { VotingProgressBar } from "@/components/VotingProgressBar";
import { useFreighter } from "@/hooks/useFreighter";
import { useGovernance } from "@/hooks/useGovernance";
import { formatAddress } from "@/lib/formatters";
import type { GovernanceProposal } from "@/lib/contractData";

export default function ProposalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number.parseInt(params.id, 10);
  const { address: currentAddress } = useFreighter();
  const {
    config,
    getProposal,
    finalize,
    getConfig,
    executeProposal,
    hasVoted,
    pendingVotes,
    clearPendingVote,
    isLoading,
  } = useGovernance();
  const [proposal, setProposal] = useState<GovernanceProposal | null>(null);
  const [viewerHasVoted, setViewerHasVoted] = useState(false);
  const [countdown, setCountdown] = useState("Unknown");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const isValidId = Number.isFinite(id) && id > 0 && !Number.isNaN(id);

  const loadProposal = useCallback(async () => {
    setLoadError(null);
    if (!isValidId) return;
    await getConfig();
    const [p, voted] = await Promise.all([
      getProposal(id),
      currentAddress ? hasVoted(id).catch(() => false) : Promise.resolve(false),
    ]);
    setProposal(p);
    setViewerHasVoted(voted);
    clearPendingVote(id);
  }, [clearPendingVote, currentAddress, getConfig, getProposal, hasVoted, id, isValidId]);

  useEffect(() => {
    loadProposal().catch((err) => {
      setLoadError(err);
      toast.error("Failed to load proposal details");
    });
  }, [loadProposal]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!proposal) return;
    const endMs = proposal.endsAt * 1000;
    const diff = endMs - nowMs;
    if (diff <= 0) {
      setCountdown("Voting window closed");
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s remaining`);
  }, [proposal, nowMs]);

  const pendingVote = pendingVotes.get(id);
  const displayedVotesFor =
    (proposal?.votesFor ?? 0) + (pendingVote === true ? 1 : 0);
  const displayedVotesAgainst =
    (proposal?.votesAgainst ?? 0) + (pendingVote === false ? 1 : 0);
  const totalVotes = displayedVotesFor + displayedVotesAgainst;
  const votingClosed =
    proposal ? proposal.status !== "Active" || proposal.endsAt * 1000 <= nowMs : true;
  const effectiveHasVoted = viewerHasVoted || pendingVote !== undefined;
  const memberCount = config?.memberCount ?? 0;
  const quorumPercent = config?.quorumPercent ?? 0;
  const canFinalize = useMemo(() => {
    if (!proposal) return false;
    return proposal.status === "Active" && proposal.endsAt * 1000 <= nowMs;
  }, [proposal, nowMs]);

  const handleCopyLink = async () => {
    const title = proposal?.title ?? `Proposal #${params.id}`;
    const shareUrl = `${window.location.origin}/proposals/${params.id}?title=${encodeURIComponent(title)}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const handleFinalize = async () => {
    if (!proposal || !canFinalize || isFinalizing) return;
    setIsFinalizing(true);
    const toastId = toast.loading("Finalizing proposal...");
    try {
      await finalize(id);
      await loadProposal();
      toast.success("Proposal finalized", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to finalize proposal", { id: toastId });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExecute = async () => {
    if (!proposal || proposal.status !== "Passed" || isExecuting) return;
    setIsExecuting(true);
    const toastId = toast.loading("Executing proposal...");
    try {
      await executeProposal(id);
      await loadProposal();
      toast.success("Proposal executed", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute proposal", { id: toastId });
    } finally {
      setIsExecuting(false);
    }
  };

  const voteHelperText = !currentAddress
    ? "Connect your wallet to vote."
    : pendingVote !== undefined
      ? "Vote submitted. Waiting for on-chain confirmation."
      : effectiveHasVoted
        ? "You have already voted on this proposal."
        : votingClosed
          ? "Voting is closed for this proposal."
          : "Your vote will be submitted on-chain immediately.";

  if (!isValidId) {
    return (
      <div className="space-y-8 pb-32 md:pb-0">
        <Link
          href="/governance"
          className="text-primary-400 hover:text-primary-300 text-sm"
        >
          ← Back to Governance
        </Link>
        <div className="card mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
            Invalid Proposal
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Proposal Not Found
          </h1>
          <p className="mt-3 text-sm text-gray-400">
            The proposal ID &ldquo;{params.id}&rdquo; is not valid. Proposal IDs must be positive numbers.
          </p>
          <Link href="/governance" className="btn-primary mt-6 inline-block">
            Browse Proposals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32 md:pb-0">
      {/* Back Link */}
      <Link
        href="/governance"
        className="text-primary-400 hover:text-primary-300 text-sm"
      >
        ← Back to Governance
      </Link>

      {!!loadError && (
        <div className="card mx-auto max-w-2xl text-center border-red-500/40">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
            Route Error
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Proposal unavailable
          </h1>
          <p className="mt-3 text-sm text-gray-400">
            This proposal route failed to load. Retry to request the proposal details again.
          </p>
          <button
            className="btn-primary mt-6"
            onClick={() => loadProposal().catch((err) => {
              setLoadError(err);
              toast.error("Failed to load proposal details");
            })}
          >
            Retry
          </button>
        </div>
      )}

      {/* Proposal Header */}
      <div className="card">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white">
                {proposal?.title ?? `Proposal #${params.id}`}
              </h1>
              <StatusBadge status={proposal?.status ?? "Active"} size="md" />
            </div>
            <p className="text-gray-400 mt-2">{proposal?.description ?? "Loading proposal details..."}</p>
            {proposal ? (
              <div className="space-y-1 mt-3">
                <p className="text-xs text-gray-500">
                  Proposed by{" "}
                  <span className="font-mono text-gray-400">
                    {formatAddress(proposal.proposer, { startChars: 8, endChars: 6 })}
                  </span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <p className="text-xs text-gray-500">
                    Created:{" "}
                    <span className="text-gray-400">
                      {new Date(proposal.createdAt * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Ends:{" "}
                    <span className="text-gray-400">
                      {new Date(proposal.endsAt * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-primary-400 font-medium">
                  Result: {countdown}
                </p>
              </div>
            ) : null}
          </div>
          <button className="btn-secondary" onClick={handleCopyLink} type="button">
            Copy Share Link
          </button>
        </div>
      </div>

      {/* Voting Progress */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">
          Voting Progress
        </h2>
        <VotingProgressBar
          forVotes={displayedVotesFor}
          againstVotes={displayedVotesAgainst}
          totalVotes={totalVotes}
          memberCount={memberCount}
          quorumPercent={quorumPercent}
        />
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Finalize Proposal</h2>
          <p className="text-sm text-gray-400">
            Finalization unlocks execution when proposal voting has ended.
          </p>
          {!canFinalize && proposal?.status === "Active" ? (
            <p className="text-xs text-yellow-400 mt-1">
              Available after deadline while status is Active.
            </p>
          ) : null}
          <button
            type="button"
            className={`btn-primary w-full mt-4 ${!canFinalize || isFinalizing || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={!canFinalize || isFinalizing || isLoading}
            onClick={handleFinalize}
          >
            {isFinalizing ? "Finalizing..." : "Finalize"}
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">Execute Proposal</h2>
          <p className="text-sm text-gray-400">
            Once passed and finalized, proposal actions can be triggered on-chain.
          </p>
          {proposal?.status !== "Passed" && (
            <p className="text-xs text-gray-500 mt-1">
              Available only for Passed proposals.
            </p>
          )}
          <button
            type="button"
            className={`btn-primary w-full mt-4 ${proposal?.status !== "Passed" || isExecuting || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={proposal?.status !== "Passed" || isExecuting || isLoading}
            onClick={handleExecute}
          >
            {isExecuting ? "Executing..." : "Execute Action"}
          </button>
        </div>
      </div>

      {/* Vote Actions (Sticky on Mobile) */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-gray-900 border-t border-stellar-border z-50 md:relative md:p-0 md:bg-transparent md:border-t-0 md:z-auto card md:card">
        <h2 className="hidden md:block text-lg font-semibold text-white mb-4">Cast Vote</h2>
        <div className="flex space-x-4">
          <VoteButton
            proposalId={id}
            voteFor={true}
            hasVoted={effectiveHasVoted}
            votingClosed={votingClosed}
            isPending={pendingVote !== undefined}
            onVoteSuccess={loadProposal}
          />
          <VoteButton
            proposalId={id}
            voteFor={false}
            hasVoted={effectiveHasVoted}
            votingClosed={votingClosed}
            isPending={pendingVote !== undefined}
            onVoteSuccess={loadProposal}
          />
        </div>
        <p className="mt-3 text-xs text-gray-400">{voteHelperText}</p>
      </div>
    </div>
  );
}
