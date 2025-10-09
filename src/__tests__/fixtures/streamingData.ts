import {
  StreamingState,
  VideoTrack,
  AudioTrack,
  ChatMessage,
  Participant,
  ConnectionQuality,
} from '../../types/streaming.types';

// Mock connection quality fixtures (declared first to avoid hoisting issues)
export const mockConnectionQuality: ConnectionQuality = {
  score: 95,
  uplink: 'excellent',
  downlink: 'excellent',
  rtt: 50,
  packetLoss: 0.01,
};

export const mockConnectionQualityFair: ConnectionQuality = {
  score: 60,
  uplink: 'fair',
  downlink: 'good',
  rtt: 150,
  packetLoss: 0.05,
};

export const mockConnectionQualityPoor: ConnectionQuality = {
  score: 20,
  uplink: 'poor',
  downlink: 'poor',
  rtt: 300,
  packetLoss: 0.15,
};

// Audio track fixtures
export const mockAudioTrack: AudioTrack = {
  id: 'audio-track-test',
  kind: 'audio',
  enabled: true,
  muted: false,
  volume: 0.8,
};

export const mockAudioTrackMuted: AudioTrack = {
  id: 'audio-track-muted',
  kind: 'audio',
  enabled: true,
  muted: true,
  volume: 0.5,
};

export const mockAudioTrackDisabled: AudioTrack = {
  id: 'audio-track-disabled',
  kind: 'audio',
  enabled: false,
  muted: false,
  volume: 0.0,
};

// Video track fixtures
export const mockVideoTrack: VideoTrack = {
  id: 'video-track-test',
  kind: 'video',
  enabled: true,
  muted: false,
  source: 'camera',
};

export const mockVideoTrackMuted: VideoTrack = {
  id: 'video-track-muted',
  kind: 'video',
  enabled: true,
  muted: true,
  source: 'camera',
};

export const mockVideoTrackDisabled: VideoTrack = {
  id: 'video-track-disabled',
  kind: 'video',
  enabled: false,
  muted: false,
  source: 'camera',
};

export const mockVideoTrackHD: VideoTrack = {
  id: 'video-track-hd',
  kind: 'video',
  enabled: true,
  muted: false,
  source: 'camera',
};

// Mock participants
export const mockParticipants: Participant[] = [
  {
    id: 'remote-user-1',
    displayName: 'Remote User 1',
    isLocal: false,
    videoTracks: [mockVideoTrack],
    audioTracks: [mockAudioTrack],
    connectionQuality: mockConnectionQuality,
    isSpeaking: false,
  },
  {
    id: 'remote-user-2',
    displayName: 'Remote User 2',
    isLocal: false,
    videoTracks: [],
    audioTracks: [mockAudioTrackMuted],
    connectionQuality: mockConnectionQualityFair,
    isSpeaking: false,
  },
  {
    id: 'remote-user-3',
    displayName: 'Remote User 3',
    isLocal: false,
    videoTracks: [mockVideoTrackDisabled],
    audioTracks: [],
    connectionQuality: mockConnectionQualityPoor,
    isSpeaking: false,
  },
];

export const mockLocalParticipant: Participant = {
  id: 'local-user',
  displayName: 'Local User',
  isLocal: true,
  videoTracks: [mockVideoTrack],
  audioTracks: [mockAudioTrack],
  connectionQuality: mockConnectionQuality,
  isSpeaking: false,
};

// Default streaming state fixtures
export const defaultStreamingState: StreamingState = {
  isJoined: false,
  isConnecting: false,
  isSpeaking: false,
  participants: [],
  localParticipant: null,
  networkQuality: null,
  error: null,
};

export const connectedStreamingState: StreamingState = {
  isJoined: true,
  isConnecting: false,
  isSpeaking: false,
  participants: mockParticipants,
  localParticipant: mockLocalParticipant,
  networkQuality: mockConnectionQuality,
  error: null,
};

