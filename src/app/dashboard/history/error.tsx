'use client';

import { ErrorState } from '@/shared/components/ErrorState/ErrorState';

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
