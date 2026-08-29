import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Title } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;

  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-3xl tracking-widest2 text-marquee">Admins only</p>
        <p className="mt-3 text-sm text-paper/60">
          Your account doesn&apos;t have admin access. Ask an existing admin to run:
        </p>
        <code className="mt-3 block rounded bg-reel-900 p-3 text-left text-xs text-paper/70">
          update public.profiles set role = &apos;admin&apos; where email = &apos;{profile?.email}&apos;;
        </code>
      </div>
    );
  }

  const { data: titlesData } = await supabase
    .from("titles")
    .select("*")
    .order("created_at", { ascending: false });
  const titles = (titlesData as Title[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-widest2 text-paper">Admin</h1>
        <Link
          href="/admin/upload"
          className="rounded-md bg-marquee px-4 py-2 text-sm font-semibold text-reel-950 hover:bg-marquee-bright"
        >
          + New title
        </Link>
      </div>

      <ul className="mt-8 flex flex-col divide-y divide-reel-800 rounded-md border border-reel-800">
        {titles.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-paper">{t.title}</p>
              <p className="font-mono text-xs uppercase text-paper/40">
                {t.kind} · {t.category}
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <Link href={`/title/${t.id}`} className="text-paper/60 hover:text-marquee">
                View
              </Link>
              {t.kind === "series" && (
                <Link href={`/admin/upload?titleId=${t.id}`} className="text-marquee hover:underline">
                  + Add episode
                </Link>
              )}
            </div>
          </li>
        ))}
        {titles.length === 0 && (
          <li className="p-4 text-sm text-paper/40">No titles yet. Add your first one.</li>
        )}
      </ul>
    </div>
  );
}
