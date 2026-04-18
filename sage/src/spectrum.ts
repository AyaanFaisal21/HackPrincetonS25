export interface SpectrumEvent {
  sender: string;
  text: string;
  chatId: string;
  timestamp: string;
}

export async function onMessage(event: SpectrumEvent): Promise<void> {
  void event;
}

export async function send(chatId: string, content: string): Promise<void> {
  void chatId;
  void content;
}
