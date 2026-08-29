import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import {
  canPlayEpisode,
  maxQualityFor,
  movieSecondsAllowed,
  pickVideoPath,
} from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Episode, Profile, Title } from "@/lib/types";

export const dynamic = "force-dynamic";

const VIDEO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { e?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: titleRow } = await supabase.from("titles").select("*").eq("id", params.id).single();
  const title = titleRow as Title | null;
  if (!title) notFound();

  if (!user) {
    return (
      <Paywall
        heading="Sign in to watch"
        body="Create a free account to start watching — no card required."
        titleId={title.id}
      />
    );
  }

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const plan = ((profileRow as Profile | null)?.plan as "free" | "premium") ?? "free";
  const posterUrl = title.poster_path
    ? supabase.storage.from("posters").getPublicUrl(title.poster_path).data.publicUrl
    : null;

  const admin = createAdminClient();

  // ------------------------------------------------------------------ series
  if (title.kind === "series") {
    const { data: episodesData } = await supabase
      .from("episodes")
      .select("*")
      .eq("title_id", title.id)
      .order("season", { ascending: true })
      .order("episode_number", { ascending: true });
    const episodes = (episodesData as Episode[] | null) ?? [];
    if (episodes.length === 0) notFound();

    const episodeId = searchParams.e ?? episodes[0].id;
    if (!searchParams.e) redirect(`/watch/${title.id}?e=${episodeId}`);

    const episode = episodes.find((e) => e.id === episodeId);
    if (!episode) notFound();

    const { data: watched } = await supabase
      .from("watch_events")
      .select("episode_id")
      .eq("user_id", user.id)
      .eq("title_id", title.id)
      .not("episode_id", "is", null);
    const watchedEpisodeIds = Array.from(
      new Set(((watched as { episode_id: string }[] | null) ?? []).map((w) => w.episode_id))
    );

    const decision = canPlayEpisode({ plan, episodeId, watchedEpisodeIds });
    if (!decision.allowed) {
      return <Paywall heading="Upgrade to keep watching" body={decision.reason!} titleId={title.id} />;
    }

    const path = pickVideoPath({ plan, masterPath: episode.video_path, lowResPath: episode.video_path_480 });
    const { data: signed } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60 * 4);
    if (!signed) notFound();

    await supabase.from("watch_events").upsert(
      { user_id: user.id, title_id: title.id, episode_id: episodeId, last_watched_at: new Date().toISOString() },
      { onConflict: "user_id,title_id,episode_id" }
    );

    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Breadcrumb title={title} extra={`S${episode.season}E${episode.episode_number} · ${episode.name}`} />
        <VideoPlayer
          src={signed.signedUrl}
          titleId={title.id}
          episodeId={episode.id}
          capSeconds={null}
          maxQuality={maxQualityFor(plan)}
          posterUrl={posterUrl}
        />
        <EpisodeNav episodes={episodes} currentId={episode.id} titleId={title.id} />
      </div>
    );
  }

  // ------------------------------------------------------------------ movie
  if (!title.video_path) notFound();
  const capSeconds = movieSecondsAllowed(plan);
  const path = pickVideoPath({ plan, masterPath: title.video_path, lowResPath: title.video_path_480 });
  const expiresIn = Number.isFinite(capSeconds) ? capSeconds + 5 * 60 : 60 * 60 * 6;
  const { data: signed } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(path, expiresIn);
  if (!signed) notFound();

  await supabase.from("watch_events").upsert(
    { user_id: user.id, title_id: title.id, episode_id: null, last_watched_at: new Date().toISOString() },
    { onConflict: "user_id,title_id" }
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb title={title} />
      <VideoPlayer
        src={signed.signedUrl}
        titleId={title.id}
        episodeId={null}
        capSeconds={Number.isFinite(capSeconds) ? capSeconds : null}
        maxQuality={maxQualityFor(plan)}
        posterUrl={posterUrl}
      />
    </div>
  );
}

function Breadcrumb({ title, extra }: { title: Title; extra?: string }) {
  return (
    <div className="mb-4">
      <Link href={`/title/${title.id}`} className="text-xs text-paper/50 hover:text-marquee">
        ← {title.title}
      </Link>
      <h1 className="font-display text-2xl tracking-widest2 text-paper">{extra ?? title.title}</h1>
    </div>
  );
}

function EpisodeNav({
  episodes,
  currentId,
  titleId,
}: {
  episodes: Episode[];
  currentId: string;
  titleId: string;
}) {
  return (
    <ul className="mt-6 flex flex-col divide-y divide-reel-800 rounded-md border border-reel-800">
      {episodes.map((ep) => (
        <li key={ep.id} className={`p-3 text-sm ${ep.id === currentId ? "bg-reel-800" : ""}`}>
          <Link
            href={`/watch/${titleId}?e=${ep.id}`}
            className={ep.id === currentId ? "text-marquee" : "text-paper/70 hover:text-marquee"}
          >
            S{ep.season}E{ep.episode_number} · {ep.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Paywall({ heading, body, titleId }: { heading: string; body: string; titleId: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-display text-3xl tracking-widest2 text-marquee">{heading}</p>
      <p className="text-sm text-paper/70">{body}</p>
      <div className="flex gap-3">
        <Link
          href="/pricing"
          className="rounded-md bg-marquee px-5 py-2 font-semibold text-reel-950 hover:bg-marquee-bright"
        >
          See plans
        </Link>
        <Link
          href={`/title/${titleId}`}
          className="rounded-md border border-reel-600 px-5 py-2 text-paper/70 hover:border-marquee hover:text-marquee"
        >
          Back to title
        </Link>
      </div>
    </div>
  );
}
