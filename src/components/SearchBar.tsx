"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({
  autoFocus = false,
  initialValue = "",
}: {
  autoFocus?: boolean;
  initialValue?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/browse${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl" role="search">
      <label htmlFor="site-search" className="sr-only">
        Search movies and series
      </label>
      <div className="flex items-center gap-2 rounded-full border border-reel-600 bg-reel-900/80 px-5 py-3 shadow-lg shadow-black/40 transition focus-within:border-marquee">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 text-paper/50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="site-search"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search titles, categories…"
          className="w-full bg-transparent font-body text-lg text-paper placeholder:text-paper/40 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-marquee px-4 py-1.5 text-sm font-semibold text-reel-950 transition hover:bg-marquee-bright"
        >
          Search
        </button>
      </div>
    </form>
  );
}
