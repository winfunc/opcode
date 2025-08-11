import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";
import { useConversationStore } from "./useConversationStore";

interface ChatStore {
  inputMessage: string;
  isLoading: boolean;
  setInputMessage: (msg: string) => void;
  addFileContent: (
    fileName: string,
    content: string,
    selectedText?: string,
  ) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
}

// Custom hook to get current messages with proper reactivity
export const useCurrentMessages = () => {
  const currentConversation = useConversationStore((state) =>
    state.conversations.find((c) => c.id === state.currentConversationId),
  );
  return currentConversation?.messages || [];
};

export const useChatStore = create<ChatStore>((set) => ({
  inputMessage: "",
  isLoading: false,

  setInputMessage: (msg: string) => set({ inputMessage: msg }),

  addFileContent: (
    fileName: string,
    content: string,
    selectedText?: string,
  ) => {
    const textToAdd = selectedText || content;
    const prefix = selectedText
      ? `Selected content from ${fileName}:`
      : `File content from ${fileName}:`;
    const message = `${prefix}\n\n${textToAdd}`;
    set({ inputMessage: message });
  },

  addMessage: (message: ChatMessage) => {
    const conversationStore = useConversationStore.getState();
    let currentId = conversationStore.currentConversationId;

    // Create new conversation if none exists
    if (!currentId) {
      currentId = conversationStore.createConversation();
    }

    conversationStore.addMessage(currentId, message);
  },

  updateLastMessage: (content: string) => {
    const conversationStore = useConversationStore.getState();
    const currentId = conversationStore.currentConversationId;

    if (currentId) {
      conversationStore.updateLastMessage(currentId, content);
    }
  },
}));