// Chat message fixtures
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    content: 'Hello everyone!',
    timestamp: Date.now() - 300000, // 5 minutes ago
    fromParticipant: 'user',
    type: 'text',
  },
  {
    id: 'msg-2',
    content: 'How is everyone doing?',
    timestamp: Date.now() - 240000, // 4 minutes ago
    fromParticipant: 'avatar',
    type: 'text',
  },
  {
    id: 'msg-3',
    content: 'System message',
    timestamp: Date.now() - 180000, // 3 minutes ago
    fromParticipant: 'system',
    type: 'system',
  },
  {
    id: 'msg-4',
    content: 'Great to see you all!',
    timestamp: Date.now() - 120000, // 2 minutes ago
    fromParticipant: 'user',
    type: 'text',
  },
];

export const mockChatMessageThread: ChatMessage[] = [
  {
    id: 'thread-1',
    content: 'This is a conversation thread',
    timestamp: Date.now() - 60000,
    fromParticipant: 'user',
    type: 'text',
  },
  {
    id: 'thread-2',
    content: 'Yes, I agree with that',
    timestamp: Date.now() - 45000,
    fromParticipant: 'avatar',
    type: 'text',
  },
  {
    id: 'thread-3',
    content: 'What do you think about this?',
    timestamp: Date.now() - 30000,
    fromParticipant: 'user',
    type: 'text',
  },
  {
    id: 'thread-4',
    content: 'I think it sounds good',
    timestamp: Date.now() - 15000,
    fromParticipant: 'avatar',
    type: 'text',
  },
];

// Streaming state scenarios
export const streamingStateScenarios = {
  connecting: {
    isJoined: false,
    isConnecting: true,
    isSpeaking: false,
    participants: [],
    localParticipant: null,
    networkQuality: null,
    error: null,
  },
  connected: {
    isJoined: true,
    isConnecting: false,
    isSpeaking: false,
    participants: mockParticipants,
    localParticipant: mockLocalParticipant,
    networkQuality: mockConnectionQuality,
    error: null,
  },
  speaking: {
    isJoined: true,
    isConnecting: false,
    isSpeaking: true,
    participants: mockParticipants,
    localParticipant: mockLocalParticipant,
    networkQuality: mockConnectionQuality,
    error: null,
  },
  withError: {
    isJoined: false,
    isConnecting: false,
    isSpeaking: false,
    participants: [],
    localParticipant: null,
    networkQuality: null,
    error: {
      code: 'CONNECTION_FAILED',
      message: 'Failed to connect to streaming service',
      details: 'Network timeout',
    },
  },
  withManyParticipants: {
    isJoined: true,
    isConnecting: false,
    isSpeaking: false,
    participants: [
      ...mockParticipants,
      {
        id: 'no-tracks-user',
        displayName: 'No Tracks User',
        isLocal: false,
        videoTracks: [],
        audioTracks: [],
        connectionQuality: mockConnectionQuality,
      },
    ],
    localParticipant: mockLocalParticipant,
    networkQuality: mockConnectionQuality,
    error: null,
  },
  withPoorConnection: {
    isJoined: true,
    isConnecting: false,
    isSpeaking: false,
    participants: mockParticipants,
    localParticipant: mockLocalParticipant,
    networkQuality: mockConnectionQualityPoor,
    error: null,
  },
};

// Factory functions for creating test data
export function createMockParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: `participant-${Math.random().toString(36).substr(2, 9)}`,
    displayName: `Test User ${Math.random().toString(36).substr(2, 5)}`,
    isLocal: false,
    videoTracks: [],
    audioTracks: [],
    connectionQuality: mockConnectionQuality,
    isSpeaking: false,
    ...overrides,
  };
}

export function createMockAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: `audio-${Math.random().toString(36).substr(2, 9)}`,
    kind: 'audio',
    enabled: true,
    muted: false,
    volume: 0.8,
    ...overrides,
  };
}

export function createMockVideoTrack(overrides: Partial<VideoTrack> = {}): VideoTrack {
  return {
    id: `video-${Math.random().toString(36).substr(2, 9)}`,
    kind: 'video',
    enabled: true,
    muted: false,
    source: 'camera',
    ...overrides,
  };
}

export function createMockStreamingState(overrides: Partial<StreamingState> = {}): StreamingState {
  return {
    isJoined: false,
    isConnecting: false,
    isSpeaking: false,
    participants: [],
    localParticipant: null,
    networkQuality: null,
    error: null,
    ...overrides,
  };
}

export function createMockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test message',
    timestamp: Date.now(),
    fromParticipant: 'test-user',
    type: 'text',
    ...overrides,
  };
}
