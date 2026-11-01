import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, currentServer, loadSession, saveServer, saveSession, setUnauthorizedHandler, type User } from "./api";

type Auth = {
  ready: boolean;
  user: User | null;
  server: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changeServer: (url: string) => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [server, setServer] = useState(currentServer());

  useEffect(() => {
    loadSession().then((s) => {
      setUser(s.token ? s.user : null);
      setServer(s.server);
      setReady(true);
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(() => { signOut(); }), [signOut]);

  const value = useMemo<Auth>(() => ({
    ready, user, server, signOut,
    async signIn(email, password) {
      const r = await api<{ token: string; role: string; pseudonym: string | null }>("/auth/login", {
        method: "POST", body: { email: email.trim(), password },
      });
      if (r.role !== "student" || !r.pseudonym) throw new Error("This app is for students. Staff use the dashboard.");
      const u = { pseudonym: r.pseudonym, email: email.trim() };
      await saveSession(r.token, u);
      setUser(u);
    },
    async changeServer(url) {
      await saveServer(url);
      setServer(currentServer());
    },
  }), [ready, user, server, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
};
