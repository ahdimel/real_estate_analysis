"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface AuthContextType {
  token: string | null;
  username: string | null;
  login: (token: string) => void;
  logout: () => void;
  fetchWithAuth: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseUsername(token: string): string | null {
  try {
    return JSON.parse(atob(token.split(".")[1])).username ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("rei_token");
    if (stored) {
      setToken(stored);
      setUsername(parseUsername(stored));
    }
  }, []);

  function login(newToken: string) {
    localStorage.setItem("rei_token", newToken);
    setToken(newToken);
    setUsername(parseUsername(newToken));
    router.push("/dashboard");
  }

  function logout() {
    const storedToken = localStorage.getItem("rei_token");
    if (storedToken) {
      apiFetch("/auth/logout", { method: "POST" }, storedToken).catch(() => {});
    }
    localStorage.removeItem("rei_token");
    setToken(null);
    setUsername(null);
    router.push("/login");
  }

  async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const storedToken = localStorage.getItem("rei_token");
    const res = await apiFetch(path, options, storedToken ?? undefined);
    if (res.status !== 401) return res;

    const refreshRes = await apiFetch("/auth/refresh", { method: "POST" }, storedToken ?? undefined);
    if (!refreshRes.ok) {
      logout();
      return res;
    }

    const { access_token: newToken } = (await refreshRes.json()) as { access_token: string };
    localStorage.setItem("rei_token", newToken);
    setToken(newToken);
    setUsername(parseUsername(newToken));
    return apiFetch(path, options, newToken);
  }

  return (
    <AuthContext.Provider value={{ token, username, login, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
