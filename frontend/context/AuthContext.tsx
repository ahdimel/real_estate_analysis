"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  token: string | null;
  username: string | null;
  login: (token: string) => void;
  logout: () => void;
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
    localStorage.removeItem("rei_token");
    setToken(null);
    setUsername(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
