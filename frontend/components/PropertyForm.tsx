"use client";

import { useState } from "react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export const EMPTY_FORM = {
  source_url: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  property_type: "single_family",
  bedrooms: "",
  bathrooms: "",
  garage: "none",
  year_built: "",
  square_feet: "",
  purchase_price: "",
  annual_interest_rate: "",
  mortgage_term: "",
  down_payment: "",
  closing_costs: "",
  rent_lower: "",
  rent_upper: "",
  property_tax_annual: "",
  property_tax_url: "",
  hoa_annual: "",
  property_management_annual: "",
  vacancy_days_annual: "",
  maintenance_annual: "",
  insurance_annual: "",
  rent_increase_pct: "",
  maintenance_increase_pct: "",
  appreciation_rate_pct: "",
  property_tax_increase_pct: "",
};

export type FormData = typeof EMPTY_FORM;

export function buildPayload(form: FormData) {
  return {
    ...form,
    bedrooms: parseInt(form.bedrooms),
    bathrooms: parseInt(form.bathrooms),
    year_built: parseInt(form.year_built),
    square_feet: parseInt(form.square_feet),
    mortgage_term: parseInt(form.mortgage_term),
    vacancy_days_annual: parseInt(form.vacancy_days_annual),
    purchase_price: parseFloat(form.purchase_price),
    annual_interest_rate: parseFloat(form.annual_interest_rate),
    down_payment: parseFloat(form.down_payment),
    closing_costs: parseFloat(form.closing_costs),
    rent_lower: parseFloat(form.rent_lower),
    rent_upper: parseFloat(form.rent_upper),
    property_tax_annual: parseFloat(form.property_tax_annual),
    hoa_annual: parseFloat(form.hoa_annual),
    property_management_annual: parseFloat(form.property_management_annual),
    maintenance_annual: parseFloat(form.maintenance_annual),
    insurance_annual: parseFloat(form.insurance_annual),
    rent_increase_pct: parseFloat(form.rent_increase_pct),
    maintenance_increase_pct: parseFloat(form.maintenance_increase_pct),
    appreciation_rate_pct: parseFloat(form.appreciation_rate_pct),
    property_tax_increase_pct: parseFloat(form.property_tax_increase_pct),
    source_url: form.source_url || null,
    property_tax_url: form.property_tax_url || null,
  };
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-2 border-b border-zinc-200 pb-2 mt-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function Field({
  label, name, type = "text", required = true, min, max, step,
  prefix, suffix, children, value, onChange,
}: {
  label: string; name: string; type?: string; required?: boolean;
  min?: string; max?: string; step?: string; prefix?: string; suffix?: string;
  children?: React.ReactNode; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-800 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children ? (
        <select name={name} required={required} value={value} onChange={onChange} className={inputClass}>
          {children}
        </select>
      ) : (
        <div className="flex items-center gap-1.5">
          {prefix && <span className="text-sm font-medium text-zinc-600">{prefix}</span>}
          <input
            type={type} name={name} required={required} value={value} onChange={onChange}
            min={min} max={max} step={step} className={inputClass}
          />
          {suffix && <span className="text-sm font-medium text-zinc-600">{suffix}</span>}
        </div>
      )}
    </div>
  );
}

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">

        <SectionHeader title="Property Information" />

        <div className="col-span-2">
          <Field label="Zillow / Redfin URL" name="source_url" required={false} value={form.source_url} onChange={handleChange} />
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
        <Field label="Bedrooms" name="bedrooms" type="number" min="1" max="20" value={form.bedrooms} onChange={handleChange} />
        <Field label="Bathrooms" name="bathrooms" type="number" min="1" max="20" value={form.bathrooms} onChange={handleChange} />
        <Field label="Garage" name="garage" value={form.garage} onChange={handleChange}>
          <option value="none">None</option>
          <option value="1">1 car</option>
          <option value="2">2 car</option>
          <option value="3">3 car</option>
          <option value="4">4 car</option>
          <option value="carport">Carport</option>
        </Field>
        <Field label="Year built" name="year_built" type="number" min="1900" max="2030" value={form.year_built} onChange={handleChange} />
        <Field label="Square footage" name="square_feet" type="number" min="1" max="99999" suffix="sq ft" value={form.square_feet} onChange={handleChange} />

        <SectionHeader title="Acquisition" />

        <Field label="Purchase price" name="purchase_price" type="number" min="0.01" max="9999999.99" step="0.01" prefix="$" value={form.purchase_price} onChange={handleChange} />
        <Field label="Annual interest rate" name="annual_interest_rate" type="number" min="0" max="25" step="0.01" suffix="%" value={form.annual_interest_rate} onChange={handleChange} />
        <Field label="Mortgage term" name="mortgage_term" type="number" min="1" max="45" suffix="years" value={form.mortgage_term} onChange={handleChange} />
        <Field label="Down payment" name="down_payment" type="number" min="0" max="100" step="0.01" suffix="%" value={form.down_payment} onChange={handleChange} />
        <div className="col-span-2">
          <Field label="Closing costs" name="closing_costs" type="number" min="0" max="9999999.99" step="0.01" prefix="$" value={form.closing_costs} onChange={handleChange} />
        </div>

        <SectionHeader title="Property Management" />

        <Field label="Estimated rent (low)" name="rent_lower" type="number" min="0" max="99999.99" step="0.01" prefix="$" suffix="/mo" value={form.rent_lower} onChange={handleChange} />
        <Field label="Estimated rent (high)" name="rent_upper" type="number" min="0" max="99999.99" step="0.01" prefix="$" suffix="/mo" value={form.rent_upper} onChange={handleChange} />
        <Field label="Annual property taxes" name="property_tax_annual" type="number" min="0" max="999999.99" step="0.01" prefix="$" value={form.property_tax_annual} onChange={handleChange} />
        <Field label="Property tax reference URL" name="property_tax_url" required={false} value={form.property_tax_url} onChange={handleChange} />
        <Field label="Annual HOA dues" name="hoa_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$" value={form.hoa_annual} onChange={handleChange} />
        <Field label="Annual property management cost" name="property_management_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$" value={form.property_management_annual} onChange={handleChange} />
        <Field label="Annual vacancy" name="vacancy_days_annual" type="number" min="0" max="364" suffix="days" value={form.vacancy_days_annual} onChange={handleChange} />
        <Field label="Annual maintenance & repairs" name="maintenance_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$" value={form.maintenance_annual} onChange={handleChange} />
        <Field label="Annual home insurance" name="insurance_annual" type="number" min="0" max="99999.99" step="0.01" prefix="$" value={form.insurance_annual} onChange={handleChange} />

        <SectionHeader title="Year-over-Year Adjustments" />

        <Field label="Annual rent increase" name="rent_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%" value={form.rent_increase_pct} onChange={handleChange} />
        <Field label="Annual maintenance cost increase" name="maintenance_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%" value={form.maintenance_increase_pct} onChange={handleChange} />
        <Field label="Property appreciation rate" name="appreciation_rate_pct" type="number" min="0" max="100" step="0.1" suffix="%" value={form.appreciation_rate_pct} onChange={handleChange} />
        <Field label="Annual property tax increase" name="property_tax_increase_pct" type="number" min="0" max="100" step="0.1" suffix="%" value={form.property_tax_increase_pct} onChange={handleChange} />
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex justify-end gap-3">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">
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
