'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type VerifyResponse =
  | { ok: true; match: true }
  | { ok: true; match: false }
  | { ok: false; error: string };

export default function VerifyClient() {
  const params = useSearchParams();

  const voteId = useMemo(() => params.get('voteId') ?? '', [params]);
  const assemblyId = useMemo(() => params.get('assemblyId') ?? '', [params]);
  const seal = useMemo(() => params.get('seal') ?? '', [params]);

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [res, setRes] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!voteId || !assemblyId || !seal) {
        setRes({ ok: false, error: 'Paramètres manquants (voteId, assemblyId, seal).' });
        setState('error');
        return;
      }

      setState('loading');
      try {
        const r = await fetch(
          `/api/verify?voteId=${encodeURIComponent(voteId)}&assemblyId=${encodeURIComponent(
            assemblyId
          )}&seal=${encodeURIComponent(seal)}`,
          { cache: 'no-store' }
        );
        const json = (await r.json()) as VerifyResponse;
        setRes(json);
        setState(r.ok ? 'done' : 'error');
      } catch {
        setRes({ ok: false, error: 'Erreur réseau.' });
        setState('error');
      }
    };

    run();
  }, [voteId, assemblyId, seal]);

  const title = 'Vérification du Procès-Verbal';

  const statusLine =
    state === 'loading'
      ? 'Chargement…'
      : res?.ok === true
      ? res.match
        ? '✅ PV valide — scellé conforme'
        : '❌ PV invalide — scellé différent'
      : res?.ok === false
      ? `❌ ${res.error}`
      : '';

  const statusColor =
    state === 'loading' ? 'text-muted-foreground' : res?.ok && res.match ? 'text-green-600' : 'text-red-600';

  return (
    <div className="border p-6 max-w-xl w-full bg-white">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className={`mt-3 font-semibold ${statusColor}`}>{statusLine}</p>

      <div className="mt-4 text-sm space-y-1">
        <div>Vote ID : {voteId || '—'}</div>
        <div>Assembly ID : {assemblyId || '—'}</div>
      </div>
    </div>
  );
}