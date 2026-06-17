'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { auth } from '@/modules/auth/auth';
import { db } from '@/shared/lib/db';
import { users } from '@/shared/lib/schema';

export type AccountActionState = { error?: string; success?: boolean } | null;

export async function requestDeletionAction(
  prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error('[requestDeletionAction] auth() threw:', e);
    return { error: 'Internal error' };
  }
  if (!session?.user?.id) return { error: 'Unauthorized' };

  if (formData.get('confirmation') !== 'DELETE') {
    return { error: 'Wpisz DELETE aby potwierdzić' };
  }

  await db
    .update(users)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(users.id, session.user.id));

  revalidatePath('/account/settings');
  return { success: true };
}

export async function cancelDeletionAction(): Promise<void> {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error('[cancelDeletionAction] auth() threw:', e);
    return;
  }
  if (!session?.user?.id) return;

  await db
    .update(users)
    .set({ deletionRequestedAt: null })
    .where(eq(users.id, session.user.id));

  revalidatePath('/account/settings');
}
