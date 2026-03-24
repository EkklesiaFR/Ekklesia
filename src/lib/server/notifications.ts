import { getAdminDb } from '@/lib/firebase/admin';

type BaseNotificationParams = {
  assemblyId: string;
  voteId?: string;
  voteTitle?: string;
};

const BATCH_LIMIT = 450;

async function getActiveMemberIds(): Promise<string[]> {
  const db = getAdminDb();

  const membersSnap = await db
    .collection('members')
    .where('status', '==', 'active')
    .get();

  if (membersSnap.empty) {
    return [];
  }

  return membersSnap.docs.map((docSnap) => docSnap.id);
}

async function sendNotificationsToActiveMembers(
  payloadBuilder: (uid: string) => Record<string, unknown>
) {
  const db = getAdminDb();
  const memberIds = await getActiveMemberIds();

  if (memberIds.length === 0) {
    console.warn('[NOTIFICATIONS] No active members found');
    return;
  }

  let batch = db.batch();
  let opCount = 0;

  for (const uid of memberIds) {
    const notifRef = db
      .collection('members')
      .doc(uid)
      .collection('notifications')
      .doc();

    batch.set(notifRef, payloadBuilder(uid));
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
}

export async function sendVoteLockedNotifications({
  assemblyId,
  voteId,
  voteTitle,
}: BaseNotificationParams) {
  const now = new Date();

  await sendNotificationsToActiveMembers(() => ({
    type: 'vote_locked',
    title: 'Vote terminé',
    body: voteTitle
      ? `Le vote "${voteTitle}" est terminé.`
      : 'Un vote a été clôturé.',
    read: false,
    createdAt: now,
    assemblyId,
    voteId: voteId ?? null,
    link: '/assembly',
  }));

  console.log('[NOTIFICATIONS] vote_locked sent');
}

export async function sendVoteCreatedNotifications({
  assemblyId,
  voteId,
  voteTitle,
}: BaseNotificationParams) {
  const now = new Date();

  await sendNotificationsToActiveMembers(() => ({
    type: 'vote_created',
    title: 'Nouveau vote disponible',
    body: voteTitle
      ? `Le vote "${voteTitle}" est maintenant disponible.`
      : 'Une nouvelle session de vote est ouverte.',
    read: false,
    createdAt: now,
    assemblyId,
    voteId: voteId ?? null,
    link: '/assembly',
  }));

  console.log('[NOTIFICATIONS] vote_created sent');
}