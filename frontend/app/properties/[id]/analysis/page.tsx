"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

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

type Scenario = "low" | "mid" | "high";

// ── Formatters ───────────────────────────────────────────────────────────────

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(2)}%`;
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function ScenarioCell({ value, isNeg }: { value: string; isNeg?: boolean }) {
  return (
    <td className={`px-4 py-2 text-sm text-right font-medium ${isNeg ? "text-red-600" : "text-green-700"}`}>
      {value}
    </td>
  );
}

function cfColor(n: number) {
  return n < 0 ? "text-red-600" : "text-green-700";
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [address, setAddress] = useState("Property");
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState<Scenario>("mid");
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !id) return;
    // fetch property address for display + export naming
    apiFetch(`/properties/${id}`, {}, token)
      .then((r) => r.json())
      .then((p) => setAddress(`${p.address_street}, ${p.address_city}`));

    apiFetch(`/properties/${id}/analysis`, {}, token)
      .then((r) => r.json())
      .then((d) => {
        if (d.detail) { setError(d.detail); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load analysis."));
  }, [token, id]);

  function exportChart() {
    if (!chartRef.current) return;

    // Recharts renders multiple SVGs (legend icons, etc.) — find the largest one by area
    const allSvgs = Array.from(chartRef.current.querySelectorAll("svg"));
    const mainSvg = allSvgs.reduce<SVGSVGElement | null>((best, svg) => {
      const r = svg.getBoundingClientRect();
      const bestR = best?.getBoundingClientRect();
      return !best || r.width * r.height > (bestR?.width ?? 0) * (bestR?.height ?? 0)
        ? svg as SVGSVGElement
        : best;
    }, null);
    if (!mainSvg) return;

    // getBoundingClientRect gives the true rendered size; SVG clientWidth is often 0
    const { width, height } = mainSvg.getBoundingClientRect();

    // Clone and stamp explicit dimensions so the browser can draw it onto a canvas
    const clone = mainSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.95);
      a.download = `${address.replace(/\s+/g, "_")}_${scenario}_chart.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

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

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-600">{error}</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Running analysis…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <nav className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-900">REI</span>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Back to dashboard
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{address}</h1>
          <p className="text-sm text-zinc-500 mt-1">Rental investment analysis · 30-year projection</p>
        </div>

        {/* Summary metrics */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MetricCard label="Initial Investment" value={usd(data.initial_investment)} />
            <MetricCard label="Loan Amount" value={usd(data.loan_amount)} />
            <MetricCard label="Monthly Mortgage" value={usd(data.monthly_mortgage)} />
            <MetricCard label="Cap Rate (mid)" value={pct(data.cap_rate_mid)} />
            <MetricCard label="GRM (mid)" value={num(data.grm_mid)} />
          </div>
        </section>

        {/* Scenario comparison */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Scenario Comparison</h2>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-2 text-left text-zinc-600 font-medium">Metric</th>
                  <th className="px-4 py-2 text-right text-zinc-600 font-medium">Low rent</th>
                  <th className="px-4 py-2 text-right text-zinc-600 font-medium">Mid rent</th>
                  <th className="px-4 py-2 text-right text-zinc-600 font-medium">High rent</th>
                </tr>
              </thead>
              <tbody>
                {(["Monthly CF (Yr 1)", "Annual CF (Yr 1)", "CoC Return", "Break-even"] as const).map((label, i) => {
                  const vals = (["low", "mid", "high"] as Scenario[]).map((s) => {
                    const sm = summaries[s]!;
                    if (i === 0) return { str: usd(sm.monthly_cash_flow_y1), neg: sm.monthly_cash_flow_y1 < 0 };
                    if (i === 1) return { str: usd(sm.annual_cash_flow_y1), neg: sm.annual_cash_flow_y1 < 0 };
                    if (i === 2) return { str: pct(sm.coc_return), neg: sm.coc_return < 0 };
                    return { str: sm.break_even_year ? `Year ${sm.break_even_year}` : "Never", neg: !sm.break_even_year };
                  });
                  return (
                    <tr key={label} className="border-b border-zinc-50">
                      <td className="px-4 py-2 text-zinc-700 font-medium">{label}</td>
                      {vals.map((v, j) => <ScenarioCell key={j} value={v.str} isNeg={v.neg} />)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Chart */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">30-Year Projection</h2>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
                {(["low", "mid", "high"] as Scenario[]).map((s) => (
                  <button key={s} onClick={() => setScenario(s)}
                    className={`px-3 py-1 capitalize ${scenario === s ? "bg-blue-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={exportChart}
                className="text-sm px-3 py-1 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                Export JPG
              </button>
            </div>
          </div>

          <div ref={chartRef} className="bg-white border border-zinc-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={projections} margin={{ top: 8, right: 60, left: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -2 }} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="dollar" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value);
                    const s = name as string;
                    if (s.includes("ROI %")) return [`${n.toFixed(1)}%`, s];
                    return [usd(n), s];
                  }}
                  labelFormatter={(label) => `Year ${label}`}
                />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="dollar" type="monotone" dataKey="re_value" name="RE Value" stroke="#10b981" dot={false} strokeWidth={2} />
                <Line yAxisId="dollar" type="monotone" dataKey="stock_value" name={data.market_label} stroke="#8b5cf6" dot={false} strokeWidth={2} strokeDasharray="3 5" />
                <Line yAxisId="pct" type="monotone" dataKey="cumulative_roi_pct" name="Cumulative ROI %" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Year-by-year table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Year-by-Year Detail</h2>
            <button onClick={() => exportCSV(projections, scenario, address)}
              className="text-sm px-3 py-1 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
              Export CSV
            </button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Yr", "Gross Rent", "Eff. Rent", "Mortgage", "Taxes", "HOA", "Mgmt", "Maint.", "Insurance", "PMI",
                    "Total Exp.", "Net CF", "Cum. CF", "Prop. Value", "Loan Bal.", "Equity", "Equity Gain", "RE Value", "Cumulative ROI %", "Stock Value"].map((h) => (
                    <th key={h} className="px-3 py-2 text-right text-zinc-500 font-medium first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.map((r) => (
                  <tr key={r.year} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-3 py-1.5 text-zinc-500 font-medium">{r.year}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.gross_rent)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.effective_rent)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.mortgage_payment)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.property_tax)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.hoa)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.management)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.maintenance)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.insurance)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.pmi)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.total_expenses)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.net_cash_flow)}`}>{usd(r.net_cash_flow)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.cumulative_cash_flow)}`}>{usd(r.cumulative_cash_flow)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.property_value)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.loan_balance)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{usd(r.equity)}</td>
                    <td className="px-3 py-1.5 text-right text-green-700">{usd(r.equity_gain)}</td>
                    <td className="px-3 py-1.5 text-right text-green-700">{usd(r.re_value)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${cfColor(r.cumulative_roi_pct)}`}>{pct(r.cumulative_roi_pct)}</td>
                    <td className="px-3 py-1.5 text-right text-purple-700">{usd(r.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
