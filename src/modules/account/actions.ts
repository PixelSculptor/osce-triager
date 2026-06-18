'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { auth } from '@/modules/auth/auth';
import { getDb } from '@/shared/lib/db';
import { users } from '@/shared/lib/schema';

export type AccountActionState = { error?: string; success?: boolean } | null;

export async function requestDeletionAction(
  prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  if (formData.get('confirmation') !== 'DELETE') {
    return { error: 'Wpisz DELETE aby potwierdzić' };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(users.id, session.user.id));

  revalidatePath('/account/settings');
  return { success: true };
}

export async function cancelDeletionAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const db = getDb();
  await db
    .update(users)
    .set({ deletionRequestedAt: null })
    .where(eq(users.id, session.user.id));

  revalidatePath('/account/settings');
}
