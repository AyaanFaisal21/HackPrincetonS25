export interface Message {
  speaker: string;
  content: string;
  timestamp: string; // ISO string
}

export interface MemoryResult {
  content: string;
  speakers: string[];
  startTime: string;
  endTime: string;
  relevanceScore: number;
}

export async function ingest(
  chatId: string,
  messages: Message[]
): Promise<void> {
  void chatId;
  void messages;
}

export async function retrieve(
  chatId: string,
  query: string,
  topK: number = 3
): Promise<MemoryResult[]> {
  void chatId;
  void query;
  void topK;
  return [];
}

export async function reset(chatId: string): Promise<void> {
  void chatId;
}
