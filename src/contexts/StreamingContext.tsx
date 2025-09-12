import React, { createContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import type { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../types/provider.interfaces';
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
  switchProvider: (type: StreamProviderType, credentials: StreamingCredentials) => Promise<void>;
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

  // Avatar state
  isAvatarSpeaking: boolean;
  setIsAvatarSpeaking: (speaking: boolean) => void;

  // Message handling
  onMessageReceived: (callback: (message: ChatMessage) => void) => () => void;
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

  // Message callback system
  const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());

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

  const switchProvider = useCallback(async (type: StreamProviderType, credentials: StreamingCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const eventHandlers: StreamingEventHandlers = {
        onSpeakingStateChanged: setIsAvatarSpeaking,
        onError: (error) => {
          logger.error('Provider error', { error });
          setError(error);
        },
        onMessageReceived: (message) => {
          // Notify all registered message callbacks
          logger.debug('Message received from provider', { message });
          messageCallbacks.current.forEach((callback) => callback(message));
        },
      };

      await providerManager.switchProvider(type, credentials, eventHandlers);
    } catch (err) {
      logger.error('Failed to switch provider', { err, type });
      setError(err as Error);
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(
    async (credentials: StreamingCredentials) => {
      // If no provider is available, switch to the default provider first
      if (!provider) {
        logger.info('No provider available, switching to default provider', { providerType });
        await switchProvider(providerType, credentials);
        return;
      }

      setIsLoading(true);
      try {
        const eventHandlers: StreamingEventHandlers = {
          onSpeakingStateChanged: setIsAvatarSpeaking,
          onError: (error) => {
            logger.error('Connection error', { error });
            setError(error);
          },
          onMessageReceived: (message) => {
            // Notify all registered message callbacks
            logger.debug('Message received from provider', { message });
            messageCallbacks.current.forEach((callback) => callback(message));
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
    [provider, providerType, switchProvider],
  );

  const disconnect = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.disconnect();
    } catch (err) {
      logger.error('Failed to disconnect', { err });
      setError(err as Error);
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

        isAvatarSpeaking,
        setIsAvatarSpeaking: handleSetIsAvatarSpeaking,

        onMessageReceived,
      }}
    >
      {children}
    </StreamingContext.Provider>
  );
};

// Default export for Fast Refresh compatibility
export default StreamingContextProvider;
