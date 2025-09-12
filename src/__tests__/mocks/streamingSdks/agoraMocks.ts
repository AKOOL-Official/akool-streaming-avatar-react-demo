import { vi } from 'vitest';

// Mock Agora track interfaces
export interface MockAgoraTrack {
  trackMediaType: 'audio' | 'video';
  trackId: string;
  enabled: boolean;
  muted: boolean;
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  setEnabled: ReturnType<typeof vi.fn>;
  setVolume?: ReturnType<typeof vi.fn>;
  getStats?: ReturnType<typeof vi.fn>;
}

// Mock Agora client interface
export interface MockAgoraClient {
  uid: string | number | null;
  channelName: string | null;
  connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTING';
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  unpublish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  setClientRole: ReturnType<typeof vi.fn>;
  enableDualStream: ReturnType<typeof vi.fn>;
  disableDualStream: ReturnType<typeof vi.fn>;
  remoteUsers: unknown[];
}

// Create mock audio track
export const createMockAudioTrack = (overrides: Partial<MockAgoraTrack> = {}): MockAgoraTrack => ({
  trackMediaType: 'audio',
  trackId: `audio-track-${Math.random().toString(36).substr(2, 9)}`,
  enabled: true,
  muted: false,
  play: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  close: vi.fn(),
  setEnabled: vi.fn().mockImplementation((enabled: boolean) => {
    Object.assign(overrides, { enabled });
  }),
  setVolume: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockResolvedValue({
    audioLevel: 0.5,
    totalDuration: 1000,
    totalBytes: 5000,
  }),
  ...overrides,
});

// Create mock video track
export const createMockVideoTrack = (overrides: Partial<MockAgoraTrack> = {}): MockAgoraTrack => ({
  trackMediaType: 'video',
  trackId: `video-track-${Math.random().toString(36).substr(2, 9)}`,
  enabled: true,
  muted: false,
  play: vi.fn().mockImplementation((element: HTMLElement) => {
    // Simulate video playing in element
    if (element) {
      element.setAttribute('data-video-playing', 'true');
    }
  }),
  stop: vi.fn().mockImplementation(() => {
    // Simulate stopping video
  }),
  close: vi.fn(),
  setEnabled: vi.fn().mockImplementation((enabled: boolean) => {
    Object.assign(overrides, { enabled });
  }),
  getStats: vi.fn().mockResolvedValue({
    frameRate: 30,
    resolution: { width: 1280, height: 720 },
    totalDuration: 1000,
    totalBytes: 50000,
  }),
  ...overrides,
});

// Create mock Agora client
export const createMockAgoraClient = (overrides: Partial<MockAgoraClient> = {}): MockAgoraClient => {
  const eventListeners = new Map<string, Function[]>();

  const mockClient: MockAgoraClient = {
    uid: null,
    channelName: null,
    connectionState: 'DISCONNECTED',
    remoteUsers: [],

    join: vi
      .fn()
      .mockImplementation(async (_appId: string, channel: string, _token: string | null, uid?: string | number) => {
        mockClient.channelName = channel;
        mockClient.uid = uid || `user-${Math.random().toString(36).substr(2, 9)}`;
        mockClient.connectionState = 'CONNECTED';

        // Simulate connection success
        setTimeout(() => {
          const listeners = eventListeners.get('connection-state-change');
          if (listeners) {
            listeners.forEach((listener) => listener('CONNECTED', 'DISCONNECTED', 'CLIENT_REQUEST'));
          }
        }, 100);

        return mockClient.uid;
      }),

    leave: vi.fn().mockImplementation(async () => {
      mockClient.connectionState = 'DISCONNECTED';
      mockClient.channelName = null;
      mockClient.uid = null;
      mockClient.remoteUsers = [];

      // Simulate disconnection
      setTimeout(() => {
        const listeners = eventListeners.get('connection-state-change');
        if (listeners) {
          listeners.forEach((listener) => listener('DISCONNECTED', 'CONNECTED', 'CLIENT_REQUEST'));
        }
      }, 50);
    }),

    publish: vi.fn().mockImplementation(async (tracks: MockAgoraTrack | MockAgoraTrack[]) => {
      const trackArray = Array.isArray(tracks) ? tracks : [tracks];

      // Simulate publish success
      setTimeout(() => {
        trackArray.forEach((track) => {
          const listeners = eventListeners.get('stream-published');
          if (listeners) {
            listeners.forEach((listener) => listener({ track }));
          }
        });
      }, 50);
    }),

    unpublish: vi.fn().mockImplementation(async (_tracks: MockAgoraTrack | MockAgoraTrack[]) => {
      // Simulate unpublish success
      setTimeout(() => {
        const listeners = eventListeners.get('stream-unpublished');
        if (listeners) {
          listeners.forEach((listener) => listener({}));
        }
      }, 50);
    }),

    subscribe: vi.fn().mockImplementation(async (user: { uid: string }, mediaType?: 'audio' | 'video') => {
      // Simulate subscription success
      setTimeout(() => {
        const listeners = eventListeners.get('user-subscribed');
        if (listeners) {
          const track = mediaType === 'audio' ? createMockAudioTrack() : createMockVideoTrack();
          listeners.forEach((listener) => listener(user, track));
        }
      }, 50);
    }),

    unsubscribe: vi.fn().mockResolvedValue(undefined),

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

    getStats: vi.fn().mockResolvedValue({
      RTCStats: {
        Duration: 1000,
        RecvBitrate: 500,
        SendBitrate: 600,
        RTT: 50,
      },
    }),

    setClientRole: vi.fn().mockResolvedValue(undefined),
    enableDualStream: vi.fn().mockResolvedValue(undefined),
    disableDualStream: vi.fn().mockResolvedValue(undefined),

    ...overrides,
  };

  return mockClient;
};

