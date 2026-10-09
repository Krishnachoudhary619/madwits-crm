"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { sessionApi } from "@/lib/api/endpoints";
import type { UserPublic } from "@/types/api";

const AuthContext = createContext<{
  user: UserPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: UserPublic | null) => void;
}>({ user: null, loading: true, refresh: async () => undefined, setUser: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setUser(await sessionApi.me());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
