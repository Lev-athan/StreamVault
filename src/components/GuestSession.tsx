"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Requires "Allow anonymous sign-ins" enabled in Supabase Auth settings.
// A visitor with no account becomes an anonymous auth.users row (default
// plan = 'free', role = 'viewer' via the handle_new_user trigger), so the
// same watch_events / RLS machinery that enforces limits for real accounts
// also works for guests. When a guest later signs up, Supabase's identity
// linking can upgrade the anonymous user in place instead of losing history.
export default function GuestSession() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session && !cancelled) {
        await supabase.auth.signInAnonymously();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
