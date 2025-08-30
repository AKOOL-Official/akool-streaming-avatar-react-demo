import { useState, useCallback, useEffect } from 'react';
import { RTCClient } from '../agoraHelper';
import {
  MessageType,
  MessageSender,
  SystemEventType,
  UserTriggeredEventType,
  UIMessage,
} from '../types/streamingProvider';
import { formatTime, shouldShowTimeSeparator } from '../utils/messageUtils';

// Re-export for compatibility with existing components
export { MessageType, MessageSender, SystemEventType };
export type { UserTriggeredEventType };
export type Message = UIMessage;

interface UseMessageStateProps {
  client?: RTCClient | null;
  connected: boolean;
  sendMessage?: (messageId: string, content: string) => Promise<void>;
}

interface UseMessageStateReturn {
  messages: Message[];
  inputMessage: string;
  setInputMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  clearMessages: () => void;
  addMessage: (
    messageId: string,
    text: string,
    sender: MessageSender,
    messageType: MessageType,
    systemType?: SystemEventType,
    metadata?: Message['metadata'],
  ) => void;
  addChatMessage: (messageId: string, text: string, sender: MessageSender) => void;
  addSystemMessage: (
    messageId: string,
    text: string,
    systemType: SystemEventType,
    metadata?: Message['metadata'],
  ) => void;
  cleanupOldSystemMessages: () => void;
  formatTime: (timestamp: number) => string;
  shouldShowTimeSeparator: (currentMessage: Message, previousMessage: Message | undefined) => boolean;
}

export const useMessageState = ({
  client: _client,
  connected,
  sendMessage: sendMessageProp,
}: UseMessageStateProps): UseMessageStateReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Stream message handling is now done in the provider, no listener setup needed here

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !connected || sending || !sendMessageProp) return;

    setSending(true);
    const messageId = Date.now().toString();

    // Add message to local state immediately
    const newMessage: Message = {
      id: messageId,
      text: inputMessage,
      sender: MessageSender.USER,
      messageType: MessageType.CHAT,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');

    try {
      await sendMessageProp(messageId, inputMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Optionally remove the message from state if sending failed
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } finally {
      setSending(false);
    }
  }, [sendMessageProp, connected, inputMessage, sending]);

  const addMessage = useCallback(
    (
      messageId: string,
      text: string,
      sender: MessageSender,
      messageType: MessageType,
      systemType?: SystemEventType,
      metadata?: Message['metadata'],
    ) => {
      setMessages((prev) => {
        const currentTime = Date.now();
        // For system messages, always create a new message to avoid concatenation
        if (messageType === MessageType.SYSTEM) {
          return [
            ...prev,
            {
              id: `${messageId}_${currentTime}`,
              text,
              sender,
              messageType,
              systemType,
              timestamp: currentTime,
              metadata,
            },
          ];
        }

        // For regular messages, check if message already exists
        const existingMessageIndex = prev.findIndex((msg) => msg.id === messageId);
        if (existingMessageIndex !== -1) {
          // Update existing message
          const newMessages = [...prev];
          const existingMessage = newMessages[existingMessageIndex];
          newMessages[existingMessageIndex] = {
            ...existingMessage,
            text: existingMessage.text + text,
            metadata,
          };
          return newMessages;
        }
        // Add new message
        const newMessage = {
          id: messageId,
          text,
          sender,
          messageType,
          timestamp: currentTime,
          metadata,
        };
        return [...prev, newMessage];
      });
    },
    [],
  );

  const addChatMessage = useCallback(
    (messageId: string, text: string, sender: MessageSender) => {
      addMessage(messageId, text, sender, MessageType.CHAT);
    },
    [addMessage],
  );

  const addSystemMessage = useCallback(
    (messageId: string, text: string, systemType: SystemEventType, metadata?: Message['metadata']) => {
      addMessage(messageId, text, MessageSender.SYSTEM, MessageType.SYSTEM, systemType, metadata);
    },
    [addMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setInputMessage('');
  }, []);

  // Clean up old system messages to keep chat history manageable
  const cleanupOldSystemMessages = useCallback(() => {
    setMessages((prev) => {
      // Keep only the last 10 system messages and all regular messages
      const systemMessages = prev.filter((msg) => msg.messageType === MessageType.SYSTEM);
      const regularMessages = prev.filter((msg) => msg.messageType === MessageType.CHAT);

      // Keep the last 10 system messages
      const recentSystemMessages = systemMessages.slice(-10);

      return [...regularMessages, ...recentSystemMessages].sort((a, b) => {
        // Sort by the order they appeared in the original array
        const aIndex = prev.findIndex((msg) => msg.id === a.id);
        const bIndex = prev.findIndex((msg) => msg.id === b.id);
        return aIndex - bIndex;
      });
    });
  }, []);

  // Auto-cleanup system messages when there are too many
  useEffect(() => {
    if (messages.filter((msg) => msg.messageType === MessageType.SYSTEM).length > 15) {
      cleanupOldSystemMessages();
    }
  }, [messages, cleanupOldSystemMessages]);

  return {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    clearMessages,
    addMessage,
    addChatMessage,
    addSystemMessage,
    cleanupOldSystemMessages,
    formatTime,
    shouldShowTimeSeparator,
  };
};
