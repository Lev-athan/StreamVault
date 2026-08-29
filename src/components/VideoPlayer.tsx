"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const HEARTBEAT_SECONDS = 15;

export default function VideoPlayer({
  src,
  titleId,
  episodeId,
  capSeconds,
  maxQuality,
  posterUrl,
}: {
  src: string;
  titleId: string;
  episodeId: string | null;
  capSeconds: number | null; // free-tier movie limit, null = no cap (premium or series)
  maxQuality: "480p" | "1080p";
  posterUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cutoff, setCutoff] = useState(false);
  const lastReported = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function reportProgress(seconds: number) {
      lastReported.current = seconds;
      fetch("/api/watch-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, episodeId, secondsWatched: Math.floor(seconds) }),
        keepalive: true,
      }).catch(() => {});
    }

    function handleTimeUpdate() {
      if (!video) return;
      if (capSeconds != null && video.currentTime >= capSeconds) {
        video.pause();
        setCutoff(true);
        reportProgress(capSeconds);
        return;
      }
      if (video.currentTime - lastReported.current >= HEARTBEAT_SECONDS) {
        reportProgress(video.currentTime);
      }
    }

    function handlePause() {
      if (video) reportProgress(video.currentTime);
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
    };
  }, [capSeconds, titleId, episodeId]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-reel-700 bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        poster={posterUrl ?? undefined}
        className="aspect-video w-full"
      />
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-reel-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-marquee">
        {maxQuality}
      </span>

      {cutoff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-reel-950/95 px-6 text-center">
          <p className="font-display text-2xl tracking-widest2 text-marquee">
            That&apos;s the free preview
          </p>
          <p className="max-w-sm text-sm text-paper/70">
            Free accounts can watch 20 minutes of any movie. Upgrade to Premium to watch the rest.
          </p>
          <Link
            href="/pricing"
            className="rounded-md bg-marquee px-5 py-2 font-semibold text-reel-950 transition hover:bg-marquee-bright"
          >
            Upgrade to Premium
          </Link>
        </div>
      )}
    </div>
  );
}
