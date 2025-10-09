import { useState, useEffect, useCallback } from 'react';
import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../types/provider.interfaces';
import { StreamProviderType, StreamingState, VideoTrack, AudioTrack } from '../types/streaming.types';
import { providerManager } from '../providers/ProviderManager';
import { logger } from '../core/Logger';

export interface UseStreamingProviderReturn {
  provider: StreamingProvider | null;
  providerType: StreamProviderType | null;
  state: StreamingState | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  switchProvider: (type: StreamProviderType, credentials: StreamingCredentials) => Promise<void>;
  connect: (credentials: StreamingCredentials) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendInterrupt: () => Promise<void>;

  // Media controls
  publishVideo: (track: VideoTrack) => Promise<void>;
  unpublishVideo: () => Promise<void>;
  publishAudio: (track: AudioTrack) => Promise<void>;
  unpublishAudio: () => Promise<void>;
}

export function useStreamingProvider(eventHandlers?: StreamingEventHandlers): UseStreamingProviderReturn {
  const [provider, setProvider] = useState<StreamingProvider | null>(null);
  const [providerType, setProviderType] = useState<StreamProviderType | null>(null);
  const [state, setState] = useState<StreamingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    });

    const unsubscribeFailed = providerManager.subscribe('provider-switch-failed', (data: unknown) => {
      const { error } = data as { error: Error };
      setIsLoading(false);
      setError(error);
    });

    // Initialize with current provider if any
    const currentProvider = providerManager.getCurrentProvider();
    const currentType = providerManager.getCurrentProviderType();
    const currentState = providerManager.getCurrentState();

    if (currentProvider) {
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

  const switchProvider = useCallback(
    async (type: StreamProviderType, credentials: StreamingCredentials) => {
      setIsLoading(true);
      setError(null);

      try {
        await providerManager.switchProvider(type, credentials, eventHandlers);
      } catch (err) {
        logger.error('Failed to switch provider', { err, type });
        setError(err as Error);
        setIsLoading(false);
      }
    },
    [eventHandlers],
  );

  const connect = useCallback(
    async (credentials: StreamingCredentials) => {
      if (!provider) {
        throw new Error('No provider available for connection');
      }

      setIsLoading(true);
      try {
        await provider.connect(credentials, eventHandlers);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [provider, eventHandlers],
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

  return {
    provider,
    providerType,
    state,
    isLoading,
    error,

    switchProvider,
    connect,
    disconnect,
    sendMessage,
    sendInterrupt,

    publishVideo,
    unpublishVideo,
    publishAudio,
    unpublishAudio,
  };
}
