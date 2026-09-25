'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Vote } from '@/types';

interface UseVoteBallotCountProps {
  assemblyId: string;
  voteId: string;
  status: Vote['state'];
  mode: 'realtime' | 'frozen';
  frozenCount?: number;
}

export function useVoteBallotCount({ assemblyId, voteId, status, frozenCount }: UseVoteBallotCountProps) {
  const [count, setCount] = useState(frozenCount ?? 0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const db = useFirestore();

  useEffect(() => {
    setCount(frozenCount ?? 0);
    setIsUnavailable(false);
    if (!assemblyId || !voteId) { setIsLoading(false); return; }
    setIsLoading(true);
    return onSnapshot(doc(db, 'assemblies', assemblyId, 'votes', voteId), snap => {
      const data = snap.data();
      const value = status === 'locked' ? data?.results?.total ?? frozenCount : data?.ballotCount;
      // Legacy counters are not trusted until reconciled by a server transaction.
      const known = status === 'draft' || (typeof value === 'number' &&
        (status === 'locked' || data?.counterVersion === 1));
      setCount(known ? value ?? 0 : 0);
      setIsUnavailable(!known);
      setIsLoading(false);
    }, () => { setIsUnavailable(true); setIsLoading(false); });
  }, [assemblyId, voteId, status, db, frozenCount]);

  return { count, isLoading, isUnavailable };
}
