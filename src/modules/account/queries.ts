import 'server-only';

import { getDb } from '@/shared/lib/db';

export async function getAccountSettings(userId: string) {
  const db = getDb();
  return db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      deletionRequestedAt: true,
    },
  });
}
