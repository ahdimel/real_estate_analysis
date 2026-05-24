"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

type Step = "form" | "verify";

export default function RegisterPage() {
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Registration failed");
        return;
      }
      setStep("verify");
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Verification failed");
        return;
      }
      login(data.access_token);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.detail ?? "Could not resend code");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-sm">

        {step === "form" && (
          <>
            <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Create account</h1>
            <p className="text-sm text-zinc-400 mb-6">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link>
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Username</label>
                <input type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Email</label>
                <input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Password</label>
                <input type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={inputClass} />
                <p className="text-xs text-zinc-500 mt-1">Minimum 8 characters</p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {loading ? "Sending code…" : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {step === "verify" && (
          <>
            <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Check your email</h1>
            <p className="text-sm text-zinc-400 mb-6">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-zinc-200">{email}</span>.
              It expires in 15 minutes.
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">
                  Verification code
                </label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  required autoFocus value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {loading ? "Verifying…" : "Verify and create account"}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2">
              <button onClick={() => { setStep("form"); setError(""); }}
                className="text-sm text-zinc-400 hover:text-zinc-200">
                ← Change email or username
              </button>
              <button onClick={handleResend} disabled={loading}
                className="text-sm text-blue-400 hover:underline disabled:opacity-50">
                Resend code
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
