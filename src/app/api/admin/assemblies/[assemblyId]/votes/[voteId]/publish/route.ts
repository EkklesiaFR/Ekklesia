import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { publishVote } from '@/lib/server/vote-service';
import { voteUid, voteFailure } from '@/lib/server/vote-http';
import { sendVoteLockedNotifications } from '@/lib/server/notifications';
import { decisionLabel } from '@/lib/vote-decision';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: {
  params: Promise<{ assemblyId: string; voteId: string }>;
}) {
  try {
    const uid = await voteUid(req);
    const { assemblyId, voteId } = await params;
    const result = await publishVote(getAdminDb(), uid, assemblyId, voteId);
    if (!result.alreadyLocked) {
      try { await sendVoteLockedNotifications({ assemblyId, voteId, decisionSummary: decisionLabel(result.results) }); }
      catch (error) { console.error('[VOTE_NOTIFICATION]', error); }
    }
    return NextResponse.json(result);
  } catch (error) { return voteFailure(error); }
}
