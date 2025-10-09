import React, { createContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import type {
  StreamingProvider,
  StreamingCredentials,
  StreamingEventHandlers,
  SystemMessageEvent,
  ChatMessageEvent,
  CommandEvent,
} from '../types/provider.interfaces';
import { StreamProviderType, StreamingState, VideoTrack, AudioTrack, ChatMessage } from '../types/streaming.types';
import { providerManager } from '../providers/ProviderManager';
import { logger } from '../core/Logger';

export interface StreamingContextType {
  // Current provider state
  provider: StreamingProvider | null;
  providerType: StreamProviderType;
  state: StreamingState | null;
  isLoading: boolean;
  error: Error | null;

  // Provider management
  switchProvider: (type: StreamProviderType) => Promise<void>;
  connect: (credentials: StreamingCredentials) => Promise<void>;
  disconnect: () => Promise<void>;

  // Media controls
  publishVideo: (track: VideoTrack) => Promise<void>;
  unpublishVideo: () => Promise<void>;
  publishAudio: (track: AudioTrack) => Promise<void>;
  unpublishAudio: () => Promise<void>;

  // Communication
  sendMessage: (content: string) => Promise<void>;
  sendInterrupt: () => Promise<void>;
  setAvatarParameters: (metadata: Record<string, unknown>) => Promise<void>;

  // Avatar state
  isAvatarSpeaking: boolean;
  setIsAvatarSpeaking: (speaking: boolean) => void;

  // Message handling
  onMessageReceived: (callback: (message: ChatMessage) => void) => () => void;
  onSystemMessage: (callback: (event: SystemMessageEvent) => void) => () => void;
  onChatMessage: (callback: (event: ChatMessageEvent) => void) => () => void;
  onCommand: (callback: (event: CommandEvent) => void) => () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const StreamingContext = createContext<StreamingContextType | undefined>(undefined);

interface StreamingContextProviderProps {
  children: ReactNode;
  defaultProvider?: StreamProviderType;
}

export const StreamingContextProvider: React.FC<StreamingContextProviderProps> = ({
  children,
  defaultProvider = 'agora',
}) => {
  // Provider state
  const [provider, setProvider] = useState<StreamingProvider | null>(null);
  const [providerType, setProviderType] = useState<StreamProviderType>(defaultProvider);
  const [state, setState] = useState<StreamingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Avatar speaking state
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);

  // Message callback systems
  const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const systemMessageCallbacks = useRef<Set<(event: SystemMessageEvent) => void>>(new Set());
  const chatMessageCallbacks = useRef<Set<(event: ChatMessageEvent) => void>>(new Set());
  const commandCallbacks = useRef<Set<(event: CommandEvent) => void>>(new Set());

  // Subscribe to provider manager events
  useEffect(() => {
    const unsubscribeStateChanged = providerManager.subscribe('provider-state-changed', (data: unknown) => {
      const { state } = data as { state: StreamingState };
      setState(state);
    });

    const unsubscribeSwitched = providerManager.subscribe('provider-switched', (data: unknown) => {
      const { type, provider } = data as { type: StreamProviderType; provider: StreamingProvider };
      setProvider(provider);
      setProviderType(type);
      setIsLoading(false);
      setError(null);
      logger.info('Provider switched successfully', { type });
    });

    const unsubscribeFailed = providerManager.subscribe('provider-switch-failed', (data: unknown) => {
      const { error } = data as { error: Error };
      setIsLoading(false);
      setError(error);
      logger.error('Provider switch failed', { error });
    });

    // Initialize with current provider if any
    const currentProvider = providerManager.getCurrentProvider();
    const currentType = providerManager.getCurrentProviderType();
    const currentState = providerManager.getCurrentState();

    if (currentProvider && currentType) {
      setProvider(currentProvider);
      setProviderType(currentType);
      setState(currentState);
    }

    return () => {
      unsubscribeStateChanged();
      unsubscribeSwitched();
      unsubscribeFailed();
    };
  }, []);

  const switchProvider = useCallback(async (type: StreamProviderType) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simply update the provider type - no actual provider switching yet
      // The real provider creation will happen when a session is created with credentials
      setProviderType(type);
      setProvider(null); // Clear current provider
      setState(null); // Clear current state

      logger.info('Provider type updated', { type });
      setIsLoading(false);
    } catch (err) {
      logger.error('Failed to update provider type', { err, type });
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  }, []);

  const connect = useCallback(
    async (credentials: StreamingCredentials) => {
      setIsLoading(true);
      setError(null);

      try {
        // If no provider is available, create one using the provider manager
        if (!provider) {
          logger.info('No provider available, creating provider', { providerType });

          const eventHandlers: StreamingEventHandlers = {
            onSpeakingStateChanged: setIsAvatarSpeaking,
            onError: (error) => {
              logger.error('Provider error', { error });
              setError(error);
            },
            onMessageReceived: (message) => {
              logger.info('Message received from provider', {
                messageId: message.id,
                content: message.content.substring(0, 100),
                fromParticipant: message.fromParticipant,
                type: message.type,
              });
              messageCallbacks.current.forEach((callback) => callback(message));
            },
            onSystemMessage: (event) => {
              logger.debug('System message received from provider', { event });
              systemMessageCallbacks.current.forEach((callback) => callback(event));
            },
            onChatMessage: (event) => {
              logger.info('Chat message received from provider', {
                messageId: event.messageId,
                text: event.text.substring(0, 100),
                from: event.from,
              });
              chatMessageCallbacks.current.forEach((callback) => callback(event));
            },
            onCommand: (event) => {
              logger.debug('Command event received from provider', { event });
              commandCallbacks.current.forEach((callback) => callback(event));
            },
          };

          // Use provider manager to create and connect the provider
          await providerManager.switchProvider(providerType, credentials, eventHandlers);
          return;
        }

        // Provider exists, just connect it
        const eventHandlers: StreamingEventHandlers = {
          onSpeakingStateChanged: setIsAvatarSpeaking,
          onError: (error) => {
            logger.error('Connection error', { error });
            setError(error);
          },
          onMessageReceived: (message) => {
            logger.info('Message received from provider', {
              messageId: message.id,
              content: message.content.substring(0, 100),
              fromParticipant: message.fromParticipant,
              type: message.type,
            });
            messageCallbacks.current.forEach((callback) => callback(message));
          },
          onSystemMessage: (event) => {
            logger.debug('System message received from provider', { event });
            systemMessageCallbacks.current.forEach((callback) => callback(event));
          },
          onChatMessage: (event) => {
            logger.info('Chat message received from provider', {
              messageId: event.messageId,
              text: event.text.substring(0, 100),
              from: event.from,
            });
            chatMessageCallbacks.current.forEach((callback) => callback(event));
          },
          onCommand: (event) => {
            logger.debug('Command event received from provider', { event });
            commandCallbacks.current.forEach((callback) => callback(event));
          },
        };

        await provider.connect(credentials, eventHandlers);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [provider, providerType],
  );

  const disconnect = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.disconnect();
      // Clear speaking state when disconnecting
      setIsAvatarSpeaking(false);
    } catch (err) {
      logger.error('Failed to disconnect', { err });
      setError(err as Error);
      // Clear speaking state even on error
      setIsAvatarSpeaking(false);
    }
  }, [provider]);

  const publishVideo = useCallback(
    async (track: VideoTrack) => {
      if (!provider) {
        throw new Error('No provider available for video publishing');
      }
      await provider.publishVideo(track);
    },
    [provider],
  );

  const unpublishVideo = useCallback(async () => {
    if (!provider) return;
    await provider.unpublishVideo();
  }, [provider]);

  const publishAudio = useCallback(
    async (track: AudioTrack) => {
      if (!provider) {
        throw new Error('No provider available for audio publishing');
      }
      await provider.publishAudio(track);
    },
    [provider],
  );

  const unpublishAudio = useCallback(async () => {
    if (!provider) return;
    await provider.unpublishAudio();
  }, [provider]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!provider) {
        throw new Error('No provider available for sending message');
      }
      await provider.sendMessage(content);
    },
    [provider],
  );

  const sendInterrupt = useCallback(async () => {
    if (!provider) {
      throw new Error('No provider available for sending interrupt');
    }
    await provider.sendInterrupt();
  }, [provider]);

  const setAvatarParameters = useCallback(
    async (metadata: Record<string, unknown>) => {
      if (!provider) {
        throw new Error('No provider available for setting avatar parameters');
      }
      await provider.setAvatarParameters(metadata);
    },
    [provider],
  );

  const handleSetIsAvatarSpeaking = useCallback((speaking: boolean) => {
    setIsAvatarSpeaking(speaking);
  }, []);

  // Message handling
  const onMessageReceived = useCallback((callback: (message: ChatMessage) => void) => {
    messageCallbacks.current.add(callback);
    return () => {
      messageCallbacks.current.delete(callback);
    };
  }, []);

  const onSystemMessage = useCallback((callback: (event: SystemMessageEvent) => void) => {
    systemMessageCallbacks.current.add(callback);
    return () => {
      systemMessageCallbacks.current.delete(callback);
    };
  }, []);

  const onChatMessage = useCallback((callback: (event: ChatMessageEvent) => void) => {
    chatMessageCallbacks.current.add(callback);
    return () => {
      chatMessageCallbacks.current.delete(callback);
    };
  }, []);

  const onCommand = useCallback((callback: (event: CommandEvent) => void) => {
    commandCallbacks.current.add(callback);
    return () => {
      commandCallbacks.current.delete(callback);
    };
  }, []);

  return (
    <StreamingContext.Provider
      value={{
        provider,
        providerType,
        state,
        isLoading,
        error,

        switchProvider,
        connect,
        disconnect,

        publishVideo,
        unpublishVideo,
        publishAudio,
        unpublishAudio,

        sendMessage,
        sendInterrupt,
        setAvatarParameters,

        isAvatarSpeaking,
        setIsAvatarSpeaking: handleSetIsAvatarSpeaking,

        onMessageReceived,
        onSystemMessage,
        onChatMessage,
        onCommand,
      }}
    >
      {children}
    </StreamingContext.Provider>
  );
};

// Default export for Fast Refresh compatibility
export default StreamingContextProvider;
