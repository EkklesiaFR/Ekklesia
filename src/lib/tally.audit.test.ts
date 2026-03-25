import { describe, it, expect } from "vitest";
import {
  buildPairwisePreferences,
  computeSchulzeResults,
  type RankedBallot,
} from "./tally";

describe("tally / Schulze / audit scenarios", () => {
  it("audit scenario 1 - majorité claire et lisible", () => {
    const projectIds = ["cafe", "frigo", "atelier"];
    const ballots: RankedBallot[] = [
      { ranking: ["frigo", "cafe", "atelier"] },
      { ranking: ["frigo", "atelier", "cafe"] },
      { ranking: ["frigo", "cafe", "atelier"] },
      { ranking: ["cafe", "frigo", "atelier"] },
      { ranking: ["frigo", "cafe", "atelier"] },
    ];

    const result = computeSchulzeResults(projectIds, ballots);

    expect(result.total).toBe(5);
    expect(result.winnerId).toBe("frigo");
    expect(result.ranking).toEqual([
      { id: "frigo", rank: 1, score: 2 },
      { id: "cafe", rank: 2, score: 1 },
      { id: "atelier", rank: 3, score: 0 },
    ]);
  });

  it("audit scenario 2 - cycle Condorcet parfait résolu de façon déterministe", () => {
    const projectIds = ["A", "B", "C"];
    const ballots: RankedBallot[] = [
      { ranking: ["A", "B", "C"] },
      { ranking: ["B", "C", "A"] },
      { ranking: ["C", "A", "B"] },
    ];

    const d = buildPairwisePreferences(projectIds, ballots);
    const result = computeSchulzeResults(projectIds, ballots);

    expect(d).toEqual([
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
    ]);

    expect(result.total).toBe(3);
    expect(result.winnerId).toBe("A");
    expect(result.ranking).toEqual([
      { id: "A", rank: 1, score: 0 },
      { id: "B", rank: 2, score: 0 },
      { id: "C", rank: 3, score: 0 },
    ]);
  });

  it("audit scenario 3 - bulletins partiels, non classés traités comme derniers", () => {
    const projectIds = ["cantine", "maraude", "epicerie"];
    const ballots: RankedBallot[] = [
      { ranking: ["maraude"] },
      { ranking: ["maraude", "cantine"] },
      { ranking: ["epicerie"] },
      { ranking: ["cantine", "maraude"] },
    ];
  
    const d = buildPairwisePreferences(projectIds, ballots);
    const result = computeSchulzeResults(projectIds, ballots);
  
    expect(d).toEqual([
      [0, 1, 2],
      [2, 0, 3],
      [1, 1, 0],
    ]);
  
    expect(result.total).toBe(4);
    expect(result.winnerId).toBe("maraude");
    expect(result.ranking).toEqual([
      { id: "maraude", rank: 1, score: 2 },
      { id: "cantine", rank: 2, score: 1 },
      { id: "epicerie", rank: 3, score: 0 },
    ]);
  });

  it("audit scenario 4 - ids inconnus et doublons ignorés sans changer le résultat logique", () => {
    const projectIds = ["jardin", "repair", "bibli"];
    const ballots: RankedBallot[] = [
      { ranking: ["jardin", "repair", "bibli"] },
      { ranking: ["X", "repair", "repair", "jardin", "Y", "bibli"] },
      { ranking: ["repair", "bibli", "jardin"] },
      { ranking: ["repair", "jardin", "bibli", "jardin"] },
    ];

    const result = computeSchulzeResults(projectIds, ballots);

    expect(result.total).toBe(4);
    expect(result.winnerId).toBe("repair");
    expect(result.ranking).toEqual([
      { id: "repair", rank: 1, score: 2 },
      { id: "jardin", rank: 2, score: 1 },
      { id: "bibli", rank: 3, score: 0 },
    ]);
  });

  it("audit scenario 5 - exemple réaliste à 5 projets", () => {
    const projectIds = ["frigo", "cafe", "maraude", "cantine", "repair"];
    const ballots: RankedBallot[] = [
      { ranking: ["frigo", "cafe", "maraude", "cantine", "repair"] },
      { ranking: ["frigo", "maraude", "cafe", "cantine", "repair"] },
      { ranking: ["cafe", "frigo", "maraude", "cantine", "repair"] },
      { ranking: ["maraude", "frigo", "cafe", "cantine", "repair"] },
      { ranking: ["frigo", "cafe", "cantine", "maraude", "repair"] },
      { ranking: ["frigo", "maraude", "cantine", "cafe", "repair"] },
      { ranking: ["cafe", "maraude", "frigo", "cantine", "repair"] },
      { ranking: ["frigo", "cafe", "maraude", "cantine", "repair"] },
      { ranking: ["maraude", "cafe", "frigo", "cantine", "repair"] },
      { ranking: ["frigo", "cafe", "maraude", "cantine", "repair"] },
    ];

    const result = computeSchulzeResults(projectIds, ballots);

    expect(result.total).toBe(10);
    expect(result.winnerId).toBe("frigo");
    expect(result.ranking).toEqual([
      { id: "frigo", rank: 1, score: 4 },
      { id: "cafe", rank: 2, score: 3 },
      { id: "maraude", rank: 3, score: 2 },
      { id: "cantine", rank: 4, score: 1 },
      { id: "repair", rank: 5, score: 0 },
    ]);
  });
});