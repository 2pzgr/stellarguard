import { describe, expect, it } from "vitest";
import {
  calculateParticipationPercent,
  calculateQuorumVotes,
  hasReachedQuorum,
} from "@/lib/governanceProgress";

describe("governanceProgress", () => {
  it("calculates quorum votes using floor division", () => {
    expect(calculateQuorumVotes(3, 66)).toBe(1);
  });

  it("returns zero quorum votes when there are no members", () => {
    expect(calculateQuorumVotes(0, 50)).toBe(0);
  });

  it("calculates participation against the configured member count", () => {
    expect(calculateParticipationPercent(3, 5)).toBe(60);
  });

  it("returns zero participation when there are no members", () => {
    expect(calculateParticipationPercent(3, 0)).toBe(0);
  });

  it("reports quorum as reached when votes meet the threshold", () => {
    expect(
      hasReachedQuorum({ totalVotes: 2, memberCount: 3, quorumPercent: 50 }),
    ).toBe(true);
  });

  it("reports quorum as reached for a zero-member configuration", () => {
    expect(
      hasReachedQuorum({ totalVotes: 0, memberCount: 0, quorumPercent: 50 }),
    ).toBe(true);
  });
});

