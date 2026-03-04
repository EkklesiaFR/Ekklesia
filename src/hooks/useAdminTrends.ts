'use client';

import useSWR from 'swr';

type TrendsDTO = {
  winnerId: string | null;
  ballotCount: number;
  computedAt: string;
  winnerProject?: { id: string; title: string; imageUrl?: string | null };
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' }); // cookie __session envoyé automatiquement
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error || 'Failed to fetch');
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<TrendsDTO>;
};

export function useAdminTrends(assemblyId: string | null, voteId: string | null) {
  const url =
    assemblyId && voteId
      ? `/api/admin/assemblies/${assemblyId}/votes/${voteId}/trends`
      : null;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  });

  return {
    trends: data ?? null,
    isLoading,
    error: error ?? null,
  };
}