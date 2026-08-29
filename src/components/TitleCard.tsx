import Link from "next/link";
import type { Title } from "@/lib/types";

export default function TitleCard({
  posterUrl,
  title,
}: {
  posterUrl: string | null;
  title: Title;
}) {
  return (
    <Link
      href={`/title/${title.id}`}
      className="group flex flex-col gap-2 outline-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-reel-700 bg-reel-800 transition group-hover:border-marquee group-focus-visible:border-marquee">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center font-display text-lg tracking-wide text-paper/40">
            {title.title}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded bg-reel-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-marquee">
          {title.kind}
        </span>
      </div>
      <div>
        <h3 className="truncate font-body text-sm font-medium text-paper group-hover:text-marquee">
          {title.title}
        </h3>
        <p className="truncate text-xs text-paper/50">{title.category}</p>
      </div>
    </Link>
  );
}
