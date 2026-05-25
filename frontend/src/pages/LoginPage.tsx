import { useState, FormEvent } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/client";

interface Props {
  onShowRegister: () => void;
}

export function LoginPage({ onShowRegister }: Props) {
  const { login } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await authApi.login(username, password);
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Invalid credentials"); return; }
      login(data.token, data.username, data.role);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError("");
    setLoading(true);
    try {
      const res  = await authApi.guest();
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Could not start guest session"); return; }
      login(data.token, data.username, "guest", data.expiresAt);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎫</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Voucher Tracker</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to access your vouchers</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label className="label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleGuest}
              className="btn-secondary w-full justify-center py-2 text-sm"
            >
              {loading ? "…" : "Continue as Guest"}
            </button>

            <p className="text-center text-xs text-gray-400 mt-1">
              New here?{" "}
              <button
                type="button"
                onClick={onShowRegister}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Guest sessions expire after 2 hours and all data is deleted.
        </p>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <span className="mt-px shrink-0">⏱</span>
          <span>
            <span className="font-medium">First load may take up to 60 seconds.</span>
            {" "}The backend spins down when idle — it wakes up automatically on your first request.
          </span>
        </div>
      </div>
    </div>
  );
}
