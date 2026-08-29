import Link from "next/link";
import { notFound } from "next/navigation";
import CommentSection from "@/components/CommentSection";
import RatingStars from "@/components/RatingStars";
import { PLAN_LIMITS } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import type { Episode, Profile, Title } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TitleDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: titleRow } = await supabase.from("titles").select("*").eq("id", params.id).single();
  const title = titleRow as Title | null;
  if (!title) notFound();

  const posterUrl = title.poster_path
    ? supabase.storage.from("posters").getPublicUrl(title.poster_path).data.publicUrl
    : null;

  const { data: ratingRow } = await supabase
    .from("title_ratings")
    .select("*")
    .eq("title_id", title.id)
    .maybeSingle();

  let episodes: Episode[] = [];
  let watchedEpisodeIds: string[] = [];
  let plan: "free" | "premium" = "free";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    plan = ((profileRow as Profile | null)?.plan as "free" | "premium") ?? "free";
  }

  if (title.kind === "series") {
    const { data } = await supabase
      .from("episodes")
      .select("*")
      .eq("title_id", title.id)
      .order("season", { ascending: true })
      .order("episode_number", { ascending: true });
    episodes = (data as Episode[] | null) ?? [];

    if (user) {
      const { data: watched } = await supabase
        .from("watch_events")
        .select("episode_id")
        .eq("user_id", user.id)
        .eq("title_id", title.id)
        .not("episode_id", "is", null);
      watchedEpisodeIds = Array.from(
        new Set(((watched as { episode_id: string }[] | null) ?? []).map((w) => w.episode_id))
      );
    }
  }

  const freeEpisodeCap = PLAN_LIMITS.free.freeEpisodesPerSeries;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="mx-auto w-48 shrink-0 overflow-hidden rounded-md border border-reel-700 bg-reel-800 sm:mx-0">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" className="aspect-[2/3] w-full object-cover" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center px-2 text-center font-display text-paper/40">
              {title.title}
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="font-mono text-xs uppercase tracking-widest2 text-marquee-dim">
            {title.kind} · {title.category}
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-widest2 text-paper">{title.title}</h1>

          {ratingRow && (
            <div className="mt-2 flex items-center gap-2">
              <RatingStars value={Math.round(ratingRow.average_rating ?? 0)} size="sm" />
              <span className="text-xs text-paper/50">
                {ratingRow.average_rating ?? "—"} ({ratingRow.rating_count} ratings)
              </span>
            </div>
          )}

          <p className="mt-4 text-sm leading-relaxed text-paper/70">{title.description}</p>

          {title.kind === "movie" && (
            <Link
              href={`/watch/${title.id}`}
              className="mt-6 inline-block rounded-md bg-marquee px-6 py-2.5 font-semibold text-reel-950 transition hover:bg-marquee-bright"
            >
              ▶ Watch
            </Link>
          )}
        </div>
      </div>

      {title.kind === "series" && (
        <div className="mt-10">
          <h2 className="font-display text-2xl tracking-widest2 text-paper">Episodes</h2>
          <ul className="mt-4 flex flex-col divide-y divide-reel-800 rounded-md border border-reel-800">
            {episodes.map((ep, idx) => {
              const alreadyUnlocked = watchedEpisodeIds.includes(ep.id);
              const locked =
                plan === "free" && !alreadyUnlocked && watchedEpisodeIds.length >= freeEpisodeCap;
              return (
                <li key={ep.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium text-paper">
                      S{ep.season}E{ep.episode_number} · {ep.name}
                    </p>
                    {idx < freeEpisodeCap && plan === "free" && (
                      <p className="text-xs text-marquee-dim">Free</p>
                    )}
                  </div>
                  {locked ? (
                    <span className="flex items-center gap-1 text-xs text-paper/40">
                      🔒 Premium
                    </span>
                  ) : (
                    <Link
                      href={`/watch/${title.id}?e=${ep.id}`}
                      className="rounded-md border border-marquee/70 px-3 py-1 text-xs font-medium text-marquee hover:bg-marquee hover:text-reel-950"
                    >
                      ▶ Watch
                    </Link>
                  )}
                </li>
              );
            })}
            {episodes.length === 0 && (
              <li className="p-4 text-sm text-paper/40">No episodes uploaded yet.</li>
            )}
          </ul>
          {plan === "free" && (
            <p className="mt-3 text-xs text-paper/50">
              Free accounts can watch {freeEpisodeCap} episodes of this series.{" "}
              <Link href="/pricing" className="text-marquee hover:underline">
                Upgrade for the full series.
              </Link>
            </p>
          )}
        </div>
      )}

      <CommentSection titleId={title.id} />
    </div>
  );
}
