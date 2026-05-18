import { useState, FormEvent } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/client";

interface Props {
  onShowLogin: () => void;
}

export function RegisterPage({ onShowLogin }: Props) {
  const { login } = useAuthStore();

  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm)  { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res  = await authApi.register(username, password);
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Registration failed"); return; }
      login(data.token, data.username, data.role);
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">Start tracking your vouchers</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label className="label" htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                minLength={3}
                maxLength={30}
              />
            </div>

            <div>
              <label className="label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="label" htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                className="input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onShowLogin}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
