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
  type FirestoreError,
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

export type OnlinePresenceResult = {
  users: PresenceUser[];
  onlineCount: number;
  deltaLastMinute: number;
  isLoading: boolean;
  error?: FirestoreError | null;
};

/**
 * Realtime online presence (robuste sans index composite)
 *
 * Stratégie:
 * - requête Firestore uniquement sur lastSeenAt (range + orderBy sur le même champ => OK sans index composite)
 * - filtrage "status === online" + cutoff côté client
 * - deltaLastMinute calculé côté client
 */
export function useOnlinePresence(
  assemblyId: string | null | undefined,
  staleMs = 120_000,
  sampleWindowMs = 70_000
): OnlinePresenceResult {
  const db = useFirestore();

  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deltaLastMinute, setDeltaLastMinute] = useState<number>(0);
  const [error, setError] = useState<FirestoreError | null>(null);

  const samplesRef = useRef<Sample[]>([]);

  // cutoff recalculé quand staleMs change; la "fraîcheur" est surtout assurée par le heartbeat
  const cutoff = useMemo(
    () => Timestamp.fromMillis(Date.now() - staleMs),
    [staleMs]
  );

  useEffect(() => {
    if (!assemblyId) {
      setUsers([]);
      setDeltaLastMinute(0);
      setIsLoading(false);
      setError(null);
      samplesRef.current = [];
      return;
    }

    setIsLoading(true);
    setError(null);

    const colRef = collection(db, 'assemblies', assemblyId, 'presence');

    // ✅ IMPORTANT: pas de where('status'=='online') => évite l’index composite
    // On récupère les présences "récentes" et on filtre ensuite.
    const q = query(
      colRef,
      where('lastSeenAt', '>=', cutoff),
      orderBy('lastSeenAt', 'desc'),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as any), uid: d.id }) as PresenceUser)
          .filter((u) => u.status === 'online')
          .filter((u) => {
            const t = u.lastSeenAt?.toMillis?.();
            return typeof t === 'number' ? t >= cutoff.toMillis() : false;
          });

        const count = list.length;

        setUsers(list);
        setIsLoading(false);

        // ---- delta (last minute-ish)
        const now = Date.now();
        const samples = samplesRef.current;

        samples.push({ t: now, count });

        const pruned = samples.filter((s) => now - s.t <= sampleWindowMs);
        samplesRef.current = pruned;

        const ref = pruned[0];
        setDeltaLastMinute(ref ? count - ref.count : 0);
      },
      (err) => {
        // 🔎 Si un jour tu remets status==online, tu verras ici l’erreur d’index composite
        console.error('[presence] onSnapshot error:', err);
        setError(err);
        setUsers([]);
        setDeltaLastMinute(0);
        setIsLoading(false);
        samplesRef.current = [];
      }
    );

    return () => unsub();
  }, [db, assemblyId, cutoff, sampleWindowMs]);

  return {
    users,
    onlineCount: users.length,
    deltaLastMinute,
    isLoading,
    error,
  };
}

export default useOnlinePresence;