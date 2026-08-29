"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        router.push("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile((data as Profile) ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openBillingPortal() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setPortalLoading(false);
    if (data.url) window.location.href = data.url;
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl tracking-widest2 text-paper">Account</h1>

      <dl className="mt-8 flex flex-col gap-4 text-sm">
        <Row label="Email" value={profile.email} />
        <Row label="Plan" value={profile.plan === "premium" ? "Premium" : "Free"} />
        {profile.stripe_subscription_status && (
          <Row label="Subscription" value={profile.stripe_subscription_status} />
        )}
      </dl>

      <div className="mt-8 flex flex-col gap-3">
        {profile.plan === "premium" ? (
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="rounded-md border border-marquee/70 px-4 py-2 font-medium text-marquee hover:bg-marquee hover:text-reel-950 disabled:opacity-50"
          >
            {portalLoading ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <a
            href="/pricing"
            className="rounded-md bg-marquee px-4 py-2 text-center font-semibold text-reel-950 hover:bg-marquee-bright"
          >
            Upgrade to Premium
          </a>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-reel-800 pb-2">
      <dt className="text-paper/50">{label}</dt>
      <dd className="text-paper">{value}</dd>
    </div>
  );
}
