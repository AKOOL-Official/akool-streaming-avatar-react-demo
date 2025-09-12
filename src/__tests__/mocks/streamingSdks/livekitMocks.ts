import { vi } from 'vitest';

// Mock LiveKit participant interface
export interface MockLiveKitParticipant {
  sid: string;
  identity: string;
  name?: string;
  metadata?: string;
  isSpeaking: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  tracks: Map<string, MockLiveKitTrack>;
  audioTracks: Map<string, MockLiveKitTrack>;
  videoTracks: Map<string, MockLiveKitTrack>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

// Mock LiveKit track interface
export interface MockLiveKitTrack {
  sid: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio';
  enabled: boolean;
  muted: boolean;
  attach: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setEnabled: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

// Mock LiveKit room interface
export interface MockLiveKitRoom {
  sid: string;
  name: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  participants: Map<string, MockLiveKitParticipant>;
  localParticipant: MockLiveKitParticipant;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  publishTrack: ReturnType<typeof vi.fn>;
  unpublishTrack: ReturnType<typeof vi.fn>;
  sendData: ReturnType<typeof vi.fn>;
  setE2EE: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
}

// Create mock LiveKit track
export const createMockLiveKitTrack = (
  kind: 'audio' | 'video',
  source: 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio' = kind === 'audio' ? 'microphone' : 'camera',
  overrides: Partial<MockLiveKitTrack> = {},
): MockLiveKitTrack => {
  const eventListeners = new Map<string, Function[]>();

  return {
    sid: `track-${kind}-${Math.random().toString(36).substr(2, 9)}`,
    kind,
    source,
    enabled: true,
    muted: false,

    attach: vi.fn().mockImplementation((element: HTMLElement) => {
      if (element && kind === 'video') {
        element.setAttribute('data-livekit-video', 'true');
        element.setAttribute('data-track-sid', overrides.sid || 'mock-track-sid');
      }
      return element;
    }),

    detach: vi.fn().mockImplementation((element?: HTMLElement) => {
      if (element && kind === 'video') {
        element.removeAttribute('data-livekit-video');
        element.removeAttribute('data-track-sid');
      }
    }),

    stop: vi.fn(),

    setEnabled: vi.fn().mockImplementation((enabled: boolean) => {
      Object.assign(overrides, { enabled });

      // Trigger track muted/unmuted events
      const listeners = eventListeners.get(enabled ? 'unmuted' : 'muted');
      if (listeners) {
        listeners.forEach((listener) => listener(overrides));
      }
    }),

    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
    }),

    off: vi.fn().mockImplementation((event: string, callback?: Function) => {
      if (callback) {
        const listeners = eventListeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        eventListeners.delete(event);
      }
    }),

    ...overrides,
  };
};

// Create mock LiveKit participant
export const createMockLiveKitParticipant = (
  identity: string = 'test-participant',
  overrides: Partial<MockLiveKitParticipant> = {},
): MockLiveKitParticipant => {
  const eventListeners = new Map<string, Function[]>();
  const tracks = new Map<string, MockLiveKitTrack>();
  const audioTracks = new Map<string, MockLiveKitTrack>();
  const videoTracks = new Map<string, MockLiveKitTrack>();

  return {
    sid: `participant-${Math.random().toString(36).substr(2, 9)}`,
    identity,
    name: identity,
    metadata: '',
    isSpeaking: false,
    connectionQuality: 'excellent',
    tracks,
    audioTracks,
    videoTracks,

    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
    }),

    off: vi.fn().mockImplementation((event: string, callback?: Function) => {
      if (callback) {
        const listeners = eventListeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        eventListeners.delete(event);
      }
    }),

    ...overrides,
  };
};

