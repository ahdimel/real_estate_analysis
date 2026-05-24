"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import PropertyForm, { FormData, EMPTY_FORM } from "@/components/PropertyForm";

function toFormValues(prop: Record<string, unknown>): Partial<FormData> {
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    mls_id: str(prop.mls_id),
    source_url: str(prop.source_url),
    address_street: str(prop.address_street),
    address_city: str(prop.address_city),
    address_state: str(prop.address_state),
    address_zip: str(prop.address_zip),
    property_type: str(prop.property_type),
    bedrooms: str(prop.bedrooms),
    bathrooms: str(prop.bathrooms),
    garage: str(prop.garage),
    square_feet: str(prop.square_feet),
    purchase_price: str(prop.purchase_price),
    annual_interest_rate: str(prop.annual_interest_rate),
    mortgage_term: str(prop.mortgage_term),
    down_payment: str(prop.down_payment),
    closing_costs: str(prop.closing_costs),
    initial_repairs: str(prop.initial_repairs),
    pmi_monthly: str(prop.pmi_monthly),
    rent_lower: str(prop.rent_lower),
    rent_upper: str(prop.rent_upper),
    property_tax_annual: str(prop.property_tax_annual),
    property_tax_url: str(prop.property_tax_url),
    hoa_annual: str(prop.hoa_annual),
    property_management_annual: str(prop.property_management_annual),
    vacancy_days_annual: str(prop.vacancy_days_annual),
    maintenance_annual: str(prop.maintenance_annual),
    insurance_annual: str(prop.insurance_annual),
    rent_increase_pct: str(prop.rent_increase_pct),
    maintenance_increase_pct: str(prop.maintenance_increase_pct),
    appreciation_rate_pct: str(prop.appreciation_rate_pct),
    property_tax_increase_pct: str(prop.property_tax_increase_pct),
    insurance_increase_pct: str(prop.insurance_increase_pct),
  };
}

export default function EditPropertyPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [initialValues, setInitialValues] = useState<Partial<FormData>>(EMPTY_FORM);
  const [fetchError, setFetchError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`/properties/${id}`, {}, token)
      .then((r) => r.json())
      .then((data) => {
        if (data.detail) { setFetchError(data.detail); return; }
        setInitialValues(toFormValues(data));
        setReady(true);
      })
      .catch(() => setFetchError("Could not load property."));
  }, [token, id]);

  async function handleSubmit(payload: object) {
    if (!token) { router.push("/login"); return; }
    const res = await apiFetch(`/properties/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Failed to update property");
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
        <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Edit property</h1>
        {fetchError && <p className="text-sm text-red-400 mb-4">{fetchError}</p>}
        {ready && (
          <PropertyForm
            initialValues={initialValues}
            onSubmit={handleSubmit}
            submitLabel="Update property"
            onCancel={() => router.push("/dashboard")}
          />
        )}
      </main>
    </div>
  );
}
