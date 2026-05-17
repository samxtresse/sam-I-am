// Manual tool-use loop with the Anthropic SDK. The user spec caps it at 10
// rounds (MAX_TOOL_ROUNDS); we expose that as a const so other callers can
// share the limit.
//
// In stub mode (no ANTHROPIC_API_KEY) the agent returns a canned echo so the
// chat UI still renders an end-to-end turn.

import Anthropic from "@anthropic-ai/sdk";
import { env, isStub } from "./env";
import { TOOLS, toolByName } from "./tools";
import { memorySummary } from "./tools/memory";
import { audit } from "./audit";

export const MAX_TOOL_ROUNDS = 10;

export type ChatMessage = Anthropic.MessageParam;

const client = env.anthropic.apiKey ? new Anthropic({ apiKey: env.anthropic.apiKey }) : null;

function buildSystemPrompt(memory: string) {
  const today = new Date().toISOString();
  return [
    `You are ${env.owner.name}'s personal AI secretary. Owner email: ${env.owner.email}.`,
    `Current time: ${today}. Default timezone: America/Los_Angeles.`,
    "",
    "## Operating principles",
    "- Be efficient and direct. Prefer doing over asking.",
    "- When Sam asks about his schedule, email, or todos, use the relevant tool — don't guess.",
    "- For meeting booking: use propose_meeting (drafts the email + routes through allowlist/approvals). Never call create_calendar_event before the recipient agrees on a time.",
    "- Save useful facts about people, preferences, and decisions to memory so future turns benefit.",
    "- After a meeting recap, always save_meeting_notes — Sam's action items will surface as TODOs.",
    "",
    "## Long-term memory (recent items)",
    memory,
  ].join("\n");
}

type AgentTurnResult = {
  reply: string;
  rounds: number;
  toolCalls: { name: string; input: unknown }[];
};

function stubReply(history: ChatMessage[]): AgentTurnResult {
  let last: ChatMessage | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      last = history[i];
      break;
    }
  }
  const text =
    typeof last?.content === "string"
      ? last.content
      : Array.isArray(last?.content)
        ? (last?.content.find((b) => b.type === "text") as { text?: string } | undefined)?.text ?? ""
        : "";
  return {
    reply: `[stub mode — no ANTHROPIC_API_KEY] I heard: "${text}". Wire up ANTHROPIC_API_KEY to enable the live agent.`,
    rounds: 0,
    toolCalls: [],
  };
}

export async function runAgentTurn(history: ChatMessage[]): Promise<AgentTurnResult> {
  if (!client || isStub("anthropic")) {
    const result = stubReply(history);
    void audit({ kind: "agent_turn", name: "stub", output: { reply: result.reply } });
    return result;
  }

  const turnStart = Date.now();
  const memory = await memorySummary().catch(() => "(memory unavailable)");
  const system = buildSystemPrompt(memory);

  const messages: ChatMessage[] = [...history];
  const toolCalls: { name: string; input: unknown }[] = [];

  const apiTools: Anthropic.Tool[] = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      tools: apiTools,
      messages,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const reply = textBlocks.map((b) => b.text).join("\n\n").trim();
      void audit({
        kind: "agent_turn",
        name: env.anthropic.model,
        output: { reply, rounds: round, tool_calls: toolCalls },
        duration_ms: Date.now() - turnStart,
      });
      return { reply, rounds: round, toolCalls };
    }

    if (response.stop_reason !== "tool_use") {
      return {
        reply: `[secretary stopped: ${response.stop_reason ?? "unknown"}]`,
        rounds: round,
        toolCalls,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      toolCalls.push({ name: use.name, input: use.input });
      const tool = toolByName(use.name);
      if (!tool) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify({ error: `unknown tool ${use.name}` }),
          is_error: true,
        });
        continue;
      }
      const callStart = Date.now();
      try {
        const out = await tool.handler((use.input ?? {}) as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: use.id, content: out });
        void audit({
          kind: "tool_call",
          name: use.name,
          input: use.input,
          output: out.length > 4000 ? `${out.slice(0, 4000)}…[truncated]` : out,
          duration_ms: Date.now() - callStart,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify({ error: msg }),
          is_error: true,
        });
        void audit({
          kind: "tool_call",
          name: use.name,
          input: use.input,
          output: { error: msg },
          duration_ms: Date.now() - callStart,
        });
      }
    }

    messages.push({ role: "user", content: results });
  }

  return {
    reply: `[secretary hit the ${MAX_TOOL_ROUNDS}-round tool-use cap before finishing — try a follow-up to continue.]`,
    rounds: MAX_TOOL_ROUNDS,
    toolCalls,
  };
}
