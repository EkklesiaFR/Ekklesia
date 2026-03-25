import { describe, it, expect } from "vitest";
import {
  buildPairwisePreferences,
  computeSchulzeResults,
  computeSchulzeFromPairwise,
  type RankedBallot,
} from "./tally";

describe("tally / Schulze", () => {
  describe("buildPairwisePreferences", () => {
    it("construit correctement la matrice pairwise sur un cas simple", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [
        { ranking: ["A", "B", "C"] },
        { ranking: ["A", "C", "B"] },
        { ranking: ["B", "A", "C"] },
      ];

      const d = buildPairwisePreferences(projectIds, ballots);

      expect(d[0][1]).toBe(2);
      expect(d[1][0]).toBe(1);

      expect(d[0][2]).toBe(3);
      expect(d[2][0]).toBe(0);

      expect(d[1][2]).toBe(2);
      expect(d[2][1]).toBe(1);
    });

    it("traite les projets non classés comme derniers dans les bulletins partiels", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [{ ranking: ["A"] }];

      const d = buildPairwisePreferences(projectIds, ballots);

      expect(d[0][1]).toBe(1);
      expect(d[1][0]).toBe(0);

      expect(d[0][2]).toBe(1);
      expect(d[2][0]).toBe(0);

      expect(d[1][2]).toBe(0);
      expect(d[2][1]).toBe(0);
    });

    it("ignore les ids inconnus et les doublons en conservant le premier ordre valide", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [
        { ranking: ["X", "B", "B", "A", "Y", "C", "A"] },
      ];

      const d = buildPairwisePreferences(projectIds, ballots);

      expect(d[1][0]).toBe(1);
      expect(d[0][1]).toBe(0);

      expect(d[1][2]).toBe(1);
      expect(d[2][1]).toBe(0);

      expect(d[0][2]).toBe(1);
      expect(d[2][0]).toBe(0);
    });

    it("retourne une matrice n x n remplie de 0 si aucun bulletin", () => {
      const projectIds = ["A", "B", "C"];
      const d = buildPairwisePreferences(projectIds, []);

      expect(d).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });
  });

  describe("computeSchulzeResults", () => {
    it("retourne null et un ranking vide si aucun projet", () => {
      const result = computeSchulzeResults([], []);

      expect(result).toEqual({
        winnerId: null,
        ranking: [],
        total: 0,
      });
    });

    it("retourne le seul candidat quand il n'y a qu'un projet", () => {
      const result = computeSchulzeResults(["A"], [
        { ranking: ["A"] },
        { ranking: ["A"] },
      ]);

      expect(result.winnerId).toBe("A");
      expect(result.total).toBe(2);
      expect(result.ranking).toEqual([{ id: "A", rank: 1, score: 0 }]);
    });

    it("élit A contre B à la majorité simple", () => {
      const result = computeSchulzeResults(["A", "B"], [
        { ranking: ["A", "B"] },
        { ranking: ["A", "B"] },
        { ranking: ["B", "A"] },
      ]);

      expect(result.winnerId).toBe("A");
      expect(result.total).toBe(3);
      expect(result.ranking).toEqual([
        { id: "A", rank: 1, score: 1 },
        { id: "B", rank: 2, score: 0 },
      ]);
    });

    it("respecte un classement unanime", () => {
      const result = computeSchulzeResults(["A", "B", "C"], [
        { ranking: ["A", "B", "C"] },
        { ranking: ["A", "B", "C"] },
        { ranking: ["A", "B", "C"] },
      ]);

      expect(result.winnerId).toBe("A");
      expect(result.ranking).toEqual([
        { id: "A", rank: 1, score: 2 },
        { id: "B", rank: 2, score: 1 },
        { id: "C", rank: 3, score: 0 },
      ]);
    });

    it("élit le gagnant de Condorcet lorsqu'il existe", () => {
      const result = computeSchulzeResults(["A", "B", "C"], [
        { ranking: ["A", "B", "C"] },
        { ranking: ["A", "C", "B"] },
        { ranking: ["B", "A", "C"] },
        { ranking: ["A", "B", "C"] },
      ]);

      expect(result.winnerId).toBe("A");
      expect(result.ranking[0]).toEqual({ id: "A", rank: 1, score: 2 });
    });

    it("produit un classement complet et déterministe en cas de cycle parfait", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [
        { ranking: ["A", "B", "C"] },
        { ranking: ["B", "C", "A"] },
        { ranking: ["C", "A", "B"] },
      ];

      const result = computeSchulzeResults(projectIds, ballots);

      expect(result.total).toBe(3);
      expect(result.ranking).toHaveLength(3);
      expect(result.ranking.map((r) => r.id)).toEqual(["A", "B", "C"]);
      expect(new Set(result.ranking.map((r) => r.id)).size).toBe(3);
      expect(result.winnerId).toBe("A");
      expect(result.ranking.every((r) => r.score === 0)).toBe(true);
    });

    it("applique le tie-break lexicographique quand tous les scores sont à égalité", () => {
      const result = computeSchulzeResults(["C", "A", "B"], []);

      expect(result.total).toBe(0);
      expect(result.winnerId).toBe("A");
      expect(result.ranking).toEqual([
        { id: "A", rank: 1, score: 0 },
        { id: "B", rank: 2, score: 0 },
        { id: "C", rank: 3, score: 0 },
      ]);
    });

    it("accepte les bulletins partiels et place les non classés derrière", () => {
        const result = computeSchulzeResults(["A", "B", "C"], [
          { ranking: ["B"] },
          { ranking: ["B", "A"] },
          { ranking: ["C"] },
        ]);
      
        expect(result.total).toBe(3);
        expect(result.ranking.map((r) => r.id)).toEqual(["B", "A", "C"]);
        expect(result.winnerId).toBe("B");
      });

    it("ignore les ids inconnus et les doublons sans planter", () => {
      const result = computeSchulzeResults(["A", "B", "C"], [
        { ranking: ["X", "B", "B", "A", "Y", "C"] },
        { ranking: ["A", "C"] },
      ]);

      expect(result.total).toBe(2);
      expect(result.ranking).toHaveLength(3);
      expect(new Set(result.ranking.map((r) => r.id))).toEqual(
        new Set(["A", "B", "C"])
      );
    });

    it("est indépendant de l'ordre des bulletins", () => {
      const projectIds = ["A", "B", "C", "D"];
      const ballotsA: RankedBallot[] = [
        { ranking: ["A", "C", "B", "D"] },
        { ranking: ["A", "B", "C", "D"] },
        { ranking: ["B", "C", "A", "D"] },
        { ranking: ["C", "A", "B", "D"] },
        { ranking: ["A", "C", "B", "D"] },
      ];

      const ballotsB: RankedBallot[] = [...ballotsA].reverse();

      const resultA = computeSchulzeResults(projectIds, ballotsA);
      const resultB = computeSchulzeResults(projectIds, ballotsB);

      expect(resultA).toEqual(resultB);
    });

    it("est déterministe sur deux exécutions successives", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [
        { ranking: ["A", "B", "C"] },
        { ranking: ["B", "C", "A"] },
        { ranking: ["A", "C", "B"] },
      ];

      const result1 = computeSchulzeResults(projectIds, ballots);
      const result2 = computeSchulzeResults(projectIds, ballots);

      expect(result1).toEqual(result2);
    });

    it("ne classe jamais B devant A si tous les bulletins valides préfèrent A à B", () => {
      const result = computeSchulzeResults(["A", "B", "C"], [
        { ranking: ["A", "B", "C"] },
        { ranking: ["C", "A", "B"] },
        { ranking: ["A"] },
        { ranking: ["X", "A", "B", "B"] },
      ]);

      const ids = result.ranking.map((r) => r.id);
      expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    });
  });

  describe("computeSchulzeFromPairwise", () => {
    it("produit le même résultat que computeSchulzeResults à partir de la matrice pairwise", () => {
      const projectIds = ["A", "B", "C"];
      const ballots: RankedBallot[] = [
        { ranking: ["A", "B", "C"] },
        { ranking: ["A", "C", "B"] },
        { ranking: ["B", "A", "C"] },
        { ranking: ["A", "B", "C"] },
      ];

      const d = buildPairwisePreferences(projectIds, ballots);
      const fromBallots = computeSchulzeResults(projectIds, ballots);
      const fromPairwise = computeSchulzeFromPairwise(projectIds, d);

      expect(fromPairwise.winnerId).toBe(fromBallots.winnerId);
      expect(fromPairwise.ranking).toEqual(fromBallots.ranking);
      expect(fromPairwise.total).toBe(0);
    });

    it("retourne null et un ranking vide si aucun projet", () => {
      const result = computeSchulzeFromPairwise([], []);

      expect(result).toEqual({
        winnerId: null,
        ranking: [],
        total: 0,
      });
    });
  });
});