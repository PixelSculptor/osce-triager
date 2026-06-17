import 'server-only';

import { db } from '@/shared/lib/db';

export async function getAccountSettings(userId: string) {
  try {
    return await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
        deletionRequestedAt: true,
      },
    });
  } catch (e) {
    console.error('[getAccountSettings] DB error:', e);
    throw e;
  }
}
