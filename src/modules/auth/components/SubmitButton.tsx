'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonVariant } from '@/shared/components/Button/Button';
import { Spinner } from '@/shared/components/Spinner/Spinner';

interface SubmitButtonProps {
  children: React.ReactNode;
  loadingLabel?: string;
  variant?: ButtonVariant;
}

export function SubmitButton({
  children,
  loadingLabel,
  variant = 'primary',
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' variant={variant} disabled={pending}>
      {pending ? (
        <>
          <Spinner size='sm' />
          {loadingLabel ?? 'Proszę czekać…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
