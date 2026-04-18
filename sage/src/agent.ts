import type { Message, MemoryResult } from "./memory.js";

export type { Message, MemoryResult };

export interface ClassifyResult {
  intervene: boolean;
  retrievedContext: MemoryResult[];
  anchorId: string | null;
}

export async function classify(
  chatId: string,
  currentMessage: Message
): Promise<ClassifyResult> {
  void chatId;
  void currentMessage;
  return { intervene: false, retrievedContext: [], anchorId: null };
}

export async function respond(
  chatId: string,
  context: MemoryResult[],
  currentMessage: Message
): Promise<string> {
  void chatId;
  void context;
  void currentMessage;
  return "";
}
