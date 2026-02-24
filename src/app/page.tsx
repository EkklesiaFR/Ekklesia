
'use client';

/**
 * Cette page racine redirige simplement vers le groupe (protected).
 * Le layout global et le middleware Next.js (si configuré) ou le RequireActiveMember
 * dans (protected)/layout.tsx géreront la redirection vers /login si nécessaire.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirige vers la page d'accueil protégée par défaut
    router.replace('/');
  }, [router]);

  return null;
}
