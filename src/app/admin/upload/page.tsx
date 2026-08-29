"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

export default function AdminUploadPage() {
  return (
    <Suspense fallback={null}>
      <AdminUploadForm />
    </Suspense>
  );
}

function AdminUploadForm() {
  const searchParams = useSearchParams();
  const titleId = searchParams.get("titleId");

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/admin" className="text-xs text-paper/50 hover:text-marquee">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-3xl tracking-widest2 text-paper">
        {titleId ? "Add episode" : "New title"}
      </h1>

      {titleId ? <AddEpisodeForm titleId={titleId} /> : <CreateTitleForm />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-paper/70">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-reel-600 bg-reel-900 px-3 py-2 text-paper focus:border-marquee focus:outline-none";

function CreateTitleForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"movie" | "series">("movie");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    form.set("action", "create-title");
    form.set("kind", kind);

    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (kind === "series") {
      router.push(`/admin/upload?titleId=${data.title.id}`);
    } else {
      router.push(`/title/${data.title.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" encType="multipart/form-data">
      <Field label="Type">
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-paper">
            <input
              type="radio"
              name="kind-picker"
              checked={kind === "movie"}
              onChange={() => setKind("movie")}
            />
            Movie
          </label>
          <label className="flex items-center gap-2 text-paper">
            <input
              type="radio"
              name="kind-picker"
              checked={kind === "series"}
              onChange={() => setKind("series")}
            />
            Series
          </label>
        </div>
      </Field>

      <Field label="Title">
        <input name="title" required className={inputClass} />
      </Field>
      <Field label="Category">
        <input name="category" required placeholder="Drama, Comedy, Documentary…" className={inputClass} />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={4} required className={inputClass} />
      </Field>
      <Field label="Poster image (optional)">
        <input type="file" name="poster" accept="image/*" className={inputClass} />
      </Field>

      {kind === "movie" && (
        <>
          <Field label="Video file (1080p master)">
            <input type="file" name="video" accept="video/*" required className={inputClass} />
          </Field>
          <Field label="480p rendition (optional — enables real quality capping for free accounts)">
            <input type="file" name="video480" accept="video/*" className={inputClass} />
          </Field>
        </>
      )}

      {kind === "series" && (
        <p className="rounded-md border border-reel-700 bg-reel-900 p-3 text-xs text-paper/60">
          Save the series first, then you&apos;ll add episodes one at a time on the next screen.
        </p>
      )}

      {error && <p className="text-sm text-signal-red">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-marquee px-4 py-2 font-semibold text-reel-950 transition hover:bg-marquee-bright disabled:opacity-50"
      >
        {submitting ? "Uploading…" : kind === "series" ? "Save & add episodes" : "Publish"}
      </button>
    </form>
  );
}

function AddEpisodeForm({ titleId }: { titleId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    form.set("action", "add-episode");
    form.set("titleId", titleId);

    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setAdded((n) => n + 1);
    setFormKey((k) => k + 1); // reset the file inputs for the next episode
  }

  return (
    <>
      {added > 0 && (
        <p className="mt-4 rounded-md border border-marquee/40 bg-reel-900 p-3 text-sm text-marquee">
          {added} episode{added > 1 ? "s" : ""} added so far.
        </p>
      )}
      <form
        key={formKey}
        onSubmit={handleSubmit}
        className="mt-6 flex flex-col gap-4"
        encType="multipart/form-data"
      >
        <div className="flex gap-4">
          <Field label="Season">
            <input type="number" name="season" min={1} defaultValue={1} required className={inputClass} />
          </Field>
          <Field label="Episode #">
            <input
              type="number"
              name="episodeNumber"
              min={1}
              defaultValue={added + 1}
              required
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Episode name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="Video file (1080p master)">
          <input type="file" name="video" accept="video/*" required className={inputClass} />
        </Field>
        <Field label="480p rendition (optional)">
          <input type="file" name="video480" accept="video/*" className={inputClass} />
        </Field>

        {error && <p className="text-sm text-signal-red">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-marquee px-4 py-2 font-semibold text-reel-950 transition hover:bg-marquee-bright disabled:opacity-50"
          >
            {submitting ? "Uploading…" : "Add episode"}
          </button>
          <Link
            href={`/title/${titleId}`}
            className="rounded-md border border-reel-600 px-4 py-2 text-paper/70 hover:border-marquee hover:text-marquee"
          >
            Done — view title
          </Link>
        </div>
      </form>
    </>
  );
}
