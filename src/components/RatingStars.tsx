"use client";

export default function RatingStars({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
}) {
  const interactive = Boolean(onChange);
  const starSize = size === "sm" ? "text-base" : "text-2xl";

  return (
    <div className="flex gap-0.5" role={interactive ? "radiogroup" : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          role={interactive ? "radio" : undefined}
          aria-checked={interactive ? value === n : undefined}
          onClick={() => onChange?.(n)}
          className={`${starSize} ${interactive ? "cursor-pointer" : "cursor-default"} ${
            n <= value ? "text-marquee" : "text-reel-600"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
