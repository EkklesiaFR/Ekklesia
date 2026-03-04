'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export type PresenceUser = {
  uid: string;
  status?: 'online' | 'offline';
  lastSeenAt?: Timestamp;
  sessionId?: string;
  photoURL?: string | null;
  displayName?: string | null;
};

type Sample = { t: number; count: number };

type Result = {
  users: PresenceUser[];
  onlineCount: number;
  deltaLastMinute: number;
  isLoading: boolean;
};

/**
 * Realtime online presence:
 * - filtre stale côté client via cutoff (lastSeenAt >= now - staleMs)
 * - deltaLastMinute calculé en local
 */
export function useOnlinePresence(
  assemblyId: string | null | undefined,
  staleMs = 45_000
): Result {
  const db = useFirestore();

  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deltaLastMinute, setDeltaLastMinute] = useState(0);

  const samplesRef = useRef<Sample[]>([]);

  const cutoff = useMemo(() => {
    return Timestamp.fromDate(new Date(Date.now() - staleMs));
  }, [staleMs]);

  useEffect(() => {
    if (!assemblyId) {
      setUsers([]);
      setDeltaLastMinute(0);
      setIsLoading(false);
      samplesRef.current = [];
      return;
    }

    setIsLoading(true);

    const colRef = collection(db, 'assemblies', assemblyId, 'presence');
    const q = query(
      colRef,
      where('status', '==', 'online'),
      where('lastSeenAt', '>=', cutoff),
      orderBy('lastSeenAt', 'desc'),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as any), uid: d.id })) as PresenceUser[];
        const count = list.length;

        setUsers(list);
        setIsLoading(false);

        // delta last minute
        const now = Date.now();
        const samples = samplesRef.current;

        samples.push({ t: now, count });
        const pruned = samples.filter((s) => now - s.t <= 70_000);
        samplesRef.current = pruned;

        const ref = pruned[0];
        setDeltaLastMinute(ref ? count - ref.count : 0);
      },
      () => {
        setUsers([]);
        setDeltaLastMinute(0);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [db, assemblyId, cutoff]);

  return {
    users,
    onlineCount: users.length,
    deltaLastMinute,
    isLoading,
  };
}

export default useOnlinePresence;