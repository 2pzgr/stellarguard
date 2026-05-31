import { cn } from "./Shimmer";
import {
  calculateParticipationPercent,
  calculateQuorumVotes,
  hasReachedQuorum,
} from "@/lib/governanceProgress";

interface VotingProgressBarProps {
  forVotes: number;
  againstVotes: number;
  totalVotes: number;
  memberCount: number;
  quorumPercent: number;
  className?: string;
}

export function VotingProgressBar({
  forVotes,
  againstVotes,
  totalVotes,
  memberCount,
  quorumPercent,
  className,
}: VotingProgressBarProps) {
  const forPercentage = totalVotes === 0 ? 0 : (forVotes / totalVotes) * 100;
  const againstPercentage = totalVotes === 0 ? 0 : (againstVotes / totalVotes) * 100;
  const quorumVotes = calculateQuorumVotes(memberCount, quorumPercent);
  const participationPercent = calculateParticipationPercent(totalVotes, memberCount);
  const quorumReached = hasReachedQuorum({
    totalVotes,
    memberCount,
    quorumPercent,
  });
  const quorumMarkerPercent = memberCount <= 0 ? 0 : (quorumVotes / memberCount) * 100;

  return (
    <div className={cn("w-full flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <span className="text-emerald-500">For: {forPercentage.toFixed(1)}%</span>
          <span className="text-rose-500">Against: {againstPercentage.toFixed(1)}%</span>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            quorumReached
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
          }`}
        >
          {quorumReached ? "Quorum reached" : "Quorum pending"}
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 relative flex">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${forPercentage}%` }}
        />
        <div
          className="h-full bg-rose-500 transition-all duration-500"
          style={{ width: `${againstPercentage}%` }}
        />

        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-slate-400 dark:bg-slate-500"
          style={{ left: `${quorumMarkerPercent}%` }}
          title={`Quorum threshold: ${quorumVotes} votes`}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-3">
        <span>Total votes: {totalVotes}</span>
        <span>Participation: {totalVotes}/{memberCount} members ({participationPercent.toFixed(1)}%)</span>
        <span>Quorum: {quorumPercent}% = {quorumVotes} votes</span>
      </div>
    </div>
  );
}
