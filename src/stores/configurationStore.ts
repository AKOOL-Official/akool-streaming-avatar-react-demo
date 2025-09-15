import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StreamProviderType } from '../types/streaming.types';

interface ConfigurationState {
  // Provider selection
  selectedProvider: StreamProviderType;

  // OpenAPI configuration (single global API key)
  openapiHost: string;
  openapiToken: string;

  // Avatar settings
  avatarId: string;
  voiceId: string;
  knowledgeId: string;

  // Session settings
  sessionDuration: number;
  modeType: number;
  language: string;

  // Background and voice settings
  backgroundUrl: string;
  voiceUrl: string;
  voiceParams: Record<string, unknown>;

  // Media settings
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  audioQuality: 'low' | 'medium' | 'high';

  // Actions
  setSelectedProvider: (provider: StreamProviderType) => void;
  setOpenapiHost: (host: string) => void;
  setOpenapiToken: (token: string) => void;
  setAvatarId: (avatarId: string) => void;
  setVoiceId: (voiceId: string) => void;
  setKnowledgeId: (knowledgeId: string) => void;
  setSessionDuration: (duration: number) => void;
  setModeType: (modeType: number) => void;
  setLanguage: (language: string) => void;
  setBackgroundUrl: (url: string) => void;
  setVoiceUrl: (url: string) => void;
  setVoiceParams: (params: Record<string, unknown>) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoQuality: (quality: 'low' | 'medium' | 'high') => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => void;

  // Getters and utilities
  isApiConfigured: () => boolean;
  isAvatarConfigured: () => boolean;
  isFullyConfigured: () => boolean;
  getSessionOptions: () => {
    avatar_id: string;
    duration: number;
    knowledge_id?: string;
    voice_id?: string;
    voice_url?: string;
    language?: string;
    mode_type?: number;
    background_url?: string;
    voice_params?: Record<string, unknown>;
    stream_type?: StreamProviderType;
  };
  resetToDefaults: () => void;
  validateConfiguration: () => { isValid: boolean; errors: string[] };
}

export const useConfigurationStore = create<ConfigurationState>()(
  persist(
    (set, get) => ({
      // Initial state - matching App.tsx defaults with environment variable fallbacks
      selectedProvider: 'agora',
      openapiHost: import.meta.env.VITE_OPENAPI_HOST || '',
      openapiToken: import.meta.env.VITE_OPENAPI_TOKEN || '',
      avatarId: import.meta.env.VITE_AVATAR_ID || '',
      voiceId: import.meta.env.VITE_VOICE_ID || '',
      knowledgeId: '',
      sessionDuration: 10,
      modeType: Number(import.meta.env.VITE_MODE_TYPE) || 2,
      language: import.meta.env.VITE_LANGUAGE || 'en',
      backgroundUrl: import.meta.env.VITE_BACKGROUND_URL || '',
      voiceUrl: import.meta.env.VITE_VOICE_URL || '',
      voiceParams: {},
      videoEnabled: true,
      audioEnabled: true,
      videoQuality: 'medium',
      audioQuality: 'medium',

      // Actions
      setSelectedProvider: (provider: StreamProviderType) => set({ selectedProvider: provider }),
      setOpenapiHost: (host: string) => set({ openapiHost: host }),
      setOpenapiToken: (token: string) => set({ openapiToken: token }),
      setAvatarId: (avatarId: string) => set({ avatarId }),
      setVoiceId: (voiceId: string) => set({ voiceId }),
      setKnowledgeId: (knowledgeId: string) => set({ knowledgeId }),
      setSessionDuration: (duration: number) => set({ sessionDuration: duration }),
      setModeType: (modeType: number) => set({ modeType }),
      setLanguage: (language: string) => set({ language }),
      setBackgroundUrl: (url: string) => set({ backgroundUrl: url }),
      setVoiceUrl: (url: string) => set({ voiceUrl: url }),
      setVoiceParams: (params: Record<string, unknown>) => set({ voiceParams: params }),
      setVideoEnabled: (enabled: boolean) => set({ videoEnabled: enabled }),
      setAudioEnabled: (enabled: boolean) => set({ audioEnabled: enabled }),
      setVideoQuality: (quality: 'low' | 'medium' | 'high') => set({ videoQuality: quality }),
      setAudioQuality: (quality: 'low' | 'medium' | 'high') => set({ audioQuality: quality }),

      // Getters and utilities
      isApiConfigured: () => {
        const state = get();
        return !!(state.openapiHost && state.openapiToken);
      },

      isAvatarConfigured: () => {
        const state = get();
        return !!state.avatarId;
      },

      isFullyConfigured: () => {
        const state = get();
        return !!(state.openapiHost && state.openapiToken && state.avatarId);
      },

      getSessionOptions: () => {
        const state = get();
        return {
          avatar_id: state.avatarId,
          duration: state.sessionDuration,
          knowledge_id: state.knowledgeId || undefined,
          voice_id: state.voiceId || undefined,
          voice_url: state.voiceUrl || undefined,
          language: state.language || undefined,
          mode_type: state.modeType,
          background_url: state.backgroundUrl || undefined,
          voice_params: Object.keys(state.voiceParams).length > 0 ? state.voiceParams : undefined,
          stream_type: state.selectedProvider,
        };
      },

      resetToDefaults: () =>
        set({
          selectedProvider: 'agora',
          openapiHost: '',
          openapiToken: '',
          avatarId: '',
          voiceId: '',
          knowledgeId: '',
          sessionDuration: 10,
          modeType: 2,
          language: 'en',
          backgroundUrl: '',
          voiceUrl: '',
          voiceParams: {},
          videoEnabled: true,
          audioEnabled: true,
          videoQuality: 'medium',
          audioQuality: 'medium',
        }),

      validateConfiguration: () => {
        const state = get();
        const errors: string[] = [];

        if (!state.openapiHost) {
          errors.push('OpenAPI host is required');
        }
        if (!state.openapiToken) {
          errors.push('OpenAPI token is required');
        }
        if (!state.avatarId) {
          errors.push('Avatar ID is required');
        }
        if (state.sessionDuration <= 0) {
          errors.push('Session duration must be greater than 0');
        }
        if (state.modeType < 1 || state.modeType > 3) {
          errors.push('Mode type must be between 1 and 3');
        }

        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    }),
    {
      name: 'streaming-avatar-config',
      // Only persist safe, non-sensitive configuration
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        avatarId: state.avatarId,
        voiceId: state.voiceId,
        knowledgeId: state.knowledgeId,
        sessionDuration: state.sessionDuration,
        modeType: state.modeType,
        language: state.language,
        backgroundUrl: state.backgroundUrl,
        voiceUrl: state.voiceUrl,
        voiceParams: state.voiceParams,
        videoEnabled: state.videoEnabled,
        audioEnabled: state.audioEnabled,
        videoQuality: state.videoQuality,
        audioQuality: state.audioQuality,
        // Note: openapiHost and openapiToken are NOT persisted for security
      }),
    },
  ),
);
