"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function Navbar() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Anonymous guest sessions (see GuestSession) exist for watch-limit
      // tracking but should still show the "Log in" control, not an account.
      if (!user || user.is_anonymous) {
        if (active) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (active) setProfile((data as Profile) ?? null);
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-reel-700/60 bg-reel-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl tracking-widest2 text-marquee">STREAM</span>
          <span className="font-display text-2xl tracking-widest2 text-paper">VAULT</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/browse" className="hidden text-paper/80 hover:text-marquee sm:inline">
            Browse
          </Link>
          <Link href="/pricing" className="hidden text-paper/80 hover:text-marquee sm:inline">
            Pricing
          </Link>

          {profile === undefined && <span className="h-8 w-16 animate-pulse rounded bg-reel-800" />}

          {profile === null && (
            <Link
              href="/login"
              className="rounded-md border border-marquee/70 px-4 py-1.5 font-medium text-marquee transition hover:bg-marquee hover:text-reel-950"
            >
              Log in
            </Link>
          )}

          {profile && (
            <div className="flex items-center gap-3">
              {profile.role === "admin" && (
                <Link href="/admin" className="hidden text-paper/80 hover:text-marquee md:inline">
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="rounded-full border border-reel-600 px-3 py-1 text-xs uppercase tracking-wide text-paper/80 hover:border-marquee hover:text-marquee"
              >
                {profile.plan === "premium" ? "Premium" : "Free"}
              </Link>
              <button
                onClick={handleLogout}
                className="text-paper/60 hover:text-signal-red"
              >
                Log out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
