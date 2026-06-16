'use client';

import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  errorMessage?: string;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  onConfirm,
  onCancel,
  isPending = false,
  errorMessage,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div
        role='dialog'
        aria-modal='true'
        className={styles.dialog}
        aria-labelledby='modal-title'
      >
        <h2 id='modal-title' className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        <div className={styles.actions}>
          <button
            type='button'
            onClick={onCancel}
            disabled={isPending}
            className={styles.cancelButton}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isPending}
            className={styles.confirmButton}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
