import { vi } from 'vitest';
import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../../types/provider.interfaces';
import {
  StreamingState,
  StreamProviderType,
  VideoTrack,
  AudioTrack,
  VideoConfig,
  AudioConfig,
  Participant,
  ConnectionQuality,
} from '../../types/streaming.types';

// Mock event handlers for testing
export const createMockEventHandlers = (): StreamingEventHandlers => ({
  onParticipantJoined: vi.fn(),
  onParticipantLeft: vi.fn(),
  onConnectionQualityChanged: vi.fn(),
  onError: vi.fn(),
  onMessageReceived: vi.fn(),
  onSpeakingStateChanged: vi.fn(),
  onSystemMessage: vi.fn(),
  onChatMessage: vi.fn(),
  onCommand: vi.fn(),
});

// Helper to create mock streaming state
export const createMockStreamingState = (overrides: Partial<StreamingState> = {}): StreamingState => ({
  isJoined: false,
  isConnecting: false,
  isSpeaking: false,
  participants: [],
  localParticipant: null,
  networkQuality: null,
  error: null,
  ...overrides,
});

// Helper to create mock streaming provider
export const createMockStreamingProvider = (type: StreamProviderType): StreamingProvider => {
  const mockState = createMockStreamingState();
  const subscribers = new Set<(state: StreamingState) => void>();

  return {
    providerType: type,
    state: mockState,

    connect: vi
      .fn()
      .mockImplementation(async (_credentials: StreamingCredentials, handlers?: StreamingEventHandlers) => {
        // Simulate connection success
        const newState = { ...mockState, isJoined: true, isConnecting: false };
        Object.assign(mockState, newState);

        // Notify subscribers
        subscribers.forEach((callback) => callback(newState));

        // Trigger handlers if provided
        if (handlers?.onParticipantJoined) {
          setTimeout(() => {
            handlers.onParticipantJoined!({
              id: 'test-participant',
              displayName: 'Test Participant',
              isLocal: false,
              videoTracks: [],
              audioTracks: [],
              connectionQuality: {
                score: 95,
                uplink: 'excellent',
                downlink: 'excellent',
                rtt: 50,
                packetLoss: 0.01,
              },
            });
          }, 100);
        }
      }),

    disconnect: vi.fn().mockImplementation(async () => {
      const newState = { ...mockState, isJoined: false, isConnecting: false };
      Object.assign(mockState, newState);
      subscribers.forEach((callback) => callback(newState));
    }),

    enableVideo: vi.fn().mockImplementation(async (_config?: VideoConfig): Promise<VideoTrack> => {
      const track: VideoTrack = {
        id: 'mock-video-track',
        kind: 'video',
        enabled: true,
        muted: false,
        source: 'camera',
      };
      return track;
    }),

    disableVideo: vi.fn().mockResolvedValue(undefined),
    playVideo: vi.fn().mockResolvedValue(undefined),
    stopVideo: vi.fn().mockResolvedValue(undefined),
    publishVideo: vi.fn().mockResolvedValue(undefined),
    unpublishVideo: vi.fn().mockResolvedValue(undefined),

    enableAudio: vi.fn().mockImplementation(async (_config?: AudioConfig): Promise<AudioTrack> => {
      const track: AudioTrack = {
        id: 'mock-audio-track',
        kind: 'audio',
        enabled: true,
        muted: false,
        volume: 0.8,
      };
      return track;
    }),

    disableAudio: vi.fn().mockResolvedValue(undefined),
    publishAudio: vi.fn().mockResolvedValue(undefined),
    unpublishAudio: vi.fn().mockResolvedValue(undefined),

    sendMessage: vi.fn().mockImplementation(async (_content: string) => {
      // Simulate message echo for testing
      // const _message: ChatMessage = {
      //   id: `msg-${Date.now()}`,
      //   content,
      //   timestamp: Date.now(),
      //   fromParticipant: 'test-user',
      //   type: 'text',
      // };

      // Simulate message received event
      setTimeout(() => {
        subscribers.forEach((callback) => {
          const newState = { ...mockState };
          callback(newState);
        });
      }, 50);
    }),

    sendInterrupt: vi.fn().mockResolvedValue(undefined),
    setAvatarParameters: vi.fn().mockResolvedValue(undefined),

    enableNoiseReduction: vi.fn().mockResolvedValue(undefined),
    disableNoiseReduction: vi.fn().mockResolvedValue(undefined),
    dumpAudio: vi.fn().mockResolvedValue(undefined),

    subscribe: vi.fn().mockImplementation((callback: (state: StreamingState) => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }),

    updateState: vi.fn().mockImplementation((partialState: Partial<StreamingState>) => {
      Object.assign(mockState, partialState);
      subscribers.forEach((callback) => callback(mockState));
    }),
  };
};

// Helper to create mock participants
export const createMockParticipant = (overrides: Partial<Participant> = {}): Participant => ({
  id: `participant-${Math.random().toString(36).substr(2, 9)}`,
  displayName: `Test User ${Math.random().toString(36).substr(2, 5)}`,
  isLocal: false,
  videoTracks: [],
  audioTracks: [],
  connectionQuality: {
    score: 95,
    uplink: 'excellent',
    downlink: 'excellent',
    rtt: 50,
    packetLoss: 0.01,
  },
  ...overrides,
});

// Helper to create mock connection quality
export const createMockConnectionQuality = (overrides: Partial<ConnectionQuality> = {}): ConnectionQuality => ({
  score: 95,
  uplink: 'excellent',
  downlink: 'excellent',
  rtt: 50,
  packetLoss: 0.01,
  ...overrides,
});

// Mock provider instances for different types
export const mockAgoraProvider = createMockStreamingProvider('agora');
export const mockLiveKitProvider = createMockStreamingProvider('livekit');
export const mockTRTCProvider = createMockStreamingProvider('trtc');

// Mock credentials for testing
export const mockCredentials: Record<StreamProviderType, StreamingCredentials> = {
  agora: {
    appId: 'test-agora-app-id',
    channel: 'test-channel',
    token: 'test-agora-token',
    uid: 'test-uid',
  },
  livekit: {
    url: 'wss://test-livekit-server.com',
    token: 'test-livekit-token',
    room: 'test-room',
  },
  trtc: {
    sdkAppId: 123456789,
    userId: 'test-user-id',
    userSig: 'test-user-sig',
    roomId: 12345,
  },
};
