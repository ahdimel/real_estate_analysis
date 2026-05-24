"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>("checking…");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-zinc-900">REI</h1>
        <p className="text-zinc-500">Real Estate Investment Analyzer</p>
      </div>

      <div className="max-w-md rounded-lg border border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600 leading-relaxed shadow-sm">
        Welcome! REI Analyzer will help you run the numbers on properties you&apos;re interested in acquiring. Let&apos;s see if they make sense as investment rental properties. Alternatively, this app will also help you decide on whether to continue renting, or to buy your own house. Let&apos;s get cranking!
      </div>

      <div className="flex gap-3">
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Create account
        </Link>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200 px-4 py-2 text-sm">
        <span className="text-zinc-500">Backend API:</span>
        <span className={apiStatus === "ok" ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
          {apiStatus}
        </span>
      </div>
    </div>
  );
}
