import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import type { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../types/provider.interfaces';
import { StreamProviderType, StreamingState, VideoTrack, AudioTrack } from '../types/streaming.types';
import { providerManager } from '../providers/ProviderManager';
import { logger } from '../core/Logger';

interface StreamingContextType {
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
}

const StreamingContext = createContext<StreamingContextType | undefined>(undefined);

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
      }}
    >
      {children}
    </StreamingContext.Provider>
  );
};

// Custom hook to use the streaming context
export const useStreamingContext = (): StreamingContextType => {
  const context = useContext(StreamingContext);
  if (context === undefined) {
    throw new Error('useStreamingContext must be used within a StreamingProvider');
  }
  return context;
};
