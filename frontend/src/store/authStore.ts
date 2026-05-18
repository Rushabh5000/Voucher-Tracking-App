import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token:    string | null;
  username: string | null;
  role:     "admin" | "user" | "guest" | null;
  guestExpiresAt: string | null;  // ISO string
  login:    (token: string, username: string, role: "admin" | "user" | "guest", guestExpiresAt?: string) => void;
  logout:   () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:          null,
      username:       null,
      role:           null,
      guestExpiresAt: null,
      login:  (token, username, role, guestExpiresAt) =>
        set({ token, username, role, guestExpiresAt: guestExpiresAt ?? null }),
      logout: () => set({ token: null, username: null, role: null, guestExpiresAt: null }),
    }),
    { name: "vt-auth" }
  )
);
