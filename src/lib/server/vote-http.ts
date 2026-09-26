import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAdminApp } from '../firebase/admin';
import { VoteError } from './vote-service';

export async function voteUid(req: Request) {
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const session = bearer ? undefined : (await cookies()).get('__session')?.value;
  if (!bearer && !session) throw new VoteError(401, 'Unauthorized');
  try {
    const auth = getAdminApp().auth();
    return (bearer ? await auth.verifyIdToken(bearer, true) : await auth.verifySessionCookie(session!, true)).uid;
  } catch {
    throw new VoteError(401, 'Invalid or expired authentication');
  }
}

export function voteFailure(error: unknown) {
  if (error instanceof VoteError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[VOTE]', error);
  return NextResponse.json({ error: 'Vote operation failed; retry is safe' }, { status: 500 });
}