// Create mock LiveKit room
export const createMockLiveKitRoom = (overrides: Partial<MockLiveKitRoom> = {}): MockLiveKitRoom => {
  const eventListeners = new Map<string, Function[]>();
  const participants = new Map<string, MockLiveKitParticipant>();
  const localParticipant = createMockLiveKitParticipant('local-participant');

  const mockRoom: MockLiveKitRoom = {
    sid: `room-${Math.random().toString(36).substr(2, 9)}`,
    name: 'test-room',
    state: 'disconnected',
    participants,
    localParticipant,

    connect: vi.fn().mockImplementation(async (_url: string, _token: string, _options?: unknown) => {
      mockRoom.state = 'connected';

      // Simulate connection success
      setTimeout(() => {
        const listeners = eventListeners.get('connected');
        if (listeners) {
          listeners.forEach((listener) => listener());
        }
      }, 100);

      // Add local participant
      participants.set(localParticipant.identity, localParticipant);

      return mockRoom;
    }),

    disconnect: vi.fn().mockImplementation(async (_stopTracks: boolean = true) => {
      mockRoom.state = 'disconnected';
      participants.clear();

      // Simulate disconnection
      setTimeout(() => {
        const listeners = eventListeners.get('disconnected');
        if (listeners) {
          listeners.forEach((listener) => listener());
        }
      }, 50);
    }),

    publishTrack: vi.fn().mockImplementation(async (track: MockLiveKitTrack, _options?: unknown) => {
      // Add track to local participant
      localParticipant.tracks.set(track.sid, track);
      if (track.kind === 'audio') {
        localParticipant.audioTracks.set(track.sid, track);
      } else {
        localParticipant.videoTracks.set(track.sid, track);
      }

      // Simulate track published event
      setTimeout(() => {
        const listeners = eventListeners.get('trackPublished');
        if (listeners) {
          listeners.forEach((listener) => listener(track, localParticipant));
        }
      }, 50);
    }),

    unpublishTrack: vi.fn().mockImplementation(async (track: MockLiveKitTrack) => {
      // Remove track from local participant
      localParticipant.tracks.delete(track.sid);
      if (track.kind === 'audio') {
        localParticipant.audioTracks.delete(track.sid);
      } else {
        localParticipant.videoTracks.delete(track.sid);
      }

      // Simulate track unpublished event
      setTimeout(() => {
        const listeners = eventListeners.get('trackUnpublished');
        if (listeners) {
          listeners.forEach((listener) => listener(track, localParticipant));
        }
      }, 50);
    }),

    sendData: vi
      .fn()
      .mockImplementation(async (data: Uint8Array, _kind?: 'reliable' | 'lossy', _destination?: string[]) => {
        // Simulate data sent
        setTimeout(() => {
          const listeners = eventListeners.get('dataReceived');
          if (listeners) {
            listeners.forEach((listener) => listener(data, localParticipant));
          }
        }, 50);
      }),

    setE2EE: vi.fn(),

    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
    }),

    off: vi.fn().mockImplementation((event: string, callback?: Function) => {
      if (callback) {
        const listeners = eventListeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        eventListeners.delete(event);
      }
    }),

    removeAllListeners: vi.fn().mockImplementation(() => {
      eventListeners.clear();
    }),

    ...overrides,
  };

  return mockRoom;
};

// Mock the main LiveKit objects
export const mockLiveKit = {
  Room: vi.fn().mockImplementation((_options?: unknown) => {
    return createMockLiveKitRoom();
  }),

  createLocalVideoTrack: vi
    .fn()
    .mockImplementation(
      async (_options?: { deviceId?: string; resolution?: { width: number; height: number }; frameRate?: number }) => {
        return createMockLiveKitTrack('video', 'camera');
      },
    ),

  createLocalAudioTrack: vi
    .fn()
    .mockImplementation(
      async (_options?: { deviceId?: string; echoCancellation?: boolean; noiseSuppression?: boolean }) => {
        return createMockLiveKitTrack('audio', 'microphone');
      },
    ),

  createLocalScreenVideoTrack: vi
    .fn()
    .mockImplementation(async (_options?: { resolution?: { width: number; height: number }; frameRate?: number }) => {
      return createMockLiveKitTrack('video', 'screen_share');
    }),

  // Device management
  getLocalDevices: vi.fn().mockResolvedValue([
    {
      deviceId: 'camera1',
      kind: 'videoinput',
      label: 'Camera 1',
      groupId: 'camera1',
    },
    {
      deviceId: 'mic1',
      kind: 'audioinput',
      label: 'Microphone 1',
      groupId: 'mic1',
    },
  ]),

  // Connection quality
  ConnectionQuality: {
    Excellent: 'excellent',
    Good: 'good',
    Poor: 'poor',
    Unknown: 'unknown',
  },

  // Track source
  TrackSource: {
    Camera: 'camera',
    Microphone: 'microphone',
    ScreenShare: 'screen_share',
    ScreenShareAudio: 'screen_share_audio',
  },

  // Room state
  RoomState: {
    Connecting: 'connecting',
    Connected: 'connected',
    Disconnected: 'disconnected',
    Reconnecting: 'reconnecting',
  },
};

// Setup function to be called from setupTests
export const setupLiveKitMocks = () => {
  // Mock the livekit-client module
  vi.mock('livekit-client', () => ({
    ...mockLiveKit,
    default: mockLiveKit,
  }));
};

// Export for use in tests
export { mockLiveKit as LiveKit };
