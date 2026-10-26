import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { api, setOnUnauthorized, setToken } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

type User = { id: string; email: string; name?: string };
type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, mode: "login" | "register", name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({} as Ctx);
const TOKEN_KEY = "auth_token";

async function syncTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) await api("/settings", { method: "PUT", body: { tz } }).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setToken(null);
    await storage.secureRemove(TOKEN_KEY);
    queryClient.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      signOut();
    });
    (async () => {
      const t = await storage.secureGet(TOKEN_KEY, null as string | null);
      if (t) {
        setToken(t);
        try {
          setUser(await api<User>("/auth/me"));
          syncTimezone();
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string, mode: "login" | "register", name?: string) => {
    const res = await api<{ token: string; user: User }>(`/auth/${mode}`, { method: "POST", body: { email, password, name } });
    setToken(res.token);
    await storage.secureSet(TOKEN_KEY, res.token);
    await syncTimezone();
    setUser(res.user);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
