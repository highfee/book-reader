export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface AICompanionRequest {
  bookTitle: string;
  author: string;
  currentPage: number;
  totalPages: number;
  extractedContextSoFar: string;
  userPrompt: string;
  history: ChatMessage[];
}

export class GeminiAICompanionService {
  private static backendProxyUrl: string | null = null;

  static setProxyUrl(url: string) {
    this.backendProxyUrl = url;
  }

  /**
   * Generates a spoiler-safe recap of reading progress up to the current page.
   */
  static async generateProgressRecap(
    bookTitle: string,
    author: string,
    currentPage: number,
    totalPages: number,
    contextSoFar: string
  ): Promise<string> {
    const prompt = `Provide a concise 2 to 4 sentence recap of what has occurred in "${bookTitle}" by ${author} up to page ${currentPage}. Do NOT mention any events after page ${currentPage}.`;

    return await this.sendPromptToAI({
      bookTitle,
      author,
      currentPage,
      totalPages,
      extractedContextSoFar: contextSoFar,
      userPrompt: prompt,
      history: [],
    });
  }

  /**
   * Sends a spoiler-safe question to the AI reading companion.
   */
  static async sendChatMessage(
    request: AICompanionRequest
  ): Promise<string> {
    return await this.sendPromptToAI(request);
  }

  /**
   * Internal proxy dispatcher.
   * Sends request to backend proxy (Appwrite function or cloud endpoint).
   * Falls back to high-fidelity contextual simulation if offline / demo mode.
   */
  private static async sendPromptToAI(req: AICompanionRequest): Promise<string> {
    // If backend proxy is configured, call it
    if (this.backendProxyUrl) {
      try {
        const response = await fetch(`${this.backendProxyUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });
        if (response.ok) {
          const json = await response.json();
          return json.reply;
        }
      } catch (err) {
        console.warn('Backend AI proxy unavailable, using local assistant fallback:', err);
      }
    }

    // Honest offline message: do not fabricate simulated responses
    return `[AI Companion Offline]\nNo Gemini API key or proxy is configured. To enable live, spoiler-safe AI discussions about "${req.bookTitle}", please add your Gemini API key in Settings.`;
  }
}
