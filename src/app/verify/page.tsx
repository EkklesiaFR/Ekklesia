'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function VerifyPage() {
  const params = useSearchParams();

  const voteId = params.get('voteId');
  const assemblyId = params.get('assemblyId');
  const seal = params.get('seal');

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    if (!voteId || !assemblyId || !seal) return null;
    return `/api/verify?voteId=${encodeURIComponent(voteId)}&assemblyId=${encodeURIComponent(
      assemblyId
    )}&seal=${encodeURIComponent(seal)}`;
  }, [voteId, assemblyId, seal]);

  useEffect(() => {
    if (!url) return;

    setData(null);
    setError(null);

    fetch(url)
      .then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
        return json;
      })
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Erreur'));
  }, [url]);

  if (!voteId || !assemblyId || !seal) {
    return <div className="p-10">Lien incomplet : paramètres manquants.</div>;
  }

  if (error) {
    return <div className="p-10">Erreur de vérification : {error}</div>;
  }

  if (!data) {
    return <div className="p-10">Vérification en cours...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-xl w-full border p-8 space-y-6">
        <h1 className="text-2xl font-bold">Vérification du Procès-Verbal</h1>

        {data.ok ? (
          <div className="text-green-600 font-bold text-lg">✅ PV authentique — scellé valide</div>
        ) : (
          <div className="text-red-600 font-bold text-lg">❌ PV invalide — scellé différent</div>
        )}

        <div className="text-sm space-y-2">
          <div>Vote ID : {data.voteId}</div>
          <div>Assembly ID : {data.assemblyId}</div>
        </div>
      </div>
    </div>
  );
}