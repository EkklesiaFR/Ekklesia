'use client';

import { useState, useEffect } from 'react';
import { collection, getCountFromServer, onSnapshot, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

interface UseVoteBallotCountParams {
  assemblyId: string;
  voteId: string;
  status: 'open' | 'locked' | 'closed' | 'draft' | string;
  frozenCount?: number;
  mode?: 'once' | 'realtime';
}

interface UseVoteBallotCountReturn {
  count: number;
  isLoading: boolean;
  error?: string;
}

/**
 * A hook to count ballots for a given vote, with different strategies based on the vote status.
 * - For 'draft' votes, returns 0 immediately.
 * - For 'open' votes, it can count in realtime or once.
 * - For 'locked' or 'closed' votes, it prefers the frozen count from vote.results.totalBallots.
 * - If the frozen count is missing for a locked/closed vote, it falls back to a one-time count.
 */
export function useVoteBallotCount({
  assemblyId,
  voteId,
  status,
  frozenCount,
  mode = 'once',
}: UseVoteBallotCountParams): UseVoteBallotCountReturn {
  const db = useFirestore();
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    // 1. Short-circuit for draft votes, which can have no ballots.
    if (status === 'draft') {
      setCount(0);
      setIsLoading(false);
      return;
    }

    // 2. If status is final and we have a frozen count, use it immediately.
    if ((status === 'locked' || status === 'closed') && typeof frozenCount === 'number') {
      setCount(frozenCount);
      setIsLoading(false);
      return;
    }

    // 3. Ensure essential IDs and db connection are present before querying.
    if (!db || !assemblyId || !voteId) {
      setIsLoading(false);
      return;
    }

    const ballotsRef = collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots');
    const q = query(ballotsRef);

    // 4. Determine the effective mode.
    // Fallback to 'once' if the vote is finished but lacks a frozenCount.
    const effectiveMode = (status === 'locked' || status === 'closed') ? 'once' : mode;

    if (effectiveMode === 'realtime') {
      // 5. Realtime mode: Subscribe to snapshot changes.
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setCount(snapshot.size);
          setIsLoading(false);
        },
        (err) => {
          console.error('[useVoteBallotCount] Realtime count error:', err);
          setError(err.message);
          setIsLoading(false);
        }
      );

      return () => unsubscribe(); // Cleanup subscription
    } else {
      // 6. One-time mode: Use efficient server-side aggregation.
      let isCancelled = false;

      const fetchCount = async () => {
        try {
          const snapshot = await getCountFromServer(q);
          if (!isCancelled) {
            setCount(snapshot.data().count);
          }
        } catch (err: any) {
          console.error('[useVoteBallotCount] One-time count error:', err);
          if (!isCancelled) {
            setError(err.message);
          }
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      };

      fetchCount();

      return () => {
        isCancelled = true;
      };
    }
  }, [db, assemblyId, voteId, status, frozenCount, mode]);

  return { count, isLoading, error };
}
