export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  image?: string;
}

export type ChatMode = "chat" | "agent";

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
}

export interface ChatRequest {
  message: string;
  provider: string;
  model: string;
}

export type Provider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "google"
  | "ollama";

export interface AppConfig {
  provider?: string;
  api_key?: string;
  chat_url?: string;
  model_name?: string;
  proxy?: boolean;
  support_tool?: boolean;
}
