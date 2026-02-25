'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, DocumentData } from 'firebase/firestore';
import { Ballot, Project, Vote } from '@/types';
import { computeSchulzeResults } from '@/lib/tally';
import { Trophy } from 'lucide-react';
import { useEffect } from 'react';

interface AdminTrendsPanelProps {
  assemblyId: string;
  voteId: string;
  projects: Project[];
}

/**
 * COMPOSANT CRITIQUE : Ce composant ne doit être monté QUE par un administrateur.
 * Il effectue une requête LIST sur la collection 'ballots'.
 */
export function AdminTrendsPanel({ assemblyId, voteId, projects }: AdminTrendsPanelProps) {
  const db = useFirestore();

  useEffect(() => {
    console.log("🛡️ [DIAGNOSTIC] ADMIN identifié : Lancement du LIST ballots...");
  }, []);

  const ballotsQuery = useMemoFirebase(() => {
    return collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots');
  }, [db, assemblyId, voteId]);

  const { data: ballots, isLoading } = useCollection<Ballot>(ballotsQuery);

  const results = (ballots && projects.length > 0) 
    ? computeSchulzeResults(projects.map(p => p.id), ballots)
    : null;

  const winnerProject = results?.winnerId ? projects.find(p => p.id === results.winnerId) : null;

  if (isLoading) return <p className="text-[10px] text-gray-400 animate-pulse uppercase tracking-widest font-bold">Calcul des tendances...</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
        <Trophy className="h-3 w-3 text-primary" /> Tendance Live (Admin)
      </h3>
      <div className="space-y-4">
        {winnerProject ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-widest text-primary">En tête</p>
            <p className="text-2xl font-bold leading-tight">{winnerProject.title}</p>
            <p className="text-[10px] text-gray-500 uppercase font-medium">{ballots?.length || 0} bulletins analysés</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucun bulletin pour le moment.</p>
        )}
      </div>
    </div>
  );
}
