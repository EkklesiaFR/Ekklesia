
/**
 * Schulze Method Tallying Implementation
 * Computes the winner and full ranking of projects based on ranked ballots.
 */

export function computeSchulzeResults(projectIds: string[], ballots: { rankedProjectIds: string[] }[]) {
  const numProjects = projectIds.length;
  const projectIndexMap = new Map(projectIds.map((id, index) => [id, index]));

  // 1. Compute pairwise preferences d[i][j]
  // d[i][j] is the number of voters who prefer project i to project j
  const d: number[][] = Array.from({ length: numProjects }, () => Array(numProjects).fill(0));

  for (const ballot of ballots) {
    const ranking = ballot.rankedProjectIds;
    for (let i = 0; i < ranking.length; i++) {
      const pI = projectIndexMap.get(ranking[i])!;
      for (let j = i + 1; j < ranking.length; j++) {
        const pJ = projectIndexMap.get(ranking[j])!;
        d[pI][pJ]++;
      }
    }
    
    // Handle unranked projects: Ranked > Unranked
    const unranked = projectIds.filter(id => !ranking.includes(id));
    for (const rankedId of ranking) {
      const pRanked = projectIndexMap.get(rankedId)!;
      for (const unrankedId of unranked) {
        const pUnranked = projectIndexMap.get(unrankedId)!;
        d[pRanked][pUnranked]++;
      }
    }
  }

  // 2. Compute strongest path strengths p[i][j]
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

  // 3. Determine relative ranking
  // Project i is better than project j if p[i][j] > p[j][i]
  const winCounts = projectIds.map((id, i) => {
    let wins = 0;
    for (let j = 0; j < numProjects; j++) {
      if (i !== j && p[i][j] > p[j][i]) {
        wins++;
      }
    }
    return { id, wins };
  });

  // Sort by number of wins descending
  winCounts.sort((a, b) => b.wins - a.wins);

  const fullRanking = winCounts.map((wc, index) => ({
    projectId: wc.id,
    rank: index + 1
  }));

  return {
    winnerId: winCounts[0]?.id || null,
    fullRanking,
    totalBallots: ballots.length
  };
}
