import SearchBar from "@/components/SearchBar";

export default function LandingPage() {
  return (
    <div className="grain relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-reel-950 via-reel-950/70 to-reel-950" />

      <div className="relative flex flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-widest2 text-marquee-dim">
          Now Showing
        </p>
        <h1 className="font-display text-5xl tracking-widest2 text-paper sm:text-7xl">
          Find your <span className="text-marquee">next watch</span>
        </h1>
        <p className="max-w-md text-paper/60">
          Search the vault of films and series. Free to start — upgrade to Premium
          for full episodes, whole movies, and 1080p.
        </p>

        <SearchBar autoFocus />

        <p className="text-xs text-paper/40">
          Free accounts can watch 2 episodes per series or 20 minutes of any movie in 480p.
        </p>
      </div>
    </div>
  );
}
