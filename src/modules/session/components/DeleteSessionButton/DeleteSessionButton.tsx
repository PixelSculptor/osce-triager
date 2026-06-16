'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useModal } from '@/shared/hooks/useModal';
import { ConfirmModal } from '@/shared/components/ConfirmModal/ConfirmModal';
import { deleteSessionAction } from '@/modules/session/actions';
import styles from './DeleteSessionButton.module.css';

interface DeleteSessionButtonProps {
  sessionId: string;
  scenarioTitle: string;
  completedAt: Date;
}

export function DeleteSessionButton({
  sessionId,
  scenarioTitle,
  completedAt,
}: DeleteSessionButtonProps) {
  const { isOpen, open, close } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteSessionAction(sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        close();
      }
    });
  }

  function handleCancel() {
    setError(null);
    close();
  }

  return (
    <>
      <button
        type='button'
        aria-label='Usuń sesję'
        onClick={open}
        className={styles.deleteButton}
      >
        <Trash2 size={16} aria-hidden='true' />
      </button>
      <ConfirmModal
        isOpen={isOpen}
        title={`Usuń „${scenarioTitle}"`}
        message={`Sesja z dnia ${completedAt.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })} zostanie trwale usunięta.`}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isPending={isPending}
        errorMessage={error ?? undefined}
      />
    </>
  );
}
