import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiService, Session, SessionOptions } from '../apiService';
import { StreamingCredentials } from '../types/provider.interfaces';
import { StreamProviderType, VideoTrack } from '../types/streaming.types';
import { useStreamingContext } from './useStreamingContext';
import { logger } from '../core/Logger';

/**
 * Avatar Configuration Types and Utilities
 */
type AvatarConfig = {
  voiceId: string;
  voiceUrl: string;
  language: string;
  modeType: number;
  backgroundUrl: string;
  voiceParams: Record<string, unknown>;
};

/** Build avatar metadata object with clean, filtered values */
const buildAvatarMetadata = (config: AvatarConfig) => {
  const metadata = {
    vid: config.voiceId,
    vurl: config.voiceUrl,
    lang: config.language,
    mode: config.modeType,
    bgurl: config.backgroundUrl,
    vparams: config.voiceParams,
  };

  // Filter out falsy values to avoid sending empty parameters
  return Object.fromEntries(Object.entries(metadata).filter(([_, value]) => Boolean(value)));
};

interface StreamingSessionState {
  isJoined: boolean;
  connected: boolean;
  remoteStats: unknown | null;
  session: Session | null;
  currentProvider: StreamProviderType | null;
}

interface UseStreamingSessionParams {
  avatarId: string;
  knowledgeId: string;
  sessionDuration: number;
  voiceId: string;
  voiceUrl: string;
  backgroundUrl: string;
  language: string;
  modeType: number;
  voiceParams: Record<string, unknown>;
  api: ApiService | null;
  localVideoTrack?: VideoTrack | null;
  providerType?: StreamProviderType;
}

