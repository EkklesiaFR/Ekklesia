import { NextResponse } from 'next/server';
import { getApp, getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
}

type PublicHomeProject = {
  id: string;
  title: string;
  summary: string;
  budget: string;
  imageUrl: string;
};

export async function GET() {
  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);

    const membersQuery = db.collection('members').where('status', '==', 'active');
    const projectsQuery = db.collection('projects').orderBy('createdAt', 'desc').limit(5);

    const [membersSnap, projectsSnap] = await Promise.all([
      membersQuery.get(),
      projectsQuery.get(),
    ]);

    const membersCount = membersSnap.size;

    const featuredProjects: PublicHomeProject[] = projectsSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;

      return {
        id: doc.id,
        title: typeof data.title === 'string' ? data.title : 'Projet sans titre',
        summary: typeof data.summary === 'string' ? data.summary : '',
        budget: typeof data.budget === 'string' ? data.budget : '',
        imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
      };
    });

    return NextResponse.json(
      {
        membersCount,
        featuredProjects,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[API /public/home] Failed to load public home data:', message);

    return NextResponse.json(
      {
        membersCount: 0,
        featuredProjects: [],
        error: 'Unable to load public home data',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}