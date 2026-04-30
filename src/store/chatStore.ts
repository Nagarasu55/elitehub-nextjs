import { create } from "zustand";
import type { Conversation, Message } from "../types/chats";

interface ChatStore {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];

  setConversations: (convs: Conversation[]) => void;
  setActiveConversation: (conv: Conversation | null) => void;
  resetChat: () => void;

  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;


  updateConversationToTop: (conversationId: number, lastMessageAt: string) => void;

  deleteMessageForMe: (messageId: number) => void;
  deleteMessageForEveryone: (messageId: number) => void;
  editMessage: (messageId: number, newBody: string) => void;

  // ✅ These must update by real DB id — works correctly after replacement
  updateMessageDelivered: (messageId: number) => void;
  updateMessageRead: (messageId: number) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],

  setConversations: (convs) => set({ conversations: convs }),

  setActiveConversation: (conv) => set({ activeConversation: conv }),

  resetChat: () =>
    set({ conversations: [], activeConversation: null, messages: [] }),

  setMessages: (msgs) => set({ messages: msgs }),

  // ✅ In chatStore — addMessage should be:
addMessage: (msg) =>
    set((state) => ({
        messages: state.messages.some((m) => m.id === msg.id)
            ? state.messages          // dedup guard — don't add if already exists
            : [...state.messages, msg],
    })),



  updateConversationToTop: (conversationId, lastMessageAt) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conversationId);
      if (idx === -1) return state;
      const updated = [...state.conversations];
      const [conv] = updated.splice(idx, 1);
      return {
        conversations: [{ ...conv, last_message_at: lastMessageAt }, ...updated],
      };
    }),

  deleteMessageForMe: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_deleted_for_me: true } : m
      ),
    })),

  deleteMessageForEveryone: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_deleted_for_everyone: true, body: null, file_urls: [] } : m
      ),
    })),

  editMessage: (messageId, newBody) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, body: newBody, is_edited: true } : m
      ),
    })),

  // ✅ Uses real DB id — works correctly once optimistic message is replaced
  updateMessageDelivered: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_delivered: true } : m
      ),
    })),

  updateMessageRead: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m
      ),
    })),
}));