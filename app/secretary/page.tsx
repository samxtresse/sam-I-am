import { SecretaryChat } from "@/components/chat/secretary-chat";
import { integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SecretaryHome() {
  const anthropic = integrationStatus("anthropic");
  const google = integrationStatus("google");
  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-2xl">Secretary</h1>
          <p className="text-sm text-ink-muted">
            Calendar, email, memory, meeting notes — ask me anything.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`tag ${anthropic === "live" ? "tag-live" : "tag-stub"}`}>
            Anthropic: {anthropic}
          </span>
          <span className={`tag ${google === "live" ? "tag-live" : "tag-stub"}`}>
            Google: {google}
          </span>
        </div>
      </div>
      <SecretaryChat />
    </div>
  );
}
