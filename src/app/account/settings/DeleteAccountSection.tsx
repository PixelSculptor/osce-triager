'use client';

import { useActionState, useState } from 'react';
import {
  requestDeletionAction,
  type AccountActionState,
} from '@/modules/account/actions';
import { Button } from '@/shared/components/Button/Button';
import styles from './DeleteAccountSection.module.css';

export function DeleteAccountSection() {
  const [inputValue, setInputValue] = useState('');
  const [state, formAction] = useActionState<AccountActionState, FormData>(
    requestDeletionAction,
    null,
  );

  const isConfirmed = inputValue === 'DELETE';

  return (
    <section className={styles.section}>
      <h2>Usuń konto</h2>
      <p className={styles.description}>
        Twoje konto zostanie trwale usunięte po 30 dniach. W tym czasie możesz
        anulować żądanie.
      </p>
      <form action={formAction}>
        <div className={styles.fieldGroup}>
          <label htmlFor='confirmation' className={styles.label}>
            Wpisz <strong>DELETE</strong> aby potwierdzić:
          </label>
          <input
            id='confirmation'
            name='confirmation'
            type='text'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className={styles.input}
          />
        </div>
        {state?.error && <p className={styles.errorMsg}>{state.error}</p>}
        {state?.success && (
          <p className={styles.successMsg}>
            Żądanie usunięcia zostało zgłoszone.
          </p>
        )}
        <Button type='submit' variant='danger' disabled={!isConfirmed}>
          Usuń konto
        </Button>
      </form>
    </section>
  );
}
