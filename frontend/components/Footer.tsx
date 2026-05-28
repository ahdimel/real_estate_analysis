import Link from "next/link";
import pkg from "@/package.json";

const BUILD_DATE = "May 27, 2026";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-900 py-4 px-6">
      <div className="flex justify-center items-center gap-6 text-xs text-zinc-500">
        <Link href="/terms" className="hover:text-zinc-300 transition-colors">
          Terms &amp; Conditions
        </Link>
        <span className="text-zinc-700">·</span>
        <Link href="/donate" className="hover:text-zinc-300 transition-colors">
          Donate
        </Link>
        <span className="text-zinc-700">·</span>
        <span>v{pkg.version} &middot; {BUILD_DATE}</span>
      </div>
    </footer>
  );
}
