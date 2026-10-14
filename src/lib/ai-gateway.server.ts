// Server-only: Lovable AI Gateway helpers for game analysis.
// Never import this module from client code — analysis.functions.ts loads it
// dynamically inside its handler.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, jsonSchema, NoObjectGeneratedError } from "ai";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      const minted = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim();
      if (!runId && minted) runId = minted;
      return response;
    },
    getRunId: () => runId,
  };
}

export interface AnalysisTip {
  title: string;
  body: string;
}

export interface AnalysisResult {
  summary: string;
  tips: AnalysisTip[];
}

const analysisSchema = jsonSchema<AnalysisResult>({
  type: "object",
  additionalProperties: false,
  required: ["summary", "tips"],
  properties: {
    summary: { type: "string", description: "2-3 sentence overview of how the game went." },
    tips: {
      type: "array",
      description: "3 to 5 personalised strategy tips.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: {
          title: { type: "string", description: "Short tip headline, under 8 words." },
          body: { type: "string", description: "1-3 concrete sentences referencing actual moves." },
        },
      },
    },
  },
});

function buildInstructions(viewerMark: string): string {
  return [
    "You are a sharp, encouraging tactics coach for Tic-Tac-Toe, Ultimate Tic-Tac-Toe and the Plus variants.",
    "Analyse the finished game below from the point of view of the player using mark " + viewerMark + " (the person requesting tips).",
    "Be concrete: reference move numbers, boards and cells, missed wins or missed blocks, and good or poor board-target choices.",
    "The summary is at most 3 sentences. Give exactly 3 to 5 tips; each title under 8 words, each body 1-3 sentences.",
    "Never invent moves that are not in the move list. Explain how the lost or drawn game could have gone differently, or how a win was secured.",
  ].join(" ");
}

function cellLabel(i: number, size: number): string {
  const cols = "ABCDEFGHIJ";
  return `${cols[i % size]}${Math.floor(i / size) + 1}`;
}

export async function runGameAnalysis(opts: {
  modeName: string;
  modeRules: string;
  viewerMark: string;
  opponentName: string;
  outcome: string;
  size: number;
  moves: { p: string; b: number; c: number }[];
  signal?: AbortSignal | undefined;
}): Promise<AnalysisResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured yet. Please try again later.");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const moveLines = opts.moves
    .map((m, i) => `${i + 1}. ${m.p}: ${opts.size > 3 ? `board ${m.b + 1}, ` : ""}cell ${cellLabel(m.c, opts.size)}`)
    .join("\n");

  const userContent = [
    `Game: ${opts.modeName}`,
    `Rules: ${opts.modeRules}`,
    opts.size > 3 ? "Note: every game here is a single board; board 1 is the whole board." : "Note: there are 9 small boards; the move's board is which small board the cell sits in.",
    `Result: ${opts.outcome} (analysing player ${opts.viewerMark}'s perspective; opponent ${opts.opponentName}).`,
    "Moves in order:",
    moveLines,
  ].join("\n");

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: buildInstructions(opts.viewerMark),
    messages: [{ role: "user", content: userContent }],
    ...(opts.signal ? { abortSignal: opts.signal } : {}),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
    output: Output.object({ schema: analysisSchema }),
  });

  let parsed: unknown;
  try {
    parsed = await result.output;
  } catch (error) {
    if (error instanceof NoObjectGeneratedError && typeof error.text === "string") {
      try {
        parsed = JSON.parse(error.text);
      } catch {
        throw new Error("The coach could not read that game. Try again.");
      }
    } else {
      throw error;
    }
  }

  const r = (parsed ?? {}) as Partial<AnalysisResult>;
  const tips = (Array.isArray(r.tips) ? r.tips : [])
    .slice(0, 5)
    .map((t) => ({ title: String(t?.title ?? "Tip").slice(0, 80), body: String(t?.body ?? "").trim() }))
    .filter((t) => t.body.length > 0);
  if (!r.summary && tips.length === 0) throw new Error("The coach returned nothing useful. Try again.");
  return { summary: String(r.summary ?? "").trim(), tips };
}
