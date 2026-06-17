'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/components/Button/Button';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  message?: string;
}

export function ErrorState({ error, reset, message }: ErrorStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.container} role='alert'>
      <h1 className={styles.heading}>Coś poszło nie tak</h1>
      <p className={styles.message}>
        {message ??
          'Nie udało się załadować danych. Spróbuj ponownie za chwilę.'}
      </p>
      <Button variant='primary' onClick={reset}>
        Spróbuj ponownie
      </Button>
    </main>
  );
}
