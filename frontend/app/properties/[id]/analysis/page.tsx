"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import type { ReportSnapshot } from "@/components/ReportPDF";

// ── Types ────────────────────────────────────────────────────────────────────

interface YearRow {
  year: number;
  gross_rent: number;
  effective_rent: number;
  mortgage_payment: number;
  property_tax: number;
  hoa: number;
  management: number;
  maintenance: number;
  insurance: number;
  pmi: number;
  total_expenses: number;
  net_cash_flow: number;
  cumulative_cash_flow: number;
  property_value: number;
  loan_balance: number;
  equity: number;
  equity_gain: number;
  re_value: number;
  cumulative_roi_pct: number;
  stock_value: number;
}

interface ScenarioSummary {
  monthly_cash_flow_y1: number;
  annual_cash_flow_y1: number;
  coc_return: number;
  break_even_year: number | null;
}

interface AnalysisData {
  property_id: number;
  initial_investment: number;
  loan_amount: number;
  monthly_mortgage: number;
  cap_rate_mid: number;
  grm_mid: number;
  market_cagr_pct: number;
  market_label: string;
  summary_low: ScenarioSummary;
  summary_mid: ScenarioSummary;
  summary_high: ScenarioSummary;
  projections_low: YearRow[];
  projections_mid: YearRow[];
  projections_high: YearRow[];
}

interface PropertyData {
  purchase_price: number;
  annual_interest_rate: number;
  rent_lower: number;
  rent_upper: number;
  [key: string]: unknown;
}

interface AnalysisSnapshot {
  id: number;
  public_id: string;
  property_id: number | null;
  property_name: string;
  generated_at: string;
  snapshot: { property: PropertyData; analysis: AnalysisData };
}

interface ReportSummary {
  id: number;
  public_id: string;
  property_id: number | null;
  property_name: string;
  generated_at: string;
}

type Scenario = "low" | "mid" | "high";

