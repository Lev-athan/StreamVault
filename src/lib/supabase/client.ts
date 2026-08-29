"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

// Singleton: every component that calls createClient() gets the SAME
// client instance. This matters because each instance has its own
// onAuthStateChange listeners — with separate instances, logging in on
// one component (e.g. the Login page) would never notify another (e.g.
// the Navbar), which is exactly the "still shows Login after logging in"
// bug this fixes.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}