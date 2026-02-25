/**
 * Implémentation de la méthode de Schulze (Condorcet)
 * Calcule le classement final à partir de bulletins préférentiels.
 */

export function computeSchulzeResults(projectIds: string[], ballots: { ranking: string[] }[]) {
  const numProjects = projectIds.length;
  if (numProjects === 0) return { winnerId: null, ranking: [], total: 0 };

  const projectIndexMap = new Map(projectIds.map((id, index) => [id, index]));

  // 1. Calcul des préférences par paires d[i][j]
  // d[i][j] est le nombre de votants préférant le projet i au projet j
  const d: number[][] = Array.from({ length: numProjects }, () => Array(numProjects).fill(0));

  for (const ballot of ballots) {
    const ranking = ballot.ranking;
    for (let i = 0; i < ranking.length; i++) {
      const pI = projectIndexMap.get(ranking[i]);
      if (pI === undefined) continue;
      for (let j = i + 1; j < ranking.length; j++) {
        const pJ = projectIndexMap.get(ranking[j]);
        if (pJ === undefined) continue;
        d[pI][pJ]++;
      }
    }
  }

  // 2. Calcul des forces des chemins les plus forts p[i][j] (Floyd-Warshall)
  const p: number[][] = Array.from({ length: numProjects }, () => Array(numProjects).fill(0));

  for (let i = 0; i < numProjects; i++) {
    for (let j = 0; j < numProjects; j++) {
      if (i !== j) {
        if (d[i][j] > d[j][i]) {
          p[i][j] = d[i][j];
        } else {
          p[i][j] = 0;
        }
      }
    }
  }

  for (let k = 0; k < numProjects; k++) {
    for (let i = 0; i < numProjects; i++) {
      if (i !== k) {
        for (let j = 0; j < numProjects; j++) {
          if (i !== j && j !== k) {
            p[i][j] = Math.max(p[i][j], Math.min(p[i][k], p[k][j]));
          }
        }
      }
    }
  }

  // 3. Détermination du classement final
  // Le projet i est "meilleur" que j si p[i][j] > p[j][i]
  const scores = projectIds.map((id, i) => {
    let wins = 0;
    for (let j = 0; j < numProjects; j++) {
      if (i !== j && p[i][j] > p[j][i]) {
        wins++;
      }
    }
    return { id, wins };
  });

  // Tri par nombre de victoires décroissant
  const sorted = [...scores].sort((a, b) => b.wins - a.wins);

  return {
    winnerId: sorted[0]?.id || null,
    ranking: sorted.map((s, idx) => ({ 
      id: s.id, 
      rank: idx + 1,
      score: s.wins 
    })),
    total: ballots.length
  };
}
