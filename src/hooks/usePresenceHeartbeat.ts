'use client';

import { useEffect, useMemo, useRef } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

type PresenceStatus = 'online' | 'offline';

function randomSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Heartbeat présence (online/offline) dans:
 * assemblies/{assemblyId}/presence/{uid}
 */
export function usePresenceHeartbeat(assemblyId: string | null | undefined, intervalMs = 15_000) {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const sessionId = useMemo(() => randomSessionId(), []);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!assemblyId) return;
    if (isUserLoading) return;
    if (!user?.uid) return;

    const presenceRef = doc(db, 'assemblies', assemblyId, 'presence', user.uid);

    let interval: ReturnType<typeof setInterval> | null = null;

    const upsert = async (status: PresenceStatus) => {
      await setDoc(
        presenceRef,
        {
          uid: user.uid,
          status,
          sessionId,
          // Optionnel (si tu veux les avatars plus tard)
          photoURL: user.photoURL ?? null,
          displayName: user.displayName ?? null,
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      );
    };

    const heartbeat = async () => {
      try {
        await updateDoc(presenceRef, {
          status: 'online',
          sessionId,
          lastSeenAt: serverTimestamp(),
        });
      } catch {
        await upsert('online');
      }
    };

    // Evite double start en dev (React strict mode)
    if (!startedRef.current) {
      startedRef.current = true;
      upsert('online').catch(() => {});
    }

    interval = setInterval(() => {
      heartbeat().catch(() => {});
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        heartbeat().catch(() => {});
      } else {
        upsert('offline').catch(() => {});
      }
    };

    const onBeforeUnload = () => {
      upsert('offline').catch(() => {});
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      upsert('offline').catch(() => {});
      startedRef.current = false;
    };
  }, [assemblyId, db, intervalMs, isUserLoading, sessionId, user]);
}

export default usePresenceHeartbeat;