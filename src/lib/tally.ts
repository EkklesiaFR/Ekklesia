/**
 * Schulze (Condorcet) — implémentation robuste.
 * - Supporte les bulletins partiels : les projets non classés sont traités comme "derniers".
 * - Ignore les ids inconnus / doublons dans un bulletin.
 * - Tie-break stable : à égalité, ordre lexicographique de l'id (déterministe).
 *
 * Retour:
 * - winnerId
 * - ranking : score = nb de duels gagnés (p[i][j] > p[j][i]) ; rank = position après tri
 * - total : nb de bulletins
 */

export type RankedBallot = { ranking: string[] };

export type SchulzeRankingRow = { id: string; rank: number; score: number };

export function buildPairwisePreferences(
  projectIds: string[],
  ballots: RankedBallot[]
): number[][] {
  const n = projectIds.length;
  const idx = new Map(projectIds.map((id, i) => [id, i]));
  const d: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const ballot of ballots) {
    // Nettoyage : garde uniquement projectIds connus + pas de doublons, conserve l'ordre
    const seen = new Set<string>();
    const cleanRanking: string[] = [];
    for (const id of ballot.ranking ?? []) {
      if (!idx.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      cleanRanking.push(id);
    }

    // Map position (rank) pour gérer aussi les non-classés
    // pos = 0..k-1 pour classés, Infinity pour non-classés
    const pos = new Map<string, number>();
    cleanRanking.forEach((id, i) => pos.set(id, i));

    // Pour chaque paire (a,b) de projectIds, si a est préféré à b -> d[a][b]++
    // Règle pour bulletins partiels:
    // - classé vs non-classé => classé préféré
    // - non-classé vs non-classé => pas d'info => rien
    // - classé vs classé => celui avec pos plus petit est préféré
    for (let ai = 0; ai < n; ai++) {
      const a = projectIds[ai];
      const pa = pos.has(a) ? (pos.get(a) as number) : Infinity;

      for (let bi = 0; bi < n; bi++) {
        if (ai === bi) continue;
        const b = projectIds[bi];
        const pb = pos.has(b) ? (pos.get(b) as number) : Infinity;

        if (pa < pb) d[ai][bi] += 1;
      }
    }
  }

  return d;
}

export function computeSchulzeResults(projectIds: string[], ballots: RankedBallot[]) {
  const n = projectIds.length;
  if (n === 0) return { winnerId: null as string | null, ranking: [] as SchulzeRankingRow[], total: 0 };

  // 1) Pairwise preferences d[i][j]
  const d = buildPairwisePreferences(projectIds, ballots);

  // 2) Strongest paths p[i][j] (Floyd–Warshall)
  const p: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      p[i][j] = d[i][j] > d[j][i] ? d[i][j] : 0;
    }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      for (let j = 0; j < n; j++) {
        if (j === i || j === k) continue;
        p[i][j] = Math.max(p[i][j], Math.min(p[i][k], p[k][j]));
      }
    }
  }

  // 3) Score = nb de duels gagnés (p[i][j] > p[j][i])
  const rows = projectIds.map((id, i) => {
    let wins = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && p[i][j] > p[j][i]) wins++;
    }
    return { id, wins };
  });

  // Tri déterministe
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // tie-break stable
    return a.id.localeCompare(b.id);
  });

  const ranking: SchulzeRankingRow[] = rows.map((r, idx) => ({
    id: r.id,
    rank: idx + 1,
    score: r.wins,
  }));

  return {
    winnerId: ranking[0]?.id ?? null,
    ranking,
    total: ballots.length,
  };
}

/**
 * BONUS: si plus tard tu stockes une matrice pairwiseMatrix (option C),
 * tu pourras exposer une variante "fromPairwise" (sans relire tous les bulletins).
 *
 * Ici on attend une matrice d[i][j] déjà calculée.
 */
export function computeSchulzeFromPairwise(projectIds: string[], d: number[][]) {
  const n = projectIds.length;
  if (n === 0) return { winnerId: null as string | null, ranking: [] as SchulzeRankingRow[], total: 0 };

  const p: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      p[i][j] = d[i][j] > d[j][i] ? d[i][j] : 0;
    }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      for (let j = 0; j < n; j++) {
        if (j === i || j === k) continue;
        p[i][j] = Math.max(p[i][j], Math.min(p[i][k], p[k][j]));
      }
    }
  }

  const rows = projectIds.map((id, i) => {
    let wins = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && p[i][j] > p[j][i]) wins++;
    }
    return { id, wins };
  });

  rows.sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : a.id.localeCompare(b.id)));

  const ranking: SchulzeRankingRow[] = rows.map((r, idx) => ({
    id: r.id,
    rank: idx + 1,
    score: r.wins,
  }));

  return {
    winnerId: ranking[0]?.id ?? null,
    ranking,
    total: 0, // inconnu à partir de la matrice seule (à toi de le passer si tu veux)
  };
}