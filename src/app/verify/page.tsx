import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export const dynamic = 'force-dynamic'; // optionnel mais safe pour une page querystring

export default function VerifyPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="border p-6 max-w-xl w-full text-center">
            <div className="text-lg font-bold">Vérification du Procès-Verbal</div>
            <div className="text-sm text-muted-foreground mt-2">Chargement…</div>
          </div>
        }
      >
        <VerifyClient />
      </Suspense>
    </div>
  );
}