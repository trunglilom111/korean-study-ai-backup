import { createHash } from "node:crypto";

export const TOPIK_AI_PROMPT_VERSION = "topik-master-v1";
export const TOPIK_AI_MODEL = process.env.TOPIK_GEMINI_MODEL || "gemini-3.6-flash";
export const TOPIK_AI_DAILY_LIMIT = Math.max(1, Number(process.env.TOPIK_AI_DAILY_LIMIT) || 40);
export const TOPIK_AI_TIMEOUT_MS = Math.max(5_000, Number(process.env.TOPIK_AI_TIMEOUT_MS) || 25_000);

export function createAiCacheKey(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function runAiWithRetry<T>(operation: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("Gemini request timed out.")), TOPIK_AI_TIMEOUT_MS); }),
      ]);
    } catch (error: unknown) {
      lastError = error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

export function aiUsageSnapshot(usage: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number } | undefined) {
  const inputTokens = usage?.total_input_tokens || 0;
  const outputTokens = usage?.total_output_tokens || 0;
  const thoughtTokens = usage?.total_thought_tokens || 0;
  const inputRate = Number(process.env.TOPIK_AI_INPUT_USD_PER_MILLION) || 0;
  const outputRate = Number(process.env.TOPIK_AI_OUTPUT_USD_PER_MILLION) || 0;
  return {
    inputTokens,
    outputTokens,
    thoughtTokens,
    estimatedCostUsd: inputRate || outputRate ? (inputTokens * inputRate + (outputTokens + thoughtTokens) * outputRate) / 1_000_000 : null,
  };
}

export function deterministicWritingMetrics(text: string) {
  const normalized = text.normalize("NFC").trim();
  const tokens = normalized.match(/[가-힣]+/g) || [];
  const uniqueTokens = new Set(tokens);
  const paragraphs = normalized.split(/\n\s*\n/).filter(Boolean).length || (normalized ? 1 : 0);
  const sentences = normalized.split(/[.!?。]|(?:습니다|어요|예요|이다|한다)(?:\s|$)/).filter((part) => part.trim().length > 0).length;
  const connectors = (normalized.match(/그러나|따라서|반면에|또한|왜냐하면|그러므로|한편|결론적으로/g) || []).length;
  const koreanCharacters = (normalized.match(/[가-힣]/g) || []).length;
  return {
    characterCount: normalized.length,
    koreanCharacters,
    tokenCount: tokens.length,
    uniqueTokenCount: uniqueTokens.size,
    lexicalDiversity: tokens.length ? Math.round((uniqueTokens.size / tokens.length) * 100) : 0,
    paragraphCount: paragraphs,
    sentenceCount: sentences,
    connectorCount: connectors,
  };
}
