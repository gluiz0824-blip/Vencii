"use client";

import { ErrorState } from "@/components/product/error-state";

export default function AppError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="app-page py-12">
      <ErrorState onRetry={unstable_retry} />
    </div>
  );
}
