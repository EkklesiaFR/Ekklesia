'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { collection, doc, getCountFromServer, onSnapshot } from 'firebase/firestore';
import type { Vote } from '@/types';

interface UseVoteBallotCountProps {
  assemblyId: string;
  voteId: string;
  status: Vote['state'];
  mode: 'realtime' | 'frozen';
  frozenCount?: number;
}

export function useVoteBallotCount({ assemblyId, voteId, status, mode, frozenCount }: UseVoteBallotCountProps) {
  const [count, setCount] = useState(frozenCount ?? 0);
  const [isLoading, setIsLoading] = useState(true);
  const db = useFirestore();

  const { isAdmin, isMemberLoading } = useAuthStatus();

  useEffect(() => {
    if (!assemblyId || !voteId || status !== 'open') {
      setIsLoading(false);
      if (status === 'locked' && frozenCount != null) setCount(frozenCount);
      return;
    }

    if (isMemberLoading) return;

    // MEMBER: read vote.ballotCount (no ballots list)
    if (!isAdmin) {
      const voteDocRef = doc(db, 'assemblies', assemblyId, 'votes', voteId);
      const unsubscribe = onSnapshot(
        voteDocRef,
        (docSnap) => {
          if (docSnap.exists()) setCount((docSnap.data() as any).ballotCount ?? 0);
          setIsLoading(false);
        },
        (error) => {
          console.error('useVoteBallotCount (member) error:', error);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    }

    // ADMIN: can count ballots
    const ballotsColRef = collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots');

    if (mode === 'realtime') {
      const unsubscribe = onSnapshot(
        ballotsColRef,
        (snapshot) => {
          setCount(snapshot.size);
          setIsLoading(false);
        },
        (error) => {
          console.error('useVoteBallotCount (admin realtime) error:', error);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    }

    getCountFromServer(ballotsColRef)
      .then((snapshot) => {
        setCount(snapshot.data().count);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('useVoteBallotCount (admin frozen) error:', error);
        setIsLoading(false);
      });
  }, [assemblyId, voteId, status, mode, db, frozenCount, isAdmin, isMemberLoading]);

  return { count, isLoading };
}