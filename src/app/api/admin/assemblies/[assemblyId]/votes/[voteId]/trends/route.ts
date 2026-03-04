import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { getAdminApp, getAdminDb } from '@/lib/firebase/admin';
import { computeSchulzeResults } from '@/lib/tally';
import type { Ballot, Project } from '@/types';

export const runtime = 'nodejs';

type RouteParams = { assemblyId: string; voteId: string };

type AdminTrendsDTO = {
  winnerId: string | null;
  ballotCount: number;
  computedAt: string; // ISO 8601
  winnerProject?: {
    id: string;
    title: string;
    imageUrl?: string | null;
  };
  fullRanking?: Array<{ id: string; rank: number; score: number }>;
};

// Cache mémoire (par instance). Suffisant pour dev/App Hosting.
// (Sur plusieurs instances, le cache n’est pas partagé → OK avec TTL court)
const cache = new Map<string, { data: AdminTrendsDTO; ts: number }>();
const CACHE_TTL_MS = 15_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function requireAdminActive() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value ?? '';

  if (!sessionCookie) {
    return { ok: false as const, status: 401 as const };
  }

  try {
    const auth = getAdminApp().auth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);

    const memberSnap = await getAdminDb().collection('members').doc(decoded.uid).get();
    const data = memberSnap.data() as { role?: string; status?: string } | undefined;

    if (!data || data.role !== 'admin' || data.status !== 'active') {
      return { ok: false as const, status: 403 as const };
    }

    return { ok: true as const, uid: decoded.uid };
  } catch (e) {
    // cookie invalide / expiré
    return { ok: false as const, status: 401 as const };
  }
}

export async function GET(_req: Request, { params }: { params: Promise<RouteParams> }) {
  const auth = await requireAdminActive();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const { assemblyId, voteId } = await params;

  const cacheKey = `${assemblyId}:${voteId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const db = getAdminDb();

    const voteRef = db.collection('assemblies').doc(assemblyId).collection('votes').doc(voteId);

    const [voteSnap, ballotsSnap] = await Promise.all([
      voteRef.get(),
      voteRef.collection('ballots').get(),
    ]);

    if (!voteSnap.exists) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    const voteData = voteSnap.data() as { projectIds?: string[] } & Record<string, unknown>;
    const projectIds = (voteData.projectIds ?? []).map(String);

    const ballots: Ballot[] = ballotsSnap.docs.map(
      (d: FirebaseFirestore.QueryDocumentSnapshot) => d.data() as Ballot
    );

    const ballotCount = ballots.length;

    // DTO stable même si pas prêt / pas de projets
    if (projectIds.length === 0) {
      const empty: AdminTrendsDTO = {
        winnerId: null,
        ballotCount,
        computedAt: new Date().toISOString(),
      };
      cache.set(cacheKey, { data: empty, ts: Date.now() });
      return NextResponse.json(empty);
    }

    // Charger les projets (Firestore "in" limité à 10)
    const projectsById = new Map<string, Project>();
    for (const group of chunk(projectIds, 10)) {
      const snap = await db.collection('projects').where('__name__', 'in', group).get();
      snap.docs.forEach((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        const p = { id: docSnap.id, ...(docSnap.data() as Omit<Project, 'id'>) } as Project;
        projectsById.set(p.id, p);
      });
    }

    // Calcul Schulze (robuste aux bulletins partiels)
    const results = computeSchulzeResults(projectIds, ballots as Array<{ ranking: string[] }>);

    const winnerId = results.winnerId ? String(results.winnerId) : null;
    const winner = winnerId ? projectsById.get(winnerId) : undefined;

    const winnerImageUrl =
      winner
        ? ((winner as any).imageUrl ??
          (winner as any).coverImageUrl ??
          (winner as any).thumbnailUrl ??
          null)
        : null;

    const dto: AdminTrendsDTO = {
      winnerId,
      ballotCount,
      computedAt: new Date().toISOString(),
      winnerProject: winner
        ? {
            id: winner.id,
            title: (winner as any).title ?? (winner as any).name ?? winner.id,
            imageUrl: winnerImageUrl,
          }
        : undefined,
      // utile si tu veux top 5 côté UI (sinon tu peux retirer)
      fullRanking: results.ranking,
    };

    cache.set(cacheKey, { data: dto, ts: Date.now() });
    return NextResponse.json(dto);
  } catch (e) {
    console.error('[TRENDS] error', e);
    return NextResponse.json({ error: 'Trends failed' }, { status: 500 });
  }
}