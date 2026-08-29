import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

const VIDEO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Sign in first." };

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Admins only." };
  }
  return { ok: true as const, userId: user.id };
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const form = await req.formData();
  const action = String(form.get("action") ?? "create-title");
  const admin = createAdminClient();

  if (action === "create-title") {
    const kind = String(form.get("kind")); // "movie" | "series"
    const title = String(form.get("title") ?? "").trim();
    const category = String(form.get("category") ?? "General").trim();
    const description = String(form.get("description") ?? "").trim();
    const poster = form.get("poster") as File | null;
    const video = form.get("video") as File | null; // movies only
    const video480 = form.get("video480") as File | null; // optional low-res rendition

    if (!title || (kind !== "movie" && kind !== "series")) {
      return NextResponse.json({ error: "Title and a valid kind are required." }, { status: 400 });
    }
    if (kind === "movie" && (!video || video.size === 0)) {
      return NextResponse.json({ error: "A video file is required for movies." }, { status: 400 });
    }

    const base = `${slug(title)}-${Date.now()}`;
    let posterPath: string | null = null;
    let videoPath: string | null = null;
    let video480Path: string | null = null;

    if (poster && poster.size > 0) {
      posterPath = `${base}/poster${extOf(poster.name)}`;
      const { error } = await admin.storage.from("posters").upload(posterPath, poster, {
        contentType: poster.type,
        upsert: true,
      });
      if (error) return NextResponse.json({ error: `Poster upload failed: ${error.message}` }, { status: 500 });
    }

    if (kind === "movie" && video) {
      videoPath = `${base}/1080p${extOf(video.name)}`;
      const { error } = await admin.storage.from(VIDEO_BUCKET).upload(videoPath, video, {
        contentType: video.type,
        upsert: true,
      });
      if (error) return NextResponse.json({ error: `Video upload failed: ${error.message}` }, { status: 500 });

      if (video480 && video480.size > 0) {
        video480Path = `${base}/480p${extOf(video480.name)}`;
        const { error: err480 } = await admin.storage.from(VIDEO_BUCKET).upload(video480Path, video480, {
          contentType: video480.type,
          upsert: true,
        });
        if (err480) {
          return NextResponse.json({ error: `480p upload failed: ${err480.message}` }, { status: 500 });
        }
      }
    }

    const { data, error } = await admin
      .from("titles")
      .insert({
        kind,
        title,
        category,
        description,
        poster_path: posterPath,
        video_path: videoPath,
        video_path_480: video480Path,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ title: data });
  }

  if (action === "add-episode") {
    const titleId = String(form.get("titleId") ?? "");
    const season = Number(form.get("season") ?? 1);
    const episodeNumber = Number(form.get("episodeNumber") ?? 1);
    const name = String(form.get("name") ?? "").trim();
    const video = form.get("video") as File | null;
    const video480 = form.get("video480") as File | null;

    if (!titleId || !name || !video || video.size === 0) {
      return NextResponse.json({ error: "titleId, name and a video file are required." }, { status: 400 });
    }

    const base = `${titleId}/s${season}e${episodeNumber}-${Date.now()}`;
    const videoPath = `${base}/1080p${extOf(video.name)}`;
    const { error } = await admin.storage.from(VIDEO_BUCKET).upload(videoPath, video, {
      contentType: video.type,
      upsert: true,
    });
    if (error) return NextResponse.json({ error: `Video upload failed: ${error.message}` }, { status: 500 });

    let video480Path: string | null = null;
    if (video480 && video480.size > 0) {
      video480Path = `${base}/480p${extOf(video480.name)}`;
      const { error: err480 } = await admin.storage.from(VIDEO_BUCKET).upload(video480Path, video480, {
        contentType: video480.type,
        upsert: true,
      });
      if (err480) return NextResponse.json({ error: `480p upload failed: ${err480.message}` }, { status: 500 });
    }

    const { data, error: insertError } = await admin
      .from("episodes")
      .insert({
        title_id: titleId,
        season,
        episode_number: episodeNumber,
        name,
        video_path: videoPath,
        video_path_480: video480Path,
      })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ episode: data });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

function extOf(filename: string) {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx) : "";
}
