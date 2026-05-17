import { runMorningBrief } from "@/lib/morning-brief";

type Input = Record<string, unknown>;

export async function morningBrief(input: Input): Promise<string> {
  const send = input.send === true;
  const result = await runMorningBrief({ send });
  // Return the composed text directly so the agent can paste/quote it
  // into chat. The `sent` metadata is included for transparency.
  return JSON.stringify({
    brief: result.composed,
    sent: result.sent,
  });
}
