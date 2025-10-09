import { useEffect } from 'react';
import { useStreamingContext } from '../../../hooks/useStreamingContext';
import { SystemEventType, MessageSender } from '../../../hooks/useMessageState';

interface UseMessageHandlersProps {
  connected: boolean;
  onSystemMessageCallback?: (
    callback: (messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void,
  ) => void;
  addSystemMessage: (
    messageId: string,
    text: string,
    systemType: SystemEventType,
    metadata?: Record<string, unknown>,
  ) => void;
  addChatMessage: (messageId: string, text: string, sender: MessageSender) => void;
  clearMessages: () => void;
}

export const useMessageHandlers = ({
  connected,
  onSystemMessageCallback,
  addSystemMessage,
  addChatMessage,
  clearMessages,
}: UseMessageHandlersProps) => {
  const { onSystemMessage, onChatMessage, onCommand } = useStreamingContext();

  // Set up system message callback
  useEffect(() => {
    if (onSystemMessageCallback) {
      onSystemMessageCallback((messageId, text, systemType, metadata) => {
        addSystemMessage(messageId, text, systemType as SystemEventType, metadata);
      });
    }
  }, [onSystemMessageCallback, addSystemMessage]);

  // Listen for system messages from the provider
  useEffect(() => {
    const unsubscribe = onSystemMessage((event) => {
      // Convert SystemMessageEvent to Message format and add to state
      addSystemMessage(event.messageId, event.text, event.eventType as SystemEventType, event.metadata);
    });

    return unsubscribe;
  }, [onSystemMessage, addSystemMessage]);

  // Listen for chat messages from the provider (alternative to onMessageReceived)
  useEffect(() => {
    const unsubscribe = onChatMessage((event) => {
      // Convert ChatMessageEvent to Message format and add to state
      addChatMessage(event.messageId, event.text, event.from === 'avatar' ? MessageSender.AVATAR : MessageSender.USER);
    });

    return unsubscribe;
  }, [onChatMessage, addChatMessage]);

  // Listen for command events from the provider
  useEffect(() => {
    const unsubscribe = onCommand((event) => {
      // Convert CommandEvent to system message format
      const commandText =
        event.success !== undefined
          ? `${event.success ? '✅' : '❌'} ${event.command}${event.message ? `: ${event.message}` : ''}`
          : `📤 ${event.command}${event.data ? ' (hover to see details)' : ''}`;

      // For set-params commands, store the data in fullParams for tooltip display
      const metadata = event.command === 'set-params' && event.data ? { fullParams: event.data } : event.data;

      addSystemMessage(
        `cmd_${Date.now()}`,
        commandText,
        event.command === 'interrupt' ? SystemEventType.INTERRUPT : SystemEventType.SET_PARAMS,
        metadata,
      );
    });

    return unsubscribe;
  }, [onCommand, addSystemMessage]);

  // Add effect to clear messages when connection is lost
  useEffect(() => {
    if (!connected) {
      clearMessages();
    }
  }, [connected, clearMessages]);
};