// Mock the main AgoraRTC object
export const mockAgoraRTC = {
  createClient: vi.fn().mockImplementation((_config?: { mode?: string; codec?: string }) => {
    return createMockAgoraClient();
  }),

  createMicrophoneAudioTrack: vi
    .fn()
    .mockImplementation(async (_config?: { microphoneId?: string; AEC?: boolean; AGC?: boolean; ANS?: boolean }) => {
      return createMockAudioTrack();
    }),

  createCameraVideoTrack: vi
    .fn()
    .mockImplementation(
      async (_config?: {
        cameraId?: string;
        encoderConfig?: { width?: number; height?: number; frameRate?: number; bitrateMax?: number };
      }) => {
        return createMockVideoTrack();
      },
    ),

  createScreenVideoTrack: vi
    .fn()
    .mockImplementation(
      async (_config?: {
        encoderConfig?: { width?: number; height?: number; frameRate?: number; bitrateMax?: number };
      }) => {
        return createMockVideoTrack({ trackId: 'screen-video-track' });
      },
    ),

  createCustomAudioTrack: vi.fn().mockImplementation(async (_config: { mediaStreamTrack: MediaStreamTrack }) => {
    return createMockAudioTrack({ trackId: 'custom-audio-track' });
  }),

  createCustomVideoTrack: vi.fn().mockImplementation(async (_config: { mediaStreamTrack: MediaStreamTrack }) => {
    return createMockVideoTrack({ trackId: 'custom-video-track' });
  }),

  // Device management
  getDevices: vi.fn().mockResolvedValue([
    {
      deviceId: 'default',
      kind: 'audioinput',
      label: 'Default - Microphone',
      groupId: 'default',
    },
    {
      deviceId: 'camera1',
      kind: 'videoinput',
      label: 'Camera 1',
      groupId: 'camera1',
    },
  ]),

  getCameras: vi.fn().mockResolvedValue([
    {
      deviceId: 'camera1',
      label: 'Camera 1',
      groupId: 'camera1',
    },
  ]),

  getMicrophones: vi.fn().mockResolvedValue([
    {
      deviceId: 'mic1',
      label: 'Microphone 1',
      groupId: 'mic1',
    },
  ]),

  // Network quality
  getNetworkQuality: vi.fn().mockResolvedValue({
    downlinkNetworkQuality: 6,
    uplinkNetworkQuality: 6,
  }),

  // Version and compatibility
  VERSION: '4.0.0',
  checkSystemRequirements: vi.fn().mockReturnValue(true),

  // Error codes (commonly used in tests)
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

// Setup function to be called from setupTests
export const setupAgoraMocks = () => {
  // Mock the entire agora-rtc-sdk-ng module
  vi.mock('agora-rtc-sdk-ng', () => ({
    default: mockAgoraRTC,
    ...mockAgoraRTC,
  }));

  // Mock agora extension for AI denoiser
  vi.mock('agora-extension-ai-denoiser', () => ({
    default: {
      createProcessor: vi.fn().mockResolvedValue({
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
        setMode: vi.fn(),
      }),
    },
  }));
};

// Export for use in tests
export { mockAgoraRTC as AgoraRTC };
