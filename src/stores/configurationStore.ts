import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StreamProviderType } from '../types/streaming.types';

interface ConfigurationState {
  // Provider selection
  selectedProvider: StreamProviderType;

  // API configuration
  apiKeys: {
    agora?: string;
    livekit?: string;
    trtc?: string;
  };

  // Avatar settings
  avatarId: string;
  voiceId: string;

  // Media settings
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  audioQuality: 'low' | 'medium' | 'high';

  // Actions
  setSelectedProvider: (provider: StreamProviderType) => void;
  setApiKey: (provider: StreamProviderType, apiKey: string) => void;
  setAvatarId: (avatarId: string) => void;
  setVoiceId: (voiceId: string) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoQuality: (quality: 'low' | 'medium' | 'high') => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => void;

  // Getters
  getCredentialsForProvider: (provider: StreamProviderType) => Record<string, unknown>;
  isProviderConfigured: (provider: StreamProviderType) => boolean;
}

export const useConfigurationStore = create<ConfigurationState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedProvider: 'agora',
      apiKeys: {},
      avatarId: '',
      voiceId: '',
      videoEnabled: true,
      audioEnabled: true,
      videoQuality: 'medium',
      audioQuality: 'medium',

      // Actions
      setSelectedProvider: (provider: StreamProviderType) => set({ selectedProvider: provider }),

      setApiKey: (provider: StreamProviderType, apiKey: string) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: apiKey },
        })),

      setAvatarId: (avatarId: string) => set({ avatarId }),
      setVoiceId: (voiceId: string) => set({ voiceId }),
      setVideoEnabled: (enabled: boolean) => set({ videoEnabled: enabled }),
      setAudioEnabled: (enabled: boolean) => set({ audioEnabled: enabled }),
      setVideoQuality: (quality: 'low' | 'medium' | 'high') => set({ videoQuality: quality }),
      setAudioQuality: (quality: 'low' | 'medium' | 'high') => set({ audioQuality: quality }),

      // Getters
      getCredentialsForProvider: (provider: StreamProviderType) => {
        const state = get();
        const baseCredentials = {
          channelName: `avatar-session-${Date.now()}`,
          userId: `user-${Math.random().toString(36).substr(2, 9)}`,
          avatarId: state.avatarId,
          voiceId: state.voiceId,
        };

        switch (provider) {
          case 'agora':
            return {
              ...baseCredentials,
              appId: state.apiKeys.agora || '',
            };
          case 'livekit':
            return {
              ...baseCredentials,
              serverUrl: process.env.REACT_APP_LIVEKIT_URL || '',
              apiKey: state.apiKeys.livekit || '',
            };
          case 'trtc':
            return {
              ...baseCredentials,
              sdkAppId: parseInt(state.apiKeys.trtc || '0'),
            };
          default:
            return baseCredentials;
        }
      },

      isProviderConfigured: (provider: StreamProviderType) => {
        const state = get();
        return !!(state.apiKeys[provider] && state.avatarId);
      },
    }),
    {
      name: 'streaming-avatar-config',
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        apiKeys: state.apiKeys,
        avatarId: state.avatarId,
        voiceId: state.voiceId,
        videoEnabled: state.videoEnabled,
        audioEnabled: state.audioEnabled,
        videoQuality: state.videoQuality,
        audioQuality: state.audioQuality,
      }),
    },
  ),
);
