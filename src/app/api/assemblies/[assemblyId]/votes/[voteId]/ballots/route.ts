import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { submitBallot, VoteError } from '@/lib/server/vote-service';
import { voteUid, voteFailure } from '@/lib/server/vote-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: {
  params: Promise<{ assemblyId: string; voteId: string }>;
}) {
  try {
    const uid = await voteUid(req);
    const { assemblyId, voteId } = await params;
    let body;
    try { body = await req.json(); } catch { throw new VoteError(400, 'Invalid JSON'); }
    return NextResponse.json(await submitBallot(getAdminDb(), uid, assemblyId, voteId, body?.ranking));
  } catch (error) { return voteFailure(error); }
}
