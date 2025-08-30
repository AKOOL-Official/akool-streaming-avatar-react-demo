import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, ApiService, SessionOptions } from '../apiService';
import {
  StreamingProvider,
  StreamProviderType,
  StreamingState,
  VideoTrack,
  Metadata,
  ChatResponsePayload,
} from '../types/streamingProvider';
import { getStreamingProviderFactory } from '../providers/StreamingProviderFactory';
import { useAgora } from '../contexts/AgoraContext';
import { useLiveKit } from '../contexts/LiveKitContext';
import { useNotifications } from './useNotifications';
import { log, logger } from '../utils/messageUtils';
import { AgoraStreamingProvider } from '../providers/AgoraProvider';

interface UnifiedStreamingState extends StreamingState {
  session: Session | null;
  currentProvider: StreamProviderType | null;
}

export const useUnifiedStreaming = (
  streamType: StreamProviderType,
  avatarId: string,
  knowledgeId: string,
  sessionDuration: number,
  voiceId: string,
  voiceUrl: string,
  backgroundUrl: string,
  language: string,
  modeType: number,
  voiceParams: Record<string, unknown>,
  api: ApiService | null,
  localVideoTrack: VideoTrack | null,
  onSystemMessage?: (messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void,
  onStreamMessage?: (
    message: string,
    from: { uid: string | number; identity: string },
    messageData?: ChatResponsePayload,
    messageId?: string,
  ) => void,
  onAudioStateChange?: (isSpeaking: boolean) => void,
) => {
  const { client: agoraClient } = useAgora();
  const { room: livekitRoom } = useLiveKit();
  const { showError, showWarning } = useNotifications();

  const [state, setState] = useState<UnifiedStreamingState>({
    isJoined: false,
    connected: false,
    remoteStats: null,
    participants: [],
    networkQuality: null,
    session: null,
    currentProvider: null,
  });

  const providerRef = useRef<StreamingProvider | null>(null);

  // Helper function to update state partially
  const updateState = (newState: Partial<UnifiedStreamingState>) => {
    setState((prevState) => ({ ...prevState, ...newState }));
  };

  // Manual state sync function - call when needed instead of periodic sync
  const syncProviderState = useCallback(() => {
    if (!providerRef.current) return;

    const provider = providerRef.current;
    const providerState = provider.state;

    logger.debug('Manual sync - provider stats:', {
      hasRemoteStats: !!providerState.remoteStats,
      hasVideo: !!providerState.remoteStats?.video,
      hasAudio: !!providerState.remoteStats?.audio,
      videoKeys: providerState.remoteStats?.video ? Object.keys(providerState.remoteStats.video) : [],
    });

    updateState({
      isJoined: providerState.isJoined,
      connected: providerState.connected,
      remoteStats: providerState.remoteStats,
      participants: providerState.participants,
      networkQuality: providerState.networkQuality,
    });

    logger.debug('Manual sync complete - updated hook state');
  }, []);

  // Initialize provider when stream type changes
  useEffect(() => {
    const initializeProvider = async () => {
      try {
        const factory = getStreamingProviderFactory();

        // Set the appropriate client/room in the factory
        if (streamType === 'agora') {
          factory.setAgoraClient(agoraClient);
        } else if (streamType === 'livekit') {
          factory.setLiveKitRoom(livekitRoom);
        }

        // Create the provider
        providerRef.current = await factory.createProvider(streamType);
        updateState({ currentProvider: streamType });

        log(`Initialized ${streamType} provider`);
      } catch (error) {
        console.error(`Failed to initialize ${streamType} provider:`, error);
      }
    };

    initializeProvider();

    // Cleanup previous provider when effect reruns
    return () => {
      if (providerRef.current) {
        logger.debug('Cleaning up provider on effect cleanup');
        providerRef.current.cleanup().catch(console.error);
        providerRef.current = null;
        // Reset video track reference when provider changes
        publishedVideoTrackRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamType]); // Only depend on streamType to prevent reconnection loops

  // Sync provider state with component state
  useEffect(() => {
    if (!providerRef.current) {
      logger.debug('Sync effect: No provider available');
      return;
    }

    logger.debug('Setting up provider state sync for', streamType);

    // Initial sync when provider changes
    syncProviderState();

    // Set up periodic sync for stats updates
    // Only sync stats-related properties to avoid triggering avatar params
    logger.debug('Starting periodic stats sync interval');
    const statsSync = setInterval(() => {
      if (!providerRef.current) {
        logger.debug('Periodic sync: No provider available');
        return;
      }

      const provider = providerRef.current;
      const providerState = provider.state;

      // Debug: Log provider state periodically
      if (Math.random() < 0.1) {
        // 10% of the time
        logger.debug('Periodic sync check - provider state:', {
          hasRemoteStats: !!providerState.remoteStats,
          hasVideo: !!providerState.remoteStats?.video,
          hasAudio: !!providerState.remoteStats?.audio,
          currentHookStats: !!state.remoteStats,
          hookHasVideo: !!state.remoteStats?.video,
        });
      }

      // Only update stats and network quality if they've actually changed
      // This prevents unnecessary re-renders that cause flickering
      const newStats: Partial<typeof state> = {};

      if (providerState.remoteStats !== state.remoteStats) {
        newStats.remoteStats = providerState.remoteStats;
      }

      if (providerState.networkQuality !== state.networkQuality) {
        newStats.networkQuality = providerState.networkQuality;
      }

      if (providerState.participants !== state.participants) {
        newStats.participants = providerState.participants;
      }

      // Only update if there are actual changes
      if (Object.keys(newStats).length > 0) {
        logger.debug('State update triggered with changes:', Object.keys(newStats));
        updateState(newStats);
      }

      // Log when stats are actually synced (but not too frequently)
      if (Math.random() < 0.2 && providerState.remoteStats) {
        // 20% of the time
        logger.debug('Syncing provider stats to hook:', {
          hasVideo: !!providerState.remoteStats?.video,
          hasAudio: !!providerState.remoteStats?.audio,
          providerType: providerState.remoteStats?.providerType,
          videoKeys: providerState.remoteStats?.video ? Object.keys(providerState.remoteStats.video) : [],
        });
      }

      // Always log the first successful sync
      if (providerState.remoteStats && !state.remoteStats) {
        logger.debug('First stats sync - provider stats available:', {
          hasVideo: !!providerState.remoteStats?.video,
          hasAudio: !!providerState.remoteStats?.audio,
          providerType: providerState.remoteStats?.providerType,
        });
      }

      updateState(newStats);
    }, 1000); // Sync every 1 second

    return () => {
      logger.debug('Cleaning up stats sync interval');
      clearInterval(statsSync);
    };
  }, [syncProviderState, state.remoteStats, state.networkQuality, state.participants, streamType]);

  // Track published video track to prevent duplicate publishing
  const publishedVideoTrackRef = useRef<VideoTrack | null>(null);

  // Handle video track publishing/unpublishing
  useEffect(() => {
    const handleVideoTrack = async () => {
      if (!providerRef.current || !state.isJoined) return;

      try {
        if (localVideoTrack) {
          // Only publish if this is a different track than what's currently published
          if (publishedVideoTrackRef.current !== localVideoTrack) {
            await providerRef.current.publishVideo(localVideoTrack);
            publishedVideoTrackRef.current = localVideoTrack;
            log('Local video track published');
          }
        } else {
          // Only unpublish if we have a published track
          if (publishedVideoTrackRef.current) {
            await providerRef.current.unpublishVideo();
            publishedVideoTrackRef.current = null;
            log('Local video track unpublished');
          }
        }
      } catch (error) {
        console.error('Failed to handle video track:', error);
      }
    };

    handleVideoTrack();
  }, [localVideoTrack, state.isJoined]);

  // Track if we've sent initial params to avoid sending repeatedly
  const initialParamsSentRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  // Auto-update avatar params when they change during active session
  useEffect(() => {
    const updateParams = async () => {
      if (!providerRef.current || !state.isJoined || !state.connected) {
        initialParamsSentRef.current = false;
        return;
      }

      // Add a small delay to ensure room is fully stable after connection
      if (!initialParamsSentRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms for room to stabilize

        // Double-check connection state after delay
        if (!providerRef.current || !state.isJoined || !state.connected) {
          log('Connection lost during avatar params delay, skipping params update');
          return;
        }
      }

      const metadata: Metadata = {
        vid: voiceId,
        vurl: voiceUrl,
        lang: language,
        mode: modeType,
        bgurl: backgroundUrl,
        vparams: voiceParams,
      };

      // Filter out falsy values
      const cleanedMeta = Object.fromEntries(Object.entries(metadata).filter(([_, value]) => Boolean(value)));

      // Create a hash of the parameters to detect actual changes
      const currentParams = JSON.stringify(cleanedMeta);

      // Only send if this is the first time or parameters actually changed
      if (!initialParamsSentRef.current || lastParamsRef.current !== currentParams) {
        try {
          await providerRef.current.setAvatarParams(cleanedMeta, (cmd, data) => {
            if (onSystemMessage && cmd === 'set-params' && data) {
              const messageId = `cmd_send_${Date.now()}`;
              const messageText = `📤 ${cmd}`;
              onSystemMessage(messageId, messageText, 'set_params', { fullParams: data });
            }
          });

          initialParamsSentRef.current = true;
          lastParamsRef.current = currentParams;
          log('Avatar params updated:', cleanedMeta);
        } catch (error) {
          console.error('Failed to update avatar params:', error);
          // Reset the flag so we can retry on next connection
          initialParamsSentRef.current = false;
        }
      }
    };

    updateParams();
  }, [
    state.isJoined,
    state.connected,
    voiceId,
    voiceUrl,
    language,
    modeType,
    backgroundUrl,
    voiceParams,
    onSystemMessage,
  ]);

  const startStreaming = useCallback(async () => {
    if (!api) {
      showWarning('Please set host and token first');
      return;
    }

    if (!providerRef.current) {
      showError('Streaming provider not initialized');
      return;
    }

    try {
      // Create session with the selected stream type
      const sessionOptions: SessionOptions = {
        stream_type: streamType,
        avatar_id: avatarId,
        duration: sessionDuration * 60,
        ...(knowledgeId ? { knowledge_id: knowledgeId } : {}),
        ...(voiceId ? { voice_id: voiceId } : {}),
        ...(voiceUrl ? { voice_url: voiceUrl } : {}),
        ...(language ? { language: language } : {}),
        ...(modeType ? { mode_type: modeType } : {}),
        ...(backgroundUrl ? { background_url: backgroundUrl } : {}),
        ...(voiceParams && Object.keys(voiceParams).length > 0 ? { voice_params: voiceParams } : {}),
      };

      const session = await api.createSession(sessionOptions);
      log('Session created:', session);
      updateState({ session });

      const { stream_urls, credentials } = session;
      const sessionCredentials = credentials || stream_urls;

      // Connect using the provider
      await providerRef.current.connect(sessionCredentials, {
        onUserJoin: (participant) => {
          log('User joined:', participant.identity);
        },
        onUserLeave: (participant) => {
          log('User left:', participant.identity);
        },
        onNetworkQuality: (quality) => {
          log('Network quality updated:', quality);
          // Trigger immediate state sync when network quality updates
          // This ensures stats updates are reflected in the UI
          setTimeout(() => {
            if (providerRef.current) {
              logger.debug('Triggering immediate sync after network quality update');
              syncProviderState();
            }
          }, 100);
        },
        onStreamMessage: (message, from, messageData, messageId) => {
          log('Stream message received:', message, 'from', from.identity, 'messageId:', messageId);
          onStreamMessage?.(message, from, messageData, messageId);
        },
        onSystemMessage: onSystemMessage,
        onAudioStateChange: onAudioStateChange,
        onException: (error) => {
          console.error('Provider exception:', error);
        },
        onTokenExpired: async () => {
          showWarning('Session expired', { title: 'Session Expired' });
          // Handle session expiration by disconnecting directly
          try {
            if (providerRef.current) {
              if (streamType === 'agora' && 'disconnectFromChat' in providerRef.current) {
                await (providerRef.current as unknown as AgoraStreamingProvider).disconnectFromChat();
              }
              await providerRef.current.disconnect();
            }
            if (state.session && api) {
              await api.closeSession(state.session._id);
            }
            updateState({
              isJoined: false,
              connected: false,
              session: null,
              participants: [],
              remoteStats: null,
              networkQuality: null,
            });
            // Reset video track reference on token expiration
            publishedVideoTrackRef.current = null;
          } catch (error) {
            console.error('Failed to handle token expiration:', error);
          }
        },
      });

      // Enable message handling for providers that support it
      if (streamType === 'agora' && 'connectToChat' in providerRef.current) {
        await (providerRef.current as unknown as AgoraStreamingProvider).connectToChat();
      }

      // Sync provider state after connection
      log('Calling syncProviderState after successful connection');
      syncProviderState();
    } catch (error) {
      console.error('Failed to start streaming:', error);
      showError(`Failed to start streaming: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        title: 'Streaming Error',
      });
    }
  }, [
    api,
    streamType,
    avatarId,
    knowledgeId,
    sessionDuration,
    voiceId,
    voiceUrl,
    language,
    modeType,
    backgroundUrl,
    voiceParams,
    onSystemMessage,
    onStreamMessage,
    onAudioStateChange,
    syncProviderState,
    state.session,
    showError,
    showWarning,
  ]);

  const closeStreaming = useCallback(async () => {
    try {
      if (providerRef.current) {
        // Disable message handling for providers that support it
        if (streamType === 'agora' && 'disconnectFromChat' in providerRef.current) {
          await (providerRef.current as unknown as AgoraStreamingProvider).disconnectFromChat();
        }

        await providerRef.current.disconnect();
      }

      if (state.session && api) {
        await api.closeSession(state.session._id);
      }

      updateState({
        isJoined: false,
        connected: false,
        session: null,
        participants: [],
        remoteStats: null,
        networkQuality: null,
      });

      // Reset video track reference on disconnect
      publishedVideoTrackRef.current = null;

      // Sync provider state after disconnection
      syncProviderState();
    } catch (error) {
      console.error('Failed to close streaming:', error);
    }
  }, [api, streamType, state.session, syncProviderState]);

  // Send message through current provider
  const sendMessage = useCallback(async (messageId: string, content: string) => {
    if (!providerRef.current) {
      throw new Error('No active streaming provider');
    }

    if (!providerRef.current.canSendMessages()) {
      throw new Error('Provider not ready to send messages');
    }

    await providerRef.current.sendMessage(messageId, content);
  }, []);

  // Send interrupt command
  const sendInterrupt = useCallback(async () => {
    if (!providerRef.current) {
      throw new Error('No active streaming provider');
    }

    await providerRef.current.interruptResponse((cmd) => {
      if (onSystemMessage) {
        const messageId = `cmd_send_${Date.now()}`;
        const messageText = `📤 ${cmd}`;
        onSystemMessage(messageId, messageText, 'interrupt');
      }
    });
  }, [onSystemMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.cleanup().catch(console.error);
      }
    };
  }, []);

  return {
    ...state,
    startStreaming,
    closeStreaming,
    sendMessage,
    sendInterrupt,
    currentProvider: state.currentProvider,
  };
};
