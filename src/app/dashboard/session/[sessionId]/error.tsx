'use client';

import { ErrorState } from '@/shared/components/ErrorState/ErrorState';

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