// ── Formatters ───────────────────────────────────────────────────────────────

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(2)}%`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ScenarioCell({ value, isNeg }: { value: string; isNeg?: boolean }) {
  return (
    <td className={`px-4 py-2 text-sm text-right font-medium ${isNeg ? "text-red-400" : "text-green-400"}`}>
      {value}
    </td>
  );
}

function cfColor(n: number) {
  return n < 0 ? "text-red-400" : "text-green-400";
}

// ── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows: YearRow[], scenario: Scenario, address: string) {
  const headers = [
    "Year", "Gross Rent", "Effective Rent", "Mortgage", "Property Tax",
    "HOA", "Management", "Maintenance", "Insurance", "PMI", "Total Expenses",
    "Net Cash Flow", "Cumulative CF", "Property Value", "Loan Balance",
    "Equity", "Equity Gain", "RE Value", "Cumulative ROI %", "Stock Value",
  ];
  const lines = rows.map((r) => [
    r.year, r.gross_rent, r.effective_rent, r.mortgage_payment, r.property_tax,
    r.hoa, r.management, r.maintenance, r.insurance, r.pmi, r.total_expenses,
    r.net_cash_flow, r.cumulative_cash_flow, r.property_value, r.loan_balance,
    r.equity, r.equity_gain, r.re_value, r.cumulative_roi_pct, r.stock_value,
  ]);
  const csv = [headers, ...lines].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${address.replace(/\s+/g, "_")}_${scenario}_analysis.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Chart capture (returns base64 data URL) ──────────────────────────────────

// Maps dark-theme SVG colors to their print-friendly equivalents.
const PRINT_COLOR_MAP: Record<string, string> = {
  "#18181b": "#ffffff",
  "#27272a": "#ffffff",
  "#3f3f46": "#d4d4d8",  // grid lines → light grey
  "#232326": "#f9fafb",
  "#a1a1aa": "#52525b",  // axis tick labels → readable grey
  "#71717a": "#52525b",
};

function remapSvgForPrint(el: Element): void {
  for (const attr of ["fill", "stroke"] as const) {
    const val = el.getAttribute(attr);
    if (val) {
      const mapped = PRINT_COLOR_MAP[val.toLowerCase()];
      if (mapped) el.setAttribute(attr, mapped);
    }
  }
  for (const child of Array.from(el.children)) remapSvgForPrint(child);
}

function captureChartToDataUrl(chartEl: HTMLDivElement, forPrint = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const allSvgs = Array.from(chartEl.querySelectorAll("svg"));
    const mainSvg = allSvgs.reduce<SVGSVGElement | null>((best, svg) => {
      const r = svg.getBoundingClientRect();
      const bestR = best?.getBoundingClientRect();
      return !best || r.width * r.height > (bestR?.width ?? 0) * (bestR?.height ?? 0)
        ? svg as SVGSVGElement : best;
    }, null);
    if (!mainSvg) { reject(new Error("No chart SVG found")); return; }

    const { width, height } = mainSvg.getBoundingClientRect();
    const clone = mainSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

    if (forPrint) remapSvgForPrint(clone);

    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" })
    );
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = forPrint ? "#ffffff" : "#27272a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Chart image failed to load")); };
    img.src = url;
  });
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { token, fetchWithAuth } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [currentSnapshot, setCurrentSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [address, setAddress] = useState("Property");
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState<Scenario>("mid");
  const chartRef = useRef<HTMLDivElement>(null);

  // Credit + history state
  const [creditCount, setCreditCount] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [redownloading, setRedownloading] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token || !id) return;

    fetchWithAuth(`/properties/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setProperty(p);
        setAddress(`${p.address_street}, ${p.address_city}`);
      });

    fetchWithAuth(`/properties/${id}/analysis`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((d) => {
        if (d && !d.detail) {
          setCurrentSnapshot(d as AnalysisSnapshot);
          setData((d as AnalysisSnapshot).snapshot.analysis);
        }
      })
      .catch(() => setError("Failed to load analysis."))
      .finally(() => setLoadingAnalysis(false));

    fetchWithAuth(`/properties/${id}/reports`)
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d) ? d : []));

    fetchWithAuth("/reports/count")
      .then((r) => r.json())
      .then((d) => setCreditCount(d));
  }, [token, id]);

  // ── PDF download helper ────────────────────────────────────────────────────

  async function triggerPDFDownload(snapshot: ReportSnapshot, reportId: string, generatedAt: string) {
    const chartUrl = chartRef.current
      ? await captureChartToDataUrl(chartRef.current, true)
      : "";

    const [{ pdf }, { ReportDocument }, React] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/ReportPDF"),
      import("react"),
    ]);

    const doc = React.createElement(ReportDocument, { snapshot, chartImageUrl: chartUrl, reportId, generatedAt });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rei-report-${reportId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Run analysis (costs 1 credit) ─────────────────────────────────────────

  async function handleRunAnalysis() {
    if (!token || !id) return;
    setRunning(true);
    setRunError("");
    try {
      const res = await fetchWithAuth(`/properties/${id}/analysis`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setRunError(body.detail ?? "Failed to run analysis.");
        return;
      }
      const { report, remaining } = await res.json();
      setCurrentSnapshot(report as AnalysisSnapshot);
      setData((report as AnalysisSnapshot).snapshot.analysis);
      setHistory((prev) => [report, ...prev]);
      setCreditCount((prev) => prev ? { ...prev, used: prev.used + 1, remaining } : null);
    } catch {
      setRunError("Failed to run analysis.");
    } finally {
      setRunning(false);
    }
  }

  // ── Download PDF for current snapshot ────────────────────────────────────

  async function handleDownloadCurrentPDF() {
    if (!currentSnapshot) return;
    setDownloadingPdf(true);
    try {
      await triggerPDFDownload(
        currentSnapshot.snapshot as unknown as ReportSnapshot,
        currentSnapshot.public_id,
        fmtDate(currentSnapshot.generated_at),
      );
    } catch {
      // silently fail — PDF download is best-effort
    } finally {
      setDownloadingPdf(false);
    }
  }

  // ── Re-download PDF from history ──────────────────────────────────────────

  async function handleRedownload(publicId: string, generatedAt: string) {
    setRedownloading((prev) => new Set(prev).add(publicId));
    try {
      const res = await fetchWithAuth(`/reports/${publicId}`);
      if (!res.ok) { setRunError("Could not fetch snapshot."); return; }
      const report = await res.json();
      await triggerPDFDownload(report.snapshot as ReportSnapshot, publicId, fmtDate(generatedAt));
    } catch {
      setRunError("Failed to download PDF.");
    } finally {
      setRedownloading((prev) => { const s = new Set(prev); s.delete(publicId); return s; });
    }
  }

  // ── Chart export (JPG) ────────────────────────────────────────────────────

  function exportChart() {
    if (!chartRef.current) return;
    captureChartToDataUrl(chartRef.current).then((dataUrl) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${address.replace(/\s+/g, "_")}_${scenario}_chart.jpg`;
      a.click();
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const projections = data
    ? (scenario === "low" ? data.projections_low
      : scenario === "high" ? data.projections_high
      : data.projections_mid)
    : [];

  const summaries: Record<Scenario, ScenarioSummary | null> = {
    low: data?.summary_low ?? null,
    mid: data?.summary_mid ?? null,
    high: data?.summary_high ?? null,
  };

  const atCreditLimit = creditCount !== null && creditCount.remaining <= 0;

  // Detect if current property inputs differ from the most recent analysis snapshot
  const paramsChanged = currentSnapshot && property && (() => {
    const sp = currentSnapshot.snapshot?.property;
    if (!sp) return false;
    return (
      sp.purchase_price !== property.purchase_price ||
      sp.annual_interest_rate !== property.annual_interest_rate ||
      sp.rent_lower !== property.rent_lower ||
      sp.rent_upper !== property.rent_upper
    );
  })();

  const noAnalysisYet = !loadingAnalysis && !data;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <p className="text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Nav */}
      <nav className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-100">REI</span>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back to dashboard
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">{address}</h1>
          <p className="text-sm text-zinc-400 mt-1">Rental investment analysis · 30-year projection</p>
        </div>

        {/* ── Analysis actions bar ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Analysis</h2>
            {creditCount && (
              <span className="text-xs text-zinc-500">
                {creditCount.used} / {creditCount.limit} credits used
              </span>
            )}
          </div>

          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">

            {/* Params-changed warning */}
            {paramsChanged && currentSnapshot && (
              <div className="flex items-start gap-2 bg-amber-950 border border-amber-800 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-sm">⚠</span>
                <p className="text-xs text-amber-300">
                  Property inputs have changed since the last analysis ({fmtDate(currentSnapshot.generated_at)}).
                  Results below reflect the previous inputs. Re-run to update.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleRunAnalysis}
                disabled={running || atCreditLimit}
                className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {running
                  ? "Running…"
                  : atCreditLimit
                  ? "No credits remaining"
                  : noAnalysisYet
                  ? `Run Analysis — 1 credit (${creditCount?.remaining ?? "…"} remaining)`
                  : `Re-run Analysis — 1 credit (${creditCount?.remaining ?? "…"} remaining)`}
              </button>

              {data && currentSnapshot && (
                <button
                  onClick={handleDownloadCurrentPDF}
                  disabled={downloadingPdf}
                  className="text-sm px-4 py-2 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {downloadingPdf ? "Generating PDF…" : "↓ Download PDF"}
                </button>
              )}

              {atCreditLimit && (
                <p className="text-xs text-zinc-500">Lifetime limit of {creditCount?.limit} reached.</p>
              )}
            </div>

            {runError && <p className="text-xs text-red-400">{runError}</p>}

            {/* Analysis history */}
            {history.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Previous runs</p>
                <div className="space-y-2">
                  {history.map((r) => (
                    <div key={r.public_id} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-mono font-medium text-zinc-200">{r.public_id}</span>
                        <span className="text-xs text-zinc-500 ml-3">{fmtDate(r.generated_at)}</span>
                      </div>
                      <button
                        onClick={() => handleRedownload(r.public_id, r.generated_at)}
                        disabled={redownloading.has(r.public_id)}
                        className="text-xs px-3 py-1 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        {redownloading.has(r.public_id) ? "Downloading…" : "↓ PDF"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* No analysis yet placeholder */}
        {noAnalysisYet && (
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-16 text-center">
            <p className="text-zinc-400 text-sm mb-1">No analysis run yet for this property.</p>
            <p className="text-zinc-600 text-xs">Click "Run Analysis" above to generate your 30-year projection.</p>
          </div>
        )}

        {/* Loading placeholder */}
        {loadingAnalysis && (
          <div className="min-h-[200px] flex items-center justify-center">
            <p className="text-zinc-500 text-sm">Loading…</p>
          </div>
        )}

        {/* ── Results (only shown when analysis exists) ─────────────────────── */}
        {data && (
          <>
            {/* Summary metrics */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <MetricCard label="Initial Investment" value={usd(data.initial_investment)} />
                <MetricCard label="Loan Amount" value={usd(data.loan_amount)} />
                <MetricCard label="Monthly Mortgage" value={usd(data.monthly_mortgage)} />
              </div>
            </section>

            {/* Scenario comparison */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Scenario Comparison</h2>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-700">
                      <th className="px-4 py-2 text-left text-zinc-300 font-medium">Metric</th>
                      <th className="px-4 py-2 text-right text-zinc-300 font-medium">Low rent</th>
                      <th className="px-4 py-2 text-right text-zinc-300 font-medium">Mid rent</th>
                      <th className="px-4 py-2 text-right text-zinc-300 font-medium">High rent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["Monthly CF (Yr 1)", "Annual CF (Yr 1)", "CoC Return", "Break-even", "Total out-of-pocket (30yr)"] as const).map((label, i) => {
                      const vals = (["low", "mid", "high"] as Scenario[]).map((s) => {
                        const sm = summaries[s]!;
                        const proj = s === "low" ? data.projections_low : s === "high" ? data.projections_high : data.projections_mid;
                        if (i === 0) return { str: usd(sm.monthly_cash_flow_y1), neg: sm.monthly_cash_flow_y1 < 0 };
                        if (i === 1) return { str: usd(sm.annual_cash_flow_y1), neg: sm.annual_cash_flow_y1 < 0 };
                        if (i === 2) return { str: pct(sm.coc_return), neg: sm.coc_return < 0 };
                        if (i === 3) return { str: sm.break_even_year ? `Year ${sm.break_even_year}` : "Never", neg: !sm.break_even_year };
                        const shortfalls = proj.reduce((sum, r) => sum + Math.min(0, r.net_cash_flow), 0);
                        const total = data.initial_investment + Math.abs(shortfalls);
                        return { str: usd(total), neg: shortfalls < 0 };
                      });
                      return (
                        <tr key={label} className="border-b border-zinc-700">
                          <td className="px-4 py-2 text-zinc-200 font-medium">{label}</td>
                          {vals.map((v, j) => <ScenarioCell key={j} value={v.str} isNeg={v.neg} />)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 space-y-2 text-sm text-zinc-300">
                <p><span className="font-medium text-zinc-100">Monthly CF —</span> Rent minus all monthly expenses (mortgage, tax, insurance, HOA, management, maintenance). Positive means cash in your pocket each month; negative means you are subsidizing the property out of pocket.</p>
                <p><span className="font-medium text-zinc-100">CoC Return —</span> Your Year 1 net cash flow as a percentage of your total upfront cash (down payment + closing costs + initial repairs). A 6% CoC means you earn 6 cents per year for every dollar you put in on day one.</p>
                <p><span className="font-medium text-zinc-100">Break-even —</span> The year your cumulative real estate value first exceeds what the same money would have grown to in the alternative investment. Before that year the alternative investment is ahead; after it, real estate wins.</p>
              </div>
            </section>

            {/* Chart */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">30-Year Projection</h2>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
                    {(["low", "mid", "high"] as Scenario[]).map((s) => (
                      <button key={s} onClick={() => setScenario(s)}
                        className={`px-3 py-1 capitalize ${scenario === s ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <button onClick={exportChart}
                    className="text-sm px-3 py-1 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700">
                    Export JPG
                  </button>
                </div>
              </div>

              <div ref={chartRef} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={projections} margin={{ top: 8, right: 60, left: 20, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -2, fill: "#a1a1aa" }} tick={{ fontSize: 12, fill: "#a1a1aa" }} />
                    <YAxis yAxisId="dollar" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                    <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#27272a", border: "1px solid #3f3f46", borderRadius: "8px", color: "#f4f4f5" }}
                      labelStyle={{ color: "#a1a1aa" }}
                      formatter={(value, name) => {
                        const n = Number(value);
                        const s = name as string;
                        if (s.includes("ROI %")) return [`${n.toFixed(1)}%`, s];
                        return [usd(n), s];
                      }}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ color: "#a1a1aa" }} />
                    <Line yAxisId="dollar" type="monotone" dataKey="re_value" name="RE Value" stroke="#10b981" dot={false} strokeWidth={2} />
                    <Line yAxisId="dollar" type="monotone" dataKey="stock_value" name={`Alt. Investment (${data.market_cagr_pct}%)`} stroke="#8b5cf6" dot={false} strokeWidth={2} strokeDasharray="3 5" />
                    <Line yAxisId="pct" type="monotone" dataKey="cumulative_roi_pct" name="Cumulative ROI %" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 space-y-3">
                <p className="text-sm font-semibold text-zinc-200">The chart answers: does this property beat just investing in the market?</p>
                <div className="space-y-2 text-sm text-zinc-300">
                  <div className="flex gap-2">
                    <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-emerald-500"></span>
                    <p><span className="font-medium text-zinc-100">RE Value —</span> Your current equity (property value minus remaining loan balance) plus all the rent cash flows you have collected or covered over the years. Think of it as what you would walk away with — before agent fees — if you sold today.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-amber-400"></span>
                    <p><span className="font-medium text-zinc-100">Cumulative ROI % —</span> Your total gain or loss as a percentage of what you put in on day one (down payment + closing costs). Zero is breakeven; negative means the investment has not yet recovered its cost; positive means you are ahead.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full bg-violet-500"></span>
                    <p><span className="font-medium text-zinc-100">Alternative Investment Opportunity Cost —</span> What that same initial capital would be worth if invested in an alternative investment vehicle, compounded at the user-specified {data.market_cagr_pct}% annual return. No additional contributions are assumed — any monthly shortfalls you cover out-of-pocket are not reflected here. See <span className="font-medium">Total out-of-pocket (30yr)</span> in the scenario table for the full capital picture.{data.market_cagr_pct === 8.5 && " The default 8.5% reflects the 50-year historical average of S&P 500 annual returns."}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Year-by-year table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Year-by-Year Detail</h2>
                <button onClick={() => exportCSV(projections, scenario, address)}
                  className="text-sm px-3 py-1 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700">
                  Export CSV
                </button>
              </div>

              <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-x-auto">
                <table className="text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-700">
                      {["Yr", "Gross Rent", "Eff. Rent", "Mortgage", "Taxes", "HOA", "Mgmt", "Maint.", "Insurance", "PMI",
                        "Total Exp.", "Net CF", "Cum. CF", "Prop. Value", "Loan Bal.", "Equity", "Equity Gain", "RE Value", "Cumulative ROI %", "Stock Value"].map((h) => (
                        <th key={h} className="px-3 py-2 text-right text-zinc-300 font-medium first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((r) => (
                      <tr key={r.year} className="border-b border-zinc-700 hover:bg-zinc-700">
                        <td className="px-3 py-1.5 text-zinc-400 font-medium">{r.year}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.gross_rent)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.effective_rent)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.mortgage_payment)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.property_tax)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.hoa)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.management)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.maintenance)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.insurance)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.pmi)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.total_expenses)}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.net_cash_flow)}`}>{usd(r.net_cash_flow)}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.cumulative_cash_flow)}`}>{usd(r.cumulative_cash_flow)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.property_value)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.loan_balance)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-300">{usd(r.equity)}</td>
                        <td className="px-3 py-1.5 text-right text-green-400">{usd(r.equity_gain)}</td>
                        <td className="px-3 py-1.5 text-right text-green-400">{usd(r.re_value)}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.cumulative_roi_pct)}`}>{pct(r.cumulative_roi_pct)}</td>
                        <td className="px-3 py-1.5 text-right text-purple-400">{usd(r.stock_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