export const useStreamingSession = ({
  avatarId,
  knowledgeId,
  sessionDuration,
  voiceId,
  voiceUrl,
  backgroundUrl,
  language,
  modeType,
  voiceParams,
  api,
  localVideoTrack,
  providerType = 'agora',
}: UseStreamingSessionParams) => {
  const {
    provider,
    providerType: currentProviderType,
    state: providerState,
    switchProvider,
    connect,
    disconnect,
    publishVideo,
    unpublishVideo,
    sendMessage: providerSendMessage,
    sendInterrupt: providerSendInterrupt,
    setAvatarParameters: providerSetAvatarParameters,
  } = useStreamingContext();

  const [state, setState] = useState<StreamingSessionState>({
    isJoined: false,
    connected: false,
    remoteStats: null,
    session: null,
    currentProvider: null,
  });

  const sessionRef = useRef<Session | null>(null);
  const initialParamsSentRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  // Update local state when provider state changes
  useEffect(() => {
    if (providerState) {
      setState((prev) => ({
        ...prev,
        isJoined: providerState.isJoined,
        connected: providerState.isJoined,
        currentProvider: currentProviderType,
      }));
    }
  }, [providerState, currentProviderType]);

  // Handle video track publishing
  useEffect(() => {
    const handleVideoTrack = async () => {
      if (!provider || !state.isJoined) return;

      try {
        if (localVideoTrack) {
          await publishVideo(localVideoTrack);
        } else {
          await unpublishVideo();
        }
      } catch (error) {
        logger.error('Failed to handle video track', { error });
      }
    };

    handleVideoTrack();
  }, [localVideoTrack, state.isJoined, provider, publishVideo, unpublishVideo]);

  const buildStreamingCredentials = useCallback((): StreamingCredentials => {
    if (!sessionRef.current) {
      throw new Error('No active session');
    }

    const session = sessionRef.current;
    const credentials = session.credentials;

    // Build credentials based on the provider type
    switch (providerType) {
      case 'agora':
        return {
          agora_app_id: credentials.agora_app_id,
          agora_channel: credentials.agora_channel,
          agora_token: credentials.agora_token,
          agora_uid: credentials.agora_uid,
        };

      case 'livekit':
        return {
          livekit_url: credentials.livekit_url,
          livekit_token: credentials.livekit_token,
          livekit_room_name: credentials.livekit_room_name,
          livekit_client_identity: credentials.livekit_client_identity,
          livekit_server_identity: credentials.livekit_server_identity,
        };

      case 'trtc':
        return {
          trtc_app_id: credentials.trtc_app_id,
          trtc_user_id: credentials.trtc_user_id,
          trtc_user_sig: credentials.trtc_user_sig,
          trtc_room_id: credentials.trtc_room_id,
        };

      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }, [providerType]);

  const startStreaming = useCallback(async () => {
    if (!api) {
      throw new Error('Please set host and token first');
    }

    try {
      setState((prev) => ({ ...prev, connected: false }));
      logger.info('Starting unified streaming', { providerType, avatarId });

      // Create session with the selected stream type
      const sessionOptions: SessionOptions = {
        avatar_id: avatarId,
        duration: sessionDuration * 60,
        knowledge_id: knowledgeId,
        voice_id: voiceId,
        voice_url: voiceUrl,
        language,
        mode_type: modeType,
        background_url: backgroundUrl,
        voice_params: voiceParams,
        stream_type: providerType, // Pass the selected provider type to get appropriate credentials
      };

      const session = await api.createSession(sessionOptions);
      sessionRef.current = session;

      setState((prev) => ({ ...prev, session }));

      // Switch to desired provider if different, then connect
      if (currentProviderType !== providerType) {
        await switchProvider(providerType);
      }

      // Always connect with the credentials from the session
      await connect(buildStreamingCredentials());

      logger.info('Unified streaming started successfully', { providerType });
    } catch (error) {
      logger.error('Failed to start unified streaming', { error });
      setState((prev) => ({ ...prev, connected: false, session: null }));
      throw error;
    }
  }, [
    api,
    avatarId,
    sessionDuration,
    knowledgeId,
    providerType,
    currentProviderType,
    switchProvider,
    connect,
    buildStreamingCredentials,
    voiceId,
    voiceUrl,
    language,
    modeType,
    backgroundUrl,
    voiceParams,
  ]);

  const closeStreaming = useCallback(async () => {
    try {
      logger.info('Closing unified streaming');

      await disconnect();

      if (sessionRef.current && api) {
        await api.closeSession(sessionRef.current._id);
      }

      setState({
        isJoined: false,
        connected: false,
        remoteStats: null,
        session: null,
        currentProvider: null,
      });

      sessionRef.current = null;
      initialParamsSentRef.current = false;
      lastParamsRef.current = '';

      logger.info('Unified streaming closed successfully');
    } catch (error) {
      logger.error('Failed to close unified streaming', { error });
    }
  }, [disconnect, api]);

  const sendMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!provider || !state.connected) {
        throw new Error('Not connected to streaming provider');
      }

      try {
        await providerSendMessage(content);
        logger.info('Message sent via unified streaming', { messageId, providerType: currentProviderType });
      } catch (error) {
        logger.error('Failed to send message via unified streaming', { error, messageId });
        throw error;
      }
    },
    [provider, state.connected, providerSendMessage, currentProviderType],
  );

  const sendInterrupt = useCallback(async () => {
    if (!provider || !state.connected) {
      throw new Error('Not connected to streaming provider');
    }

    try {
      await providerSendInterrupt();
      logger.info('Interrupt sent via unified streaming', { providerType: currentProviderType });
    } catch (error) {
      logger.error('Failed to send interrupt via unified streaming', { error });
      throw error;
    }
  }, [provider, state.connected, providerSendInterrupt, currentProviderType]);

  const setAvatarParams = useCallback(
    async (force = false) => {
      if (!provider || !state.connected) return;

      const avatarConfig: AvatarConfig = {
        voiceId,
        voiceUrl,
        language,
        modeType,
        backgroundUrl,
        voiceParams,
      };

      const metadata = buildAvatarMetadata(avatarConfig);
      const currentParams = JSON.stringify(metadata);

      // Skip if params haven't changed and not forced
      if (!force && initialParamsSentRef.current && lastParamsRef.current === currentParams) {
        return;
      }

      try {
        // Call the provider's setAvatarParameters method
        await providerSetAvatarParameters(metadata);

        logger.info('Avatar parameters set via unified streaming', {
          metadata,
          providerType: currentProviderType,
        });

        initialParamsSentRef.current = true;
        lastParamsRef.current = currentParams;
      } catch (error) {
        logger.error('Failed to set avatar parameters', { error, metadata });
      }
    },
    [
      provider,
      state.connected,
      voiceId,
      voiceUrl,
      language,
      modeType,
      backgroundUrl,
      voiceParams,
      currentProviderType,
      providerSetAvatarParameters,
    ],
  );

  // Auto-set avatar params when connection established
  useEffect(() => {
    if (state.connected && !initialParamsSentRef.current) {
      setAvatarParams(true);
    }
  }, [state.connected, setAvatarParams]);

  // Re-send avatar params when parameters change (if connected)
  useEffect(() => {
    if (state.connected && initialParamsSentRef.current) {
      setAvatarParams(true); // Force update when params change
    }
  }, [voiceId, voiceUrl, language, modeType, backgroundUrl, voiceParams, state.connected, setAvatarParams]);

  return {
    // State
    ...state,
    currentProvider: currentProviderType,

    // Actions
    startStreaming,
    closeStreaming,
    sendMessage,
    sendInterrupt,
    setAvatarParams,

    // Provider management
    switchProvider: (type: StreamProviderType) => {
      if (sessionRef.current) {
        return switchProvider(type);
      }
      throw new Error('No active session for provider switching');
    },
  };
};
