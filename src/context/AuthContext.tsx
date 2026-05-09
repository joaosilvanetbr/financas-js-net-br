import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi } from "../lib/api-client";

export type AuthUser = {
  id: string;
  username: string;
  display_name?: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  recoveryMode: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signUp: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  recoveryMode: false,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .refresh()
      .then((data: any) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem("token");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username: string, password: string) {
    const data: any = await authApi.login(username, password);
    if (data?.error) return { error: data.error };
    if (data?.token) {
      localStorage.setItem("token", data.token);
      setUser(data.user);
      return {};
    }
    return { error: "Resposta invalida do servidor" };
  }

  async function signUp(username: string, password: string) {
    const data: any = await authApi.register(username, password);
    if (data?.error) return { error: data.error };
    if (data?.token) {
      localStorage.setItem("token", data.token);
      setUser(data.user);
      return {};
    }
    return { error: "Resposta invalida do servidor" };
  }

  function signOut() {
    localStorage.removeItem("token");
    setUser(null);
    window.location.reload();
  }

  return (
    <AuthContext.Provider value={{ user, loading, recoveryMode, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
