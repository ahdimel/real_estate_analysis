"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export const EMPTY_FORM = {
  mls_id: "",
  source_url: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  property_type: "single_family",
  bedrooms: "",
  bathrooms: "",
  garage: "none",
  square_feet: "",
  purchase_price: "",
  annual_interest_rate: "",
  mortgage_term: "30",
  down_payment: "20",
  closing_costs: "",
  initial_repairs: "0",
  pmi_monthly: "0",
  rent_lower: "",
  rent_upper: "",
  property_tax_annual: "",
  property_tax_url: "",
  hoa_annual: "",
  property_management_annual: "0",
  vacancy_days_annual: "30",
  maintenance_annual: "2500",
  insurance_annual: "2000",
  rent_increase_pct: "2",
  maintenance_increase_pct: "2",
  appreciation_rate_pct: "3",
  property_tax_increase_pct: "2",
  insurance_increase_pct: "4",
};

export type FormData = typeof EMPTY_FORM;

export function buildPayload(form: FormData) {
  return {
    ...form,
    bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
    bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
    square_feet: form.square_feet ? parseInt(form.square_feet) : null,
    mortgage_term: parseInt(form.mortgage_term),
    vacancy_days_annual: parseInt(form.vacancy_days_annual),
    purchase_price: parseFloat(form.purchase_price),
    annual_interest_rate: parseFloat(form.annual_interest_rate),
    down_payment: parseFloat(form.down_payment),
    closing_costs: parseFloat(form.closing_costs),
    initial_repairs: form.initial_repairs ? parseFloat(form.initial_repairs) : null,
    pmi_monthly: form.pmi_monthly ? parseFloat(form.pmi_monthly) : null,
    rent_lower: parseFloat(form.rent_lower),
    rent_upper: parseFloat(form.rent_upper),
    property_tax_annual: parseFloat(form.property_tax_annual),
    hoa_annual: form.hoa_annual ? parseFloat(form.hoa_annual) : null,
    property_management_annual: parseFloat(form.property_management_annual),
    maintenance_annual: parseFloat(form.maintenance_annual),
    insurance_annual: parseFloat(form.insurance_annual),
    rent_increase_pct: parseFloat(form.rent_increase_pct),
    maintenance_increase_pct: parseFloat(form.maintenance_increase_pct),
    appreciation_rate_pct: parseFloat(form.appreciation_rate_pct),
    property_tax_increase_pct: parseFloat(form.property_tax_increase_pct),
    insurance_increase_pct: parseFloat(form.insurance_increase_pct),
    mls_id: form.mls_id || null,
    source_url: form.source_url || null,
    property_tax_url: form.property_tax_url || null,
  };
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block ml-1 align-middle">
      <span
        className="cursor-help text-zinc-400 hover:text-blue-500 transition-colors text-xs select-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        ⓘ
      </span>
      {visible && (
        <span className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-zinc-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-2 border-b border-zinc-700 pb-2 mt-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function Field({
  label, name, type = "text", required = true, min, max, step,
  prefix, suffix, tooltip, hint, children, value, onChange,
}: {
  label: string; name: string; type?: string; required?: boolean;
  min?: string; max?: string; step?: string; prefix?: string; suffix?: string;
  tooltip?: string; hint?: string; children?: React.ReactNode; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-200 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      {children ? (
        <select name={name} required={required} value={value} onChange={onChange} className={inputClass}>
          {children}
        </select>
      ) : (
        <div className="flex items-center gap-1.5">
          {prefix && <span className="text-sm font-medium text-zinc-400">{prefix}</span>}
          <input
            type={type} name={name} required={required} value={value} onChange={onChange}
            min={min} max={max} step={step} className={inputClass}
          />
          {suffix && <span className="text-sm font-medium text-zinc-400">{suffix}</span>}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

interface PropertyFormProps {
  initialValues?: Partial<FormData>;
  onSubmit: (payload: object) => Promise<void>;
  submitLabel?: string;
  onCancel: () => void;
}

export default function PropertyForm({
  initialValues, onSubmit, submitLabel = "Save property", onCancel,
}: PropertyFormProps) {
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, ...initialValues });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ filled: string[]; error?: string } | null>(null);
  const [rateHint, setRateHint] = useState("Default rate pulled from Freddie Mac's weekly average for 30-yr prime fixed-rate mortgages");

  useEffect(() => {
    if (initialValues?.annual_interest_rate) return;
    apiFetch("/market/mortgage-rate")
      .then((r) => r.json())
      .then((data: { rate_pct: number; label: string }) => {
        setForm((prev) => ({ ...prev, annual_interest_rate: String(data.rate_pct) }));
        setRateHint(`Default pulled from Freddie Mac's weekly average for 30-yr prime fixed-rate mortgages (${data.rate_pct}%)`);
      })
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleScrape() {
    if (!form.source_url.trim()) return;
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await apiFetch("/scraper/zillow", {
        method: "POST",
        body: JSON.stringify({ url: form.source_url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setScrapeResult({ filled: [], error: json.detail ?? "Scrape failed" });
        return;
      }
      const data: Record<string, unknown> = json.data;
      const filled: string[] = [];
      setForm((prev) => {
        const updated = { ...prev };
        for (const [key, val] of Object.entries(data)) {
          if (key in updated && val != null) {
            (updated as Record<string, string>)[key] = String(val);
            filled.push(key.replace(/_/g, " "));
          }
        }
        if (updated.purchase_price && !prev.closing_costs) {
          const price = parseFloat(updated.purchase_price);
          if (!isNaN(price)) {
            updated.closing_costs = String(Math.round(price * 0.025));
            filled.push("closing costs");
          }
        }
        return updated;
      });
      setScrapeResult({ filled });
    } catch {
      setScrapeResult({ filled: [], error: "Could not reach the server." });
    } finally {
      setScraping(false);
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(buildPayload(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">

        <SectionHeader title="Property Information" />

        <Field label="MLS ID" name="mls_id" required={false}
          tooltip="Multiple Listing Service identifier. Optional — for your reference only."
          value={form.mls_id} onChange={handleChange} />
        <div>
          <label className="block text-sm font-medium text-zinc-200 mb-1">
            Zillow URL
            <InfoTooltip text="Paste a Zillow listing URL and click Scrape to auto-fill the form." />
          </label>
          <div className="flex gap-2">
            <input
              type="text" name="source_url" value={form.source_url} onChange={handleChange}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.zillow.com/homedetails/..."
            />
            <button
              type="button" onClick={handleScrape} disabled={scraping || !form.source_url.trim()}
              className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              {scraping ? "Scraping…" : "Scrape"}
            </button>
          </div>
          {scrapeResult && (
            scrapeResult.error ? (
              <p className="mt-1.5 text-xs text-red-600">{scrapeResult.error}</p>
            ) : (
              <p className="mt-1.5 text-xs text-green-700">
                ✓ Filled {scrapeResult.filled.length} field{scrapeResult.filled.length !== 1 ? "s" : ""}:{" "}
                {scrapeResult.filled.join(", ")}
              </p>
            )
          )}
        </div>
        <div className="col-span-2">
          <Field label="Street address" name="address_street" value={form.address_street} onChange={handleChange} />
        </div>
        <Field label="City" name="address_city" value={form.address_city} onChange={handleChange} />
        <Field label="State" name="address_state" value={form.address_state} onChange={handleChange}>
          <option value="">Select state</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Field>
        <Field label="ZIP code" name="address_zip" value={form.address_zip} onChange={handleChange} />
        <Field label="Property type" name="property_type" value={form.property_type} onChange={handleChange}>
          <option value="single_family">Single Family</option>
          <option value="multi_family">Multi-Family</option>
          <option value="condo">Condo</option>
          <option value="townhouse">Townhouse</option>
        </Field>
        <Field label="Bedrooms" name="bedrooms" type="number" min="1" max="20" required={false} value={form.bedrooms} onChange={handleChange} />
        <Field label="Bathrooms" name="bathrooms" type="number" min="1" max="20" required={false} value={form.bathrooms} onChange={handleChange} />
        <Field label="Garage" name="garage" required={false} value={form.garage} onChange={handleChange}>
          <option value="none">None</option>
          <option value="1">1 car</option>
          <option value="2">2 car</option>
          <option value="3">3 car</option>
          <option value="4">4 car</option>
          <option value="carport">Carport</option>
        </Field>
        <Field label="Square footage" name="square_feet" type="number" min="1" max="99999" suffix="sq ft" required={false} value={form.square_feet} onChange={handleChange} />

        <SectionHeader title="Acquisition" />

        <Field label="Purchase price" name="purchase_price" type="number" min="0.01" max="9999999.99" step="0.01" prefix="$"
          value={form.purchase_price} onChange={handleChange} />
        <Field label="Annual interest rate" name="annual_interest_rate" type="number" min="0.01" max="25" step="0.01" suffix="%"
          tooltip="Fixed annual rate on your mortgage loan."
          hint={rateHint}
          value={form.annual_interest_rate} onChange={handleChange} />
        <Field label="Mortgage term" name="mortgage_term" value={form.mortgage_term} onChange={handleChange}>
          <option value="10">10 years</option>
          <option value="15">15 years</option>
          <option value="20">20 years</option>
          <option value="30">30 years</option>
        </Field>
        <Field label="Down payment" name="down_payment" type="number" min="0" max="100" step="0.01" suffix="%"
          tooltip="Percentage of the purchase price paid upfront. Enter 100 for a cash purchase."
          value={form.down_payment} onChange={handleChange} />
        <Field label="Closing costs" name="closing_costs" type="number" min="0" max="9999999.99" step="0.01" prefix="$"
          tooltip="One-time fees at settlement: origination fees, title insurance, recording fees, prepaid taxes and insurance. Typically 2–5% of purchase price."
          value={form.closing_costs} onChange={handleChange} />
        <Field label="Initial repair estimate" name="initial_repairs" type="number" min="0" max="999999.99" step="0.01" prefix="$" required={false}
          tooltip="One-time estimated cost for repairs or renovations before the property is rent-ready. Treated as an additional upfront sunk cost alongside the down payment and closing costs."
          value={form.initial_repairs} onChange={handleChange} />
        <Field label="PMI" name="pmi_monthly" type="number" min="0" max="9999.99" step="0.01" prefix="$" suffix="/mo" required={false}
          tooltip="Private Mortgage Insurance — required by most lenders when down payment is under 20%. Typically $50–$300/month. The analysis automatically removes PMI once principal paydown brings your loan below 80% of the original purchase price."
          value={form.pmi_monthly} onChange={handleChange} />

        <SectionHeader title="Property Management" />

        <Field label="Estimated rent (low)" name="rent_lower" type="number" min="0" max="99999.99" step="0.01" prefix="$" suffix="/mo"
          tooltip="Your conservative monthly rent estimate. The analysis runs three scenarios: low, midpoint, and high."
          value={form.rent_lower} onChange={handleChange} />
        <Field label="Estimated rent (high)" name="rent_upper" type="number" min="0" max="99999.99" step="0.01" prefix="$" suffix="/mo"
          tooltip="Your optimistic monthly rent estimate. The midpoint of low and high is used as the base scenario."
          value={form.rent_upper} onChange={handleChange} />
        <Field label="Annual property taxes" name="property_tax_annual" type="number" min="0" max="999999.99" step="0.01" prefix="$"
          value={form.property_tax_annual} onChange={handleChange} />
        <Field label="Property tax reference URL" name="property_tax_url" required={false}
          tooltip="Optional link to the county assessor or tax record where you found this number."
          value={form.property_tax_url} onChange={handleChange} />
        <Field label="Annual HOA dues" name="hoa_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$" required={false}
          value={form.hoa_annual} onChange={handleChange} />
        <Field label="Annual property management cost" name="property_management_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$"
          tooltip="Fee for a professional property manager. Full-service management typically runs 8–12% of gross annual rent. Enter 0 if self-managing."
          value={form.property_management_annual} onChange={handleChange} />
        <Field label="Annual vacancy" name="vacancy_days_annual" type="number" min="0" max="364" suffix="days"
          tooltip="Expected days per year the property sits empty between tenants. 18 days ≈ 5% vacancy, a common baseline for stable markets."
          value={form.vacancy_days_annual} onChange={handleChange} />
        <Field label="Annual maintenance & repairs" name="maintenance_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$"
          tooltip="Budget for routine upkeep, appliances, and unexpected repairs. A common rule of thumb is 1% of purchase price per year."
          value={form.maintenance_annual} onChange={handleChange} />
        <Field label="Annual home insurance" name="insurance_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$"
          value={form.insurance_annual} onChange={handleChange} />

        <SectionHeader title="Year-over-Year Adjustments" />

        <Field label="Annual insurance premium increase" name="insurance_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%"
          tooltip="Expected yearly increase in your home insurance premium. Insurance costs have been rising faster than general inflation in recent years; 4% is a reasonable baseline."
          value={form.insurance_increase_pct} onChange={handleChange} />

        <Field label="Annual rent increase" name="rent_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%"
          tooltip="Expected yearly rent growth rate. The US long-term average is roughly 3–4%."
          value={form.rent_increase_pct} onChange={handleChange} />
        <Field label="Annual maintenance cost increase" name="maintenance_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%"
          tooltip="Reflects labor and materials inflation. Roughly tracks general inflation (~2–3%)."
          value={form.maintenance_increase_pct} onChange={handleChange} />
        <Field label="Property appreciation rate" name="appreciation_rate_pct" type="number" min="0" max="100" step="0.1" suffix="%"
          tooltip="Expected annual increase in property value. US long-term average is roughly 3–4%, though local markets vary significantly."
          value={form.appreciation_rate_pct} onChange={handleChange} />
        <Field label="Annual property tax increase" name="property_tax_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%"
          tooltip="Many jurisdictions cap property tax increases by law. Check your local rules — often 2–3% in states with caps."
          value={form.property_tax_increase_pct} onChange={handleChange} />
      </div>

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex justify-end gap-3">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-300 border border-zinc-600 rounded-lg hover:bg-zinc-700">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
