export type PlanTier = "free" | "premium";
export type AppRole = "viewer" | "admin";
export type TitleKind = "movie" | "series";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  created_at: string;
}

export interface Title {
  id: string;
  kind: TitleKind;
  title: string;
  description: string;
  category: string;
  poster_path: string | null;
  video_path: string | null; // movies only, 1080p master
  video_path_480: string | null; // movies only, optional low-res rendition
  duration_seconds: number | null; // movies only
  created_by: string | null;
  created_at: string;
}

export interface Episode {
  id: string;
  title_id: string;
  season: number;
  episode_number: number;
  name: string;
  video_path: string;
  video_path_480: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface WatchEvent {
  id: string;
  user_id: string;
  title_id: string;
  episode_id: string | null;
  seconds_watched: number;
  last_watched_at: string;
}

export interface Comment {
  id: string;
  title_id: string;
  user_id: string;
  body: string;
  rating: number | null;
  created_at: string;
  profiles?: { display_name: string | null };
}

// Minimal Supabase Database type. Expand with `supabase gen types typescript`
// once the schema is deployed, for full query type-safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
