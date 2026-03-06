'use client';

import { useEffect, useState } from 'react';
import {
  type CollectionReference,
  type DocumentData,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
  onSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Ajoute un champ `id` au type d'un document Firestore. */
export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * Structure interne du SDK Firestore.
 * On l'utilise uniquement en fallback pour récupérer un chemin lisible.
 * À garder défensive car non contractuelle.
 */
type InternalQueryLike = {
  _query?: {
    path?: {
      canonicalString?: () => string;
      toString?: () => string;
    };
  };
};

type MemoizedCollectionTarget =
  | ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean })
  | null
  | undefined;

function getReadablePath(target: MemoizedCollectionTarget): string {
  if (!target) return 'unknown';

  try {
    const maybeCollection = target as CollectionReference<DocumentData>;
    if (typeof maybeCollection.path === 'string' && maybeCollection.path.length > 0) {
      return maybeCollection.path;
    }
  } catch {
    // ignore
  }

  try {
    const internal = target as unknown as InternalQueryLike;
    const canonical = internal._query?.path?.canonicalString?.();
    if (canonical) return canonical;

    const asString = internal._query?.path?.toString?.();
    if (asString) return asString;
  } catch {
    // ignore
  }

  return 'unknown';
}

/**
 * Hook temps réel pour écouter une collection ou une query Firestore.
 *
 * IMPORTANT:
 * - l'argument doit être mémoïsé via useMemoFirebase
 * - si null/undefined, le hook attend simplement sans lancer d'écoute
 */
export function useCollection<T = Record<string, unknown>>(
  memoizedTargetRefOrQuery: MemoizedCollectionTarget
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = snapshot.docs.map((snapshotDoc) => ({
          ...(snapshotDoc.data() as T),
          id: snapshotDoc.id,
        }));

        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        setData(null);
        setError(err);
        setIsLoading(false);

        // On n'émet une erreur globale "permission-error"
        // que si Firestore confirme réellement permission-denied.
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: getReadablePath(memoizedTargetRefOrQuery),
          });

          errorEmitter.emit('permission-error', contextualError);
        } else {
          // Optionnel : log brut pour debug réel
          console.error('[useCollection] Firestore error:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(
      'useCollection expected a memoized Firestore query/ref from useMemoFirebase.'
    );
  }

  return { data, isLoading, error };
}