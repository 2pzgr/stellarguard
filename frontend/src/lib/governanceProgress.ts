export interface GovernanceProgressInput {
  totalVotes: number;
  memberCount: number;
  quorumPercent: number;
}

export function calculateQuorumVotes(
  memberCount: number,
  quorumPercent: number,
): number {
  if (memberCount <= 0 || quorumPercent <= 0) {
    return 0;
  }

  return Math.floor((memberCount * quorumPercent) / 100);
}

export function calculateParticipationPercent(
  totalVotes: number,
  memberCount: number,
): number {
  if (memberCount <= 0) {
    return 0;
  }

  return (totalVotes / memberCount) * 100;
}

export function hasReachedQuorum({
  totalVotes,
  memberCount,
  quorumPercent,
}: GovernanceProgressInput): boolean {
  return totalVotes >= calculateQuorumVotes(memberCount, quorumPercent);
}

