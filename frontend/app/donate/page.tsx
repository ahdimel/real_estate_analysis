import Link from "next/link";

export const metadata = {
  title: "Donate — REIA",
};

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-300 px-6 py-12">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100 mt-4">Support REIA</h1>
        </div>

        <p className="text-sm leading-relaxed">
          Real Estate Investment Analyzer is free to use. If it helped you make a more confident real estate decision,
          consider buying us a coffee — a suggested amount is <span className="text-zinc-100 font-medium">$10</span>.
        </p>

        <a
          href="https://ko-fi.com/reianalyzer"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full bg-[#FF5E5B] hover:bg-[#e54e4b] text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
        >
          <span>☕</span>
          <span>Donate on Ko-fi</span>
        </a>

        <p className="text-xs text-zinc-500 text-center">
          You&apos;ll be taken to Ko-fi to complete your donation. Any amount is appreciated.
        </p>
      </div>
    </div>
  );
}
