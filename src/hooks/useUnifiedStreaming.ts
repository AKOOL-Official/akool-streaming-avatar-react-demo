import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, ApiService, SessionOptions } from '../apiService';
import {
  StreamingProvider,
  StreamProviderType,
  StreamingState,
  VideoTrack,
  Metadata,
} from '../types/streamingProvider';
import { getStreamingProviderFactory } from '../providers/StreamingProviderFactory';
import { useAgora } from '../contexts/AgoraContext';
import { useLiveKit } from '../contexts/LiveKitContext';
import { log } from '../agoraHelper';
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
) => {
  const { client: agoraClient } = useAgora();
  const { room: livekitRoom } = useLiveKit();

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
    updateState({
      isJoined: providerState.isJoined,
      connected: providerState.connected,
      remoteStats: providerState.remoteStats,
      participants: providerState.participants,
      networkQuality: providerState.networkQuality,
    });
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
        providerRef.current = factory.createProvider(streamType);
        updateState({ currentProvider: streamType });

        log(`Initialized ${streamType} provider`);
      } catch (error) {
        console.error(`Failed to initialize ${streamType} provider:`, error);
      }
    };

    initializeProvider();

    // Cleanup previous provider
    return () => {
      if (providerRef.current) {
        providerRef.current.cleanup().catch(console.error);
        providerRef.current = null;
      }
    };
  }, [streamType, agoraClient, livekitRoom]);

  // Sync provider state with component state
  useEffect(() => {
    if (!providerRef.current) return;

    // Initial sync when provider changes
    syncProviderState();

    // No periodic sync - only sync when provider changes
    // This prevents continuous state updates that trigger avatar params
  }, [syncProviderState]);

  // Handle video track publishing/unpublishing
  useEffect(() => {
    const handleVideoTrack = async () => {
      if (!providerRef.current || !state.isJoined) return;

      try {
        if (localVideoTrack) {
          await providerRef.current.publishVideo(localVideoTrack);
          log('Local video track published');
        } else {
          await providerRef.current.unpublishVideo();
          log('Local video track unpublished');
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
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for room to stabilize
        
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
      alert('Please set host and token first');
      return;
    }

    if (!providerRef.current) {
      alert('Streaming provider not initialized');
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
        },
        onStreamMessage: (message, from) => {
          log('Stream message received:', message, 'from', from.identity);
        },
        onSystemMessage: onSystemMessage,
        onException: (error) => {
          console.error('Provider exception:', error);
        },
        onTokenExpired: async () => {
          alert('Session expired');
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
      syncProviderState();
    } catch (error) {
      console.error('Failed to start streaming:', error);
      alert(`Failed to start streaming: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    syncProviderState,
    state.session,
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
