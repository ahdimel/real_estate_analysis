"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { ReportSnapshot } from "@/components/ReportPDF";

const PROPERTY_LIMIT = 10;
const CREDIT_LIMIT = 10;

interface Property {
  id: number;
  address_street: string;
  address_city: string;
  address_state: string;
  property_type: string;
  purchase_price: number;
  bedrooms: number | null;
  bathrooms: number | null;
}

interface ReportSummary {
  id: number;
  public_id: string;
  property_id: number | null;
  property_name: string;
  generated_at: string;
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { token, username, logout, fetchWithAuth } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Report state
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [redownloading, setRedownloading] = useState<Set<string>>(new Set());
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    if (!token) {
      const stored = localStorage.getItem("rei_token");
      if (!stored) { router.push("/login"); return; }
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    fetchWithAuth("/properties")
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setLoadingProps(false));

    fetchWithAuth("/reports")
      .then((r) => r.json())
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  }, [token]);

  async function handleDelete(id: number) {
    if (!token) return;
    await fetchWithAuth(`/properties/${id}`, { method: "DELETE" });
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  }

  async function handleRedownload(publicId: string, generatedAt: string) {
    setRedownloading((prev) => new Set(prev).add(publicId));
    setReportError("");
    try {
      const res = await fetchWithAuth(`/reports/${publicId}`);
      if (!res.ok) { setReportError("Could not fetch report."); return; }
      const report = await res.json();

      const [{ pdf }, { ReportDocument }, React] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/ReportPDF"),
        import("react"),
      ]);

      const doc = React.createElement(ReportDocument, {
        snapshot: report.snapshot as ReportSnapshot,
        chartImageUrl: "",
        reportId: publicId,
        generatedAt: fmtDate(generatedAt),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rei-report-${publicId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setReportError("Failed to download report.");
    } finally {
      setRedownloading((prev) => { const s = new Set(prev); s.delete(publicId); return s; });
    }
  }

  if (!token) return null;

  const atLimit = properties.length >= PROPERTY_LIMIT;
  const reportsUsed = reports.length;

  return (
    <div className="min-h-screen bg-zinc-900">
      <nav className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-100">REIA</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Signed in as <span className="font-medium text-zinc-200">{username}</span>
          </span>
          <button onClick={logout} className="text-sm text-red-400 hover:underline">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* ── Reports section ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Analysis History</h2>
            <span className="text-xs text-zinc-500">
              {loadingReports ? "…" : `${reportsUsed} / ${CREDIT_LIMIT} credits used`}
            </span>
          </div>

          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
            {reportError && (
              <p className="text-xs text-red-400 mb-3">{reportError}</p>
            )}
            {loadingReports ? (
              <p className="text-sm text-zinc-500">Loading reports…</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No analyses run yet. Visit a property and click "Run Analysis" to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.public_id} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-mono font-medium text-zinc-200 shrink-0">{r.public_id}</span>
                      <span className="text-xs text-zinc-400 truncate">{r.property_name}</span>
                      <span className="text-xs text-zinc-600 shrink-0">{fmtDate(r.generated_at)}</span>
                    </div>
                    <button
                      onClick={() => handleRedownload(r.public_id, r.generated_at)}
                      disabled={redownloading.has(r.public_id)}
                      className="text-xs px-3 py-1 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors shrink-0 ml-3"
                    >
                      {redownloading.has(r.public_id) ? "Downloading…" : "↓ Re-download"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Properties section ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">My Properties</h1>
              {!loadingProps && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  {properties.length} / {PROPERTY_LIMIT} properties
                </p>
              )}
            </div>
            {atLimit ? (
              <span className="text-sm text-zinc-500 border border-zinc-700 px-4 py-2 rounded-lg">
                Limit reached
              </span>
            ) : (
              <Link
                href="/properties/new"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Add property
              </Link>
            )}
          </div>

          {loadingProps ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : properties.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-12 text-center">
              <p className="text-zinc-500 text-sm">No properties yet.</p>
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
                <div key={p.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-100">{p.address_street}</p>
                    <p className="text-sm text-zinc-400">{p.address_city}, {p.address_state}</p>
                    <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                      <span>{TYPE_LABELS[p.property_type] ?? p.property_type}</span>
                      {(p.bedrooms != null || p.bathrooms != null) && (
                        <>
                          <span>·</span>
                          <span>{p.bedrooms ?? "—"} bd / {p.bathrooms ?? "—"} ba</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatCurrency(p.purchase_price)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {confirmDeleteId === p.id ? (
                      <>
                        <span className="text-xs text-zinc-400 mr-1">Delete this property?</span>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-sm px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-sm px-3 py-1.5 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => router.push(`/properties/${p.id}/edit`)}
                          className="text-sm px-3 py-1.5 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => router.push(`/properties/${p.id}/analysis`)}
                          className="text-sm px-3 py-1.5 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          Analyze
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="text-sm px-3 py-1.5 border border-red-800 rounded-lg text-red-400 hover:bg-red-950 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
