'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function VerifyPage() {
  const params = useSearchParams();
  const voteId = params.get('voteId');
  const assemblyId = params.get('assemblyId');
  const seal = params.get('seal');

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!voteId || !assemblyId || !seal) return;

    fetch(`/api/verify?voteId=${voteId}&assemblyId=${assemblyId}&seal=${seal}`)
      .then((r) => r.json())
      .then(setData);
  }, [voteId, assemblyId, seal]);

  if (!data) return <div className="p-10">Vérification en cours...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-xl w-full border p-8 space-y-6">
        <h1 className="text-2xl font-bold">Vérification du Procès-Verbal</h1>

        {data.ok ? (
          <div className="text-green-600 font-bold text-lg">
            ✅ PV authentique — scellé valide
          </div>
        ) : (
          <div className="text-red-600 font-bold text-lg">
            ❌ PV invalide — scellé différent
          </div>
        )}

        <div className="text-sm space-y-2">
          <div>Vote ID : {data.voteId}</div>
          <div>Assembly ID : {data.assemblyId}</div>
        </div>
      </div>
    </div>
  );
}