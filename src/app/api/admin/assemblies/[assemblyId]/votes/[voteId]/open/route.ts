import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { openVote } from '@/lib/server/vote-service';
import { voteUid, voteFailure } from '@/lib/server/vote-http';
import { sendVoteCreatedNotifications } from '@/lib/server/notifications';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: {
  params: Promise<{ assemblyId: string; voteId: string }>;
}) {
  try {
    const uid = await voteUid(req);
    const { assemblyId, voteId } = await params;
    const result = await openVote(getAdminDb(), uid, assemblyId, voteId);
    if (!result.alreadyOpen) {
      try { await sendVoteCreatedNotifications({ assemblyId, voteId }); }
      catch (error) { console.error('[VOTE_NOTIFICATION]', error); }
    }
    return NextResponse.json(result);
  } catch (error) { return voteFailure(error); }
}
