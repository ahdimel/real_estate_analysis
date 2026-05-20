"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface Property {
  id: number;
  address_street: string;
  address_city: string;
  address_state: string;
  property_type: string;
  purchase_price: number;
  bedrooms: number;
  bathrooms: number;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  single_family: "Single Family",
  multi_family: "Multi-Family",
  condo: "Condo",
  townhouse: "Townhouse",
};

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { token, username, logout } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);

  useEffect(() => {
    if (!token) {
      const stored = localStorage.getItem("rei_token");
      if (!stored) { router.push("/login"); return; }
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/properties", {}, token)
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setLoadingProps(false));
  }, [token]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-900">REI</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-800">{username}</span>
          </span>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">My Properties</h1>
          <Link
            href="/properties/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add property
          </Link>
        </div>

        {loadingProps ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : properties.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center">
            <p className="text-zinc-400 text-sm">No properties yet.</p>
            <Link
              href="/properties/new"
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + Add property
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {properties.map((p) => (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900">{p.address_street}</p>
                  <p className="text-sm text-zinc-500">{p.address_city}, {p.address_state}</p>
                  <div className="flex gap-3 mt-1 text-xs text-zinc-400">
                    <span>{TYPE_LABELS[p.property_type] ?? p.property_type}</span>
                    <span>·</span>
                    <span>{p.bedrooms} bd / {p.bathrooms} ba</span>
                    <span>·</span>
                    <span>{formatCurrency(p.purchase_price)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/properties/${p.id}/edit`)}
                    className="text-sm px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    className="text-sm px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-400 cursor-not-allowed"
                    disabled
                    title="Coming soon"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
