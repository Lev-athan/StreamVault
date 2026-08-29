"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || undefined } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="font-display text-3xl tracking-widest2 text-marquee">Check your inbox</h1>
        <p className="mt-3 text-paper/70">
          We sent a confirmation link to <strong>{email}</strong>. Confirm it, then log in.
        </p>
        <Link href="/login" className="mt-6 inline-block text-marquee hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-20">
      <h1 className="font-display text-4xl tracking-widest2 text-paper">Create account</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-paper/70">
          Display name (optional)
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-md border border-reel-600 bg-reel-900 px-3 py-2 text-paper focus:border-marquee focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-paper/70">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-reel-600 bg-reel-900 px-3 py-2 text-paper focus:border-marquee focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-paper/70">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-reel-600 bg-reel-900 px-3 py-2 text-paper focus:border-marquee focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-signal-red">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-marquee px-4 py-2 font-semibold text-reel-950 transition hover:bg-marquee-bright disabled:opacity-50"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p className="text-sm text-paper/60">
        Already have an account?{" "}
        <Link href="/login" className="text-marquee hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
