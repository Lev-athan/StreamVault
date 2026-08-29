"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FEATURES = {
  free: [
    "480p streaming",
    "2 episodes per series",
    "20 minutes of any movie",
    "Browse the full catalog",
  ],
  premium: [
    "1080p streaming",
    "Full series, every episode",
    "Full movies, start to finish",
    "Post reviews & ratings",
  ],
};

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      window.location.href = "/signup";
      return;
    }
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Could not start checkout.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-display text-5xl tracking-widest2 text-paper">Plans</h1>
      <p className="mt-2 text-paper/60">Start free. Upgrade whenever you want the whole reel.</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <PlanCard name="Free" price="$0" features={FEATURES.free} />
        <PlanCard
          name="Premium"
          price="$9.99/mo"
          features={FEATURES.premium}
          highlighted
          cta={
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="mt-6 w-full rounded-md bg-marquee px-4 py-2 font-semibold text-reel-950 transition hover:bg-marquee-bright disabled:opacity-50"
            >
              {loading ? "Redirecting…" : "Upgrade to Premium"}
            </button>
          }
        />
      </div>
      {error && <p className="mt-4 text-sm text-signal-red">{error}</p>}
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  highlighted,
  cta,
}: {
  name: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border p-6 text-left ${
        highlighted ? "border-marquee bg-reel-900" : "border-reel-700 bg-reel-900/50"
      }`}
    >
      <p className="font-mono text-xs uppercase tracking-widest2 text-marquee-dim">{name}</p>
      <p className="mt-1 font-display text-3xl tracking-widest2 text-paper">{price}</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-paper/70">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-marquee">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}
