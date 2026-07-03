interface ConnectionGateProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Shown before the first successful data load. Prevents the app from rendering
 * misleading empty/zero state while the (free-tier) backend is waking from hibernation
 * or is unreachable.
 */
export function ConnectionGate({ loading, error, onRetry }: ConnectionGateProps) {
  // While a request (incl. its automatic retries) is in flight, show a waking-up state.
  if (loading || !error) {
    return (
      <div className="card p-10 text-center max-w-md mx-auto mt-10">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Connecting to the server…</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The server sleeps after a period of inactivity. The first load can take up to a minute
          while it wakes up — hang tight, your data is on its way.
        </p>
      </div>
    );
  }

  // Retries exhausted — surface a real error with a manual retry, never fake "0 vouchers".
  return (
    <div className="card p-10 text-center max-w-md mx-auto mt-10">
      <div className="text-4xl mb-3">📡</div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Couldn’t reach the server</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        We couldn’t load your vouchers. The server may still be starting up, or your connection
        dropped. Your data is safe — nothing here is empty because it was deleted.
      </p>
      <button className="btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}
