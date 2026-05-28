import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — REIA",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-300 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100 mt-4">Terms &amp; Conditions</h1>
          <p className="text-xs text-zinc-500 mt-1">Last updated: May 27, 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">1. No Financial Advice</h2>
          <p className="text-sm leading-relaxed">
            Real Estate Investment Analyzer is an educational tool that generates deterministic projections based on inputs
            you provide. Nothing on this site constitutes financial, investment, legal, or tax advice.
            All projections are estimates only. You are solely responsible for any investment decisions
            you make. Consult a licensed financial advisor before making real estate or investment decisions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">2. No Warranty</h2>
          <p className="text-sm leading-relaxed">
            This service is provided &quot;as is&quot; without any warranty of any kind, express or implied.
            We do not guarantee the accuracy, completeness, or timeliness of any data, including
            mortgage rates or market return estimates. Use the outputs as a starting point for
            your own due diligence, not as a definitive conclusion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">3. Your Account</h2>
          <p className="text-sm leading-relaxed">
            You are responsible for maintaining the confidentiality of your account credentials.
            One account per email address is permitted. We reserve the right to suspend accounts
            that are used in violation of these terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">4. Your Data</h2>
          <p className="text-sm leading-relaxed">
            Property data and account information you enter are stored solely to provide the service.
            We do not sell, share, or monetize your personal data. You may delete your properties
            at any time from your dashboard.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">5. Limitation of Liability</h2>
          <p className="text-sm leading-relaxed">
            To the fullest extent permitted by law, Real Estate Investment Analyzer and its operators shall not be liable
            for any indirect, incidental, or consequential damages arising out of your use of this service,
            including any financial losses from decisions informed by its projections.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">6. Changes to These Terms</h2>
          <p className="text-sm leading-relaxed">
            We may update these terms at any time. Continued use of the service after changes are posted
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">7. Contact</h2>
          <p className="text-sm leading-relaxed">
            Questions about these terms? Email us at{" "}
            <a href="mailto:noreply@reianalyzer.online" className="text-blue-400 hover:underline">
              noreply@reianalyzer.online
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
