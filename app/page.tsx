import Link from "next/link";
import { integrationStatus } from "@/lib/env";

const FEATURES = [
  {
    href: "/secretary",
    title: "Secretary",
    blurb:
      "Personal AI secretary — chat with Claude, calendar, email, booking, meeting notes, cross-conversation memory.",
    status: "v1 — boots in stub mode",
  },
  {
    href: "/secretary/approvals",
    title: "Pending approvals",
    blurb:
      "Booking-outreach drafts the secretary couldn't auto-send. Review, edit, and approve in one click.",
  },
  {
    href: "/secretary/notes",
    title: "Meeting notes",
    blurb: "Stored meeting summaries, attendees, and action items — searchable.",
  },
];

export default function HubHome() {
  const anthropic = integrationStatus("anthropic");
  const supabase = integrationStatus("supabase");
  const google = integrationStatus("google");
  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h1 className="display text-3xl md:text-4xl">Sam's hub</h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">
          Personal command center. Secretary is the first inhabitant — chat with Claude across
          calendar, email, memory, and meeting notes. Everything boots in stub mode without keys.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={`tag ${anthropic === "live" ? "tag-live" : "tag-stub"}`}>
            Anthropic: {anthropic}
          </span>
          <span className={`tag ${supabase === "live" ? "tag-live" : "tag-stub"}`}>
            Supabase: {supabase}
          </span>
          <span className={`tag ${google === "live" ? "tag-live" : "tag-stub"}`}>
            Google: {google}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="card p-5 hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-center justify-between">
              <h2 className="display text-xl">{f.title}</h2>
              {f.status ? <span className="tag tag-stub">{f.status}</span> : null}
            </div>
            <p className="mt-2 text-sm text-ink-muted">{f.blurb}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
