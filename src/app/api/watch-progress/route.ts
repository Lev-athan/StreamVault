import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canPlayEpisode,
  movieSecondsAllowed,
  pickVideoPath,
  maxQualityFor,
} from "@/lib/access-control";
import type { Episode, Profile, Title, WatchEvent } from "@/lib/types";

const VIDEO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos";

// GET /api/watch-progress?titleId=...&episodeId=...(optional, series only)
// Validates the requesting user is allowed to play this content and, if so,
// mints a short-lived signed URL at the correct quality for their plan.
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false, reason: "Sign in to watch." }, { status: 401 });
  }

  const titleId = req.nextUrl.searchParams.get("titleId");
  const episodeId = req.nextUrl.searchParams.get("episodeId");
  if (!titleId) {
    return NextResponse.json({ allowed: false, reason: "Missing titleId." }, { status: 400 });
  }

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  const plan = profile?.plan ?? "free";

  const { data: titleRow } = await supabase.from("titles").select("*").eq("id", titleId).single();
  const title = titleRow as Title | null;
  if (!title) {
    return NextResponse.json({ allowed: false, reason: "Title not found." }, { status: 404 });
  }

  const admin = createAdminClient();

  if (title.kind === "series") {
    if (!episodeId) {
      return NextResponse.json({ allowed: false, reason: "Missing episodeId." }, { status: 400 });
    }
    const { data: episodeRow } = await supabase
      .from("episodes")
      .select("*")
      .eq("id", episodeId)
      .eq("title_id", titleId)
      .single();
    const episode = episodeRow as Episode | null;
    if (!episode) {
      return NextResponse.json({ allowed: false, reason: "Episode not found." }, { status: 404 });
    }

    const { data: watched } = await supabase
      .from("watch_events")
      .select("episode_id")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .not("episode_id", "is", null);

    const watchedEpisodeIds = Array.from(
      new Set(((watched as { episode_id: string }[] | null) ?? []).map((w) => w.episode_id))
    );

    const decision = canPlayEpisode({ plan, episodeId, watchedEpisodeIds });
    if (!decision.allowed) {
      return NextResponse.json({ allowed: false, reason: decision.reason }, { status: 403 });
    }

    const path = pickVideoPath({
      plan,
      masterPath: episode.video_path,
      lowResPath: episode.video_path_480,
    });
    const { data: signed, error } = await admin.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 4); // 4 hours

    if (error || !signed) {
      return NextResponse.json({ allowed: false, reason: "Could not load video." }, { status: 500 });
    }

    // Record that this episode was started (idempotent upsert).
    // onConflict targets the partial unique index for episode_id IS NOT NULL.
    await supabase
      .from("watch_events")
      .upsert(
        { user_id: user.id, title_id: titleId, episode_id: episodeId, last_watched_at: new Date().toISOString() },
        { onConflict: "user_id,title_id,episode_id", ignoreDuplicates: false }
      );

    return NextResponse.json({
      allowed: true,
      signedUrl: signed.signedUrl,
      maxQuality: maxQualityFor(plan),
      capSeconds: null,
    });
  }

  // --- Movie ---
  if (!title.video_path) {
    return NextResponse.json({ allowed: false, reason: "Video not uploaded yet." }, { status: 404 });
  }
  const capSeconds = movieSecondsAllowed(plan);

  const path = pickVideoPath({ plan, masterPath: title.video_path, lowResPath: title.video_path_480 });
  // Free-tier movie links expire quickly, on top of the client-side pause,
  // as a second layer of enforcement against skipping past the cap.
  const expiresIn = Number.isFinite(capSeconds) ? capSeconds + 5 * 60 : 60 * 60 * 6;
  const { data: signed, error } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(path, expiresIn);

  if (error || !signed) {
    return NextResponse.json({ allowed: false, reason: "Could not load video." }, { status: 500 });
  }

  // onConflict targets the partial unique index for episode_id IS NULL (movies).
  await supabase
    .from("watch_events")
    .upsert(
      { user_id: user.id, title_id: titleId, episode_id: null, last_watched_at: new Date().toISOString() },
      { onConflict: "user_id,title_id", ignoreDuplicates: false }
    );

  return NextResponse.json({
    allowed: true,
    signedUrl: signed.signedUrl,
    maxQuality: maxQualityFor(plan),
    capSeconds: Number.isFinite(capSeconds) ? capSeconds : null,
  });
}

// POST /api/watch-progress  { titleId, episodeId?, secondsWatched }
// Heartbeat from the player, called periodically during playback.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const titleId: string | undefined = body?.titleId;
  const episodeId: string | null = body?.episodeId ?? null;
  const secondsWatched: number = Math.max(0, Number(body?.secondsWatched) || 0);
  if (!titleId) return NextResponse.json({ ok: false }, { status: 400 });

  await supabase.from("watch_events").upsert(
    {
      user_id: user.id,
      title_id: titleId,
      episode_id: episodeId,
      seconds_watched: secondsWatched,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: episodeId ? "user_id,title_id,episode_id" : "user_id,title_id" }
  );

  return NextResponse.json({ ok: true } satisfies { ok: boolean });
}
