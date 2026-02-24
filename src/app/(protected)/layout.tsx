
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';

/**
 * Ce layout enveloppe toutes les routes protégées.
 * Il utilise le composant RequireActiveMember pour vérifier l'auth et le statut de membre.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireActiveMember>{children}</RequireActiveMember>;
}
