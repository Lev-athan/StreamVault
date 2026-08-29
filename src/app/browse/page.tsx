import SearchBar from "@/components/SearchBar";
import TitleCard from "@/components/TitleCard";
import { createClient } from "@/lib/supabase/server";
import type { Title } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? "";
  const category = searchParams.category?.trim() ?? "";

  let query = supabase.from("titles").select("*").order("created_at", { ascending: false });
  if (q) query = query.ilike("title", `%${q}%`);
  if (category) query = query.eq("category", category);

  const { data: titles } = await query;
  const list = (titles as Title[] | null) ?? [];

  const { data: categoryRows } = await supabase.from("titles").select("category");
  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category))).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col items-center gap-4">
        <SearchBar initialValue={q} />
      </div>

      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <CategoryPill label="All" href="/browse" active={!category} />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={c}
              href={`/browse?category=${encodeURIComponent(c)}`}
              active={category === c}
            />
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-20 text-center text-paper/50">
          {q ? `Nothing matches "${q}".` : "The vault is empty — check back soon."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.map((t) => (
            <TitleCard
              key={t.id}
              title={t}
              posterUrl={
                t.poster_path
                  ? supabase.storage.from("posters").getPublicUrl(t.poster_path).data.publicUrl
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
        active
          ? "border-marquee bg-marquee text-reel-950"
          : "border-reel-600 text-paper/60 hover:border-marquee hover:text-marquee"
      }`}
    >
      {label}
    </a>
  );
}
