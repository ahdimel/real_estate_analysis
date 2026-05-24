"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import PropertyForm from "@/components/PropertyForm";

export default function NewPropertyPage() {
  const { token } = useAuth();
  const router = useRouter();

  async function handleSubmit(payload: object) {
    if (!token) { router.push("/login"); return; }
    const res = await apiFetch("/properties", { method: "POST", body: JSON.stringify(payload) }, token);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Failed to save property");
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <nav className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-100">REI</span>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back to dashboard
        </button>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Add property</h1>
        <PropertyForm onSubmit={handleSubmit} onCancel={() => router.push("/dashboard")} />
      </main>
    </div>
  );
}
