import type { PlanTier } from "./types";

// ----------------------------------------------------------------------------
// Single source of truth for plan limits. Change these numbers here only —
// every server route and client component reads from this file so the rule
// is enforced consistently (and, importantly, the enforcement that actually
// matters — signed URL issuance — lives server-side in the API routes).
// ----------------------------------------------------------------------------
export const PLAN_LIMITS = {
  free: {
    maxQuality: "480p" as const,
    freeEpisodesPerSeries: 2,
    freeMovieSeconds: 20 * 60, // 20 minutes
  },
  premium: {
    maxQuality: "1080p" as const,
    freeEpisodesPerSeries: Infinity,
    freeMovieSeconds: Infinity,
  },
} satisfies Record<PlanTier, { maxQuality: "480p" | "1080p"; freeEpisodesPerSeries: number; freeMovieSeconds: number }>;

export function maxQualityFor(plan: PlanTier): "480p" | "1080p" {
  return PLAN_LIMITS[plan].maxQuality;
}

/**
 * Decides whether a signed-in (or guest) user may play a given episode,
 * given how many *distinct* episodes of this series they have already
 * started watching.
 *
 * `watchedEpisodeIds` should be the distinct episode ids the user has an
 * existing watch_events row for, for this title, EXCLUDING the episode
 * being requested (so re-watching an already-unlocked episode never counts
 * against the limit twice).
 */
export function canPlayEpisode(params: {
  plan: PlanTier;
  episodeId: string;
  watchedEpisodeIds: string[];
}): { allowed: boolean; reason?: string } {
  const { plan, episodeId, watchedEpisodeIds } = params;
  const limit = PLAN_LIMITS[plan].freeEpisodesPerSeries;

  if (watchedEpisodeIds.includes(episodeId)) {
    return { allowed: true };
  }
  if (watchedEpisodeIds.length < limit) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Free accounts can watch ${PLAN_LIMITS.free.freeEpisodesPerSeries} episodes per series. Upgrade to Premium for the full series.`,
  };
}

/**
 * Decides how many seconds of a movie a user is allowed to stream.
 * Returns Infinity for premium. For free/guest, returns the 20-minute cap.
 * The actual cutoff is enforced two ways: the client player pauses and
 * shows an upgrade prompt at this timestamp, AND signed URLs for movies
 * are short-lived so a determined user can't just seek past a paused player.
 */
export function movieSecondsAllowed(plan: PlanTier): number {
  return PLAN_LIMITS[plan].freeMovieSeconds;
}

export function canComment(plan: PlanTier): boolean {
  return plan === "premium";
}

/** Storage path to use for playback, honoring the plan's max quality. */
export function pickVideoPath(params: {
  plan: PlanTier;
  masterPath: string; // 1080p
  lowResPath: string | null; // 480p, may not exist yet for older uploads
}): string {
  const { plan, masterPath, lowResPath } = params;
  if (maxQualityFor(plan) === "1080p") return masterPath;
  return lowResPath ?? masterPath; // fall back to master if no 480p rendition uploaded
}
