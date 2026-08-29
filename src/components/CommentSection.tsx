"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RatingStars from "./RatingStars";
import type { Comment, Profile } from "@/lib/types";

export default function CommentSection({ titleId }: { titleId: string }) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(display_name)")
      .eq("title_id", titleId)
      .order("created_at", { ascending: false });
    setComments((data as Comment[] | null) ?? []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadComments();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile((data as Profile) ?? null);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) return;
    setPosting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to leave a review.");
      setPosting(false);
      return;
    }
    const { error } = await supabase.from("comments").insert({
      title_id: titleId,
      user_id: user.id,
      body: body.trim(),
      rating: rating || null,
    });
    setPosting(false);
    if (error) {
      setError("Only Premium members can post reviews.");
      return;
    }
    setBody("");
    setRating(0);
    loadComments();
  }

  const canPost = profile?.plan === "premium";

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl tracking-widest2 text-paper">Reviews</h2>

      {!loading && (
        <div className="mt-4">
          {canPost ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-reel-700 bg-reel-900 p-4">
              <RatingStars value={rating} onChange={setRating} />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your thoughts…"
                maxLength={2000}
                rows={3}
                className="rounded-md border border-reel-600 bg-reel-950 px-3 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-marquee focus:outline-none"
              />
              {error && <p className="text-sm text-signal-red">{error}</p>}
              <button
                type="submit"
                disabled={posting || !body.trim()}
                className="self-start rounded-md bg-marquee px-4 py-1.5 text-sm font-semibold text-reel-950 transition hover:bg-marquee-bright disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post review"}
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-reel-700 bg-reel-900 p-4 text-sm text-paper/60">
              Reviews and ratings are a Premium perk.{" "}
              <Link href="/pricing" className="text-marquee hover:underline">
                Upgrade to Premium
              </Link>{" "}
              to leave one.
            </p>
          )}
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {comments.map((c) => (
          <li key={c.id} className="border-b border-reel-800 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-paper">
                {c.profiles?.display_name ?? "Member"}
              </span>
              {c.rating && <RatingStars value={c.rating} size="sm" />}
            </div>
            <p className="mt-1 text-sm text-paper/70">{c.body}</p>
          </li>
        ))}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-paper/40">No reviews yet — be the first.</p>
        )}
      </ul>
    </section>
  );
}
