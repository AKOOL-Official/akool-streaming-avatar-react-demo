import { vi } from 'vitest';

// Mock TRTC client interface
export interface MockTRTCClient {
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  unpublish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  startLocalVideo: ReturnType<typeof vi.fn>;
  stopLocalVideo: ReturnType<typeof vi.fn>;
  startLocalAudio: ReturnType<typeof vi.fn>;
  stopLocalAudio: ReturnType<typeof vi.fn>;
  muteLocalVideo: ReturnType<typeof vi.fn>;
  unmuteLocalVideo: ReturnType<typeof vi.fn>;
  muteLocalAudio: ReturnType<typeof vi.fn>;
  unmuteLocalAudio: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getDevicesList: ReturnType<typeof vi.fn>;
  switchDevice: ReturnType<typeof vi.fn>;
  setVideoProfile: ReturnType<typeof vi.fn>;
  getRemoteVideoStats: ReturnType<typeof vi.fn>;
  getRemoteAudioStats: ReturnType<typeof vi.fn>;
  getLocalVideoStats: ReturnType<typeof vi.fn>;
  getLocalAudioStats: ReturnType<typeof vi.fn>;
  sendCustomMessage: ReturnType<typeof vi.fn>;
}

// Mock TRTC stream interface
export interface MockTRTCStream {
  userId: string;
  type: 'main' | 'auxiliary';
  hasVideo: boolean;
  hasAudio: boolean;
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  muteVideo: ReturnType<typeof vi.fn>;
  unmuteVideo: ReturnType<typeof vi.fn>;
  muteAudio: ReturnType<typeof vi.fn>;
  unmuteAudio: ReturnType<typeof vi.fn>;
  getVideoStats: ReturnType<typeof vi.fn>;
  getAudioStats: ReturnType<typeof vi.fn>;
}

// Create mock TRTC stream
export const createMockTRTCStream = (
  userId: string = 'test-user',
  type: 'main' | 'auxiliary' = 'main',
  overrides: Partial<MockTRTCStream> = {},
): MockTRTCStream => {
  return {
    userId,
    type,
    hasVideo: true,
    hasAudio: true,

    play: vi.fn().mockImplementation((elementId: string) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.setAttribute('data-trtc-playing', 'true');
        element.setAttribute('data-user-id', userId);
      }
      return Promise.resolve();
    }),

    stop: vi.fn().mockImplementation(() => {
      // Simulate stopping stream
      return Promise.resolve();
    }),

    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),

    muteVideo: vi.fn().mockImplementation(() => {
      Object.assign(overrides, { hasVideo: false });
    }),

    unmuteVideo: vi.fn().mockImplementation(() => {
      Object.assign(overrides, { hasVideo: true });
    }),

    muteAudio: vi.fn().mockImplementation(() => {
      Object.assign(overrides, { hasAudio: false });
    }),

    unmuteAudio: vi.fn().mockImplementation(() => {
      Object.assign(overrides, { hasAudio: true });
    }),

    getVideoStats: vi.fn().mockResolvedValue({
      frameRate: 30,
      resolution: { width: 1280, height: 720 },
      bitrate: 1500,
    }),

    getAudioStats: vi.fn().mockResolvedValue({
      bitrate: 64,
      packetsLost: 0,
      rtt: 50,
    }),

    ...overrides,
  };
};

// Create mock TRTC client
export const createMockTRTCClient = (overrides: Partial<MockTRTCClient> = {}): MockTRTCClient => {
  const eventListeners = new Map<string, Function[]>();
  const remoteStreams = new Map<string, MockTRTCStream>();
  let localStream: MockTRTCStream | null = null;
  let isJoined = false;

  const mockClient: MockTRTCClient = {
    join: vi
      .fn()
      .mockImplementation(
        async (params: { sdkAppId: number; userId: string; userSig: string; roomId: number; role?: string }) => {
          isJoined = true;

          // Create local stream
          localStream = createMockTRTCStream(params.userId, 'main');

          // Simulate join success
          setTimeout(() => {
            const listeners = eventListeners.get('client-state-changed');
            if (listeners) {
              listeners.forEach((listener) => listener({ state: 'CONNECTED' }));
            }
          }, 100);

          return Promise.resolve();
        },
      ),

    leave: vi.fn().mockImplementation(async () => {
      isJoined = false;
      localStream = null;
      remoteStreams.clear();

      // Simulate leave success
      setTimeout(() => {
        const listeners = eventListeners.get('client-state-changed');
        if (listeners) {
          listeners.forEach((listener) => listener({ state: 'DISCONNECTED' }));
        }
      }, 50);

      return Promise.resolve();
    }),

    publish: vi.fn().mockImplementation(async (stream: MockTRTCStream) => {
      if (!isJoined) {
        throw new Error('Client not joined');
      }

      // Simulate publish success
      setTimeout(() => {
        const listeners = eventListeners.get('stream-published');
        if (listeners) {
          listeners.forEach((listener) => listener({ stream }));
        }
      }, 50);

      return Promise.resolve();
    }),

    unpublish: vi.fn().mockImplementation(async (stream: MockTRTCStream) => {
      // Simulate unpublish success
      setTimeout(() => {
        const listeners = eventListeners.get('stream-unpublished');
        if (listeners) {
          listeners.forEach((listener) => listener({ stream }));
        }
      }, 50);

      return Promise.resolve();
    }),

    subscribe: vi.fn().mockImplementation(async (stream: MockTRTCStream) => {
      remoteStreams.set(stream.userId, stream);

      // Simulate subscribe success
      setTimeout(() => {
        const listeners = eventListeners.get('stream-subscribed');
        if (listeners) {
          listeners.forEach((listener) => listener({ stream }));
        }
      }, 50);

      return Promise.resolve();
    }),

    unsubscribe: vi.fn().mockImplementation(async (stream: MockTRTCStream) => {
      remoteStreams.delete(stream.userId);

      // Simulate unsubscribe success
      setTimeout(() => {
        const listeners = eventListeners.get('stream-unsubscribed');
        if (listeners) {
          listeners.forEach((listener) => listener({ stream }));
        }
      }, 50);

      return Promise.resolve();
    }),

    startLocalVideo: vi
      .fn()
      .mockImplementation(async (_params?: { camera?: string; profile?: string; mirror?: boolean }) => {
        if (localStream) {
          localStream.hasVideo = true;
        }
        return Promise.resolve();
      }),

    stopLocalVideo: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasVideo = false;
      }
      return Promise.resolve();
    }),

    startLocalAudio: vi.fn().mockImplementation(async (_params?: { microphone?: string; profile?: string }) => {
      if (localStream) {
        localStream.hasAudio = true;
      }
      return Promise.resolve();
    }),

    stopLocalAudio: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasAudio = false;
      }
      return Promise.resolve();
    }),

    muteLocalVideo: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasVideo = false;
      }
      return Promise.resolve();
    }),

    unmuteLocalVideo: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasVideo = true;
      }
      return Promise.resolve();
    }),

    muteLocalAudio: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasAudio = false;
      }
      return Promise.resolve();
    }),

    unmuteLocalAudio: vi.fn().mockImplementation(async () => {
      if (localStream) {
        localStream.hasAudio = true;
      }
      return Promise.resolve();
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

    destroy: vi.fn().mockImplementation(() => {
      eventListeners.clear();
      remoteStreams.clear();
      localStream = null;
      isJoined = false;
    }),

    getDevicesList: vi.fn().mockResolvedValue({
      cameras: [
        { deviceId: 'camera1', label: 'Camera 1' },
        { deviceId: 'camera2', label: 'Camera 2' },
      ],
      microphones: [
        { deviceId: 'mic1', label: 'Microphone 1' },
        { deviceId: 'mic2', label: 'Microphone 2' },
      ],
      speakers: [{ deviceId: 'speaker1', label: 'Speaker 1' }],
    }),

    switchDevice: vi.fn().mockResolvedValue(undefined),
    setVideoProfile: vi.fn().mockResolvedValue(undefined),

    getRemoteVideoStats: vi.fn().mockResolvedValue({
      frameRate: 30,
      resolution: { width: 1280, height: 720 },
      bitrate: 1500,
      packetsLost: 0,
    }),

    getRemoteAudioStats: vi.fn().mockResolvedValue({
      bitrate: 64,
      packetsLost: 0,
      rtt: 50,
    }),

    getLocalVideoStats: vi.fn().mockResolvedValue({
      frameRate: 30,
      resolution: { width: 1280, height: 720 },
      bitrate: 1500,
    }),

    getLocalAudioStats: vi.fn().mockResolvedValue({
      bitrate: 64,
      rtt: 50,
    }),

    sendCustomMessage: vi
      .fn()
      .mockImplementation(async (message: { cmdId: number; data: string; receiveUserList?: string[] }) => {
        // Simulate message sent
        setTimeout(() => {
          const listeners = eventListeners.get('custom-message');
          if (listeners) {
            listeners.forEach((listener) => listener(message));
          }
        }, 50);

        return Promise.resolve();
      }),

    ...overrides,
  };

  return mockClient;
};

// Mock the main TRTC object
export const mockTRTC = {
  createClient: vi
    .fn()
    .mockImplementation((_params?: { mode?: 'rtc' | 'live'; sdkAppId?: number; userId?: string; userSig?: string }) => {
      return createMockTRTCClient();
    }),

  createStream: vi
    .fn()
    .mockImplementation((params: { userId: string; video?: boolean; audio?: boolean; screen?: boolean }) => {
      return createMockTRTCStream(params.userId);
    }),

  // Device management
  getCameras: vi.fn().mockResolvedValue([
    { deviceId: 'camera1', label: 'Camera 1' },
    { deviceId: 'camera2', label: 'Camera 2' },
  ]),

  getMicrophones: vi.fn().mockResolvedValue([
    { deviceId: 'mic1', label: 'Microphone 1' },
    { deviceId: 'mic2', label: 'Microphone 2' },
  ]),

  getSpeakers: vi.fn().mockResolvedValue([{ deviceId: 'speaker1', label: 'Speaker 1' }]),

  // Error codes
  ERROR_CODES: {
    JOIN_ROOM_FAILED: 'JOIN_ROOM_FAILED',
    LEAVE_ROOM_FAILED: 'LEAVE_ROOM_FAILED',
    PUBLISH_FAILED: 'PUBLISH_FAILED',
    UNPUBLISH_FAILED: 'UNPUBLISH_FAILED',
    SUBSCRIBE_FAILED: 'SUBSCRIBE_FAILED',
    UNSUBSCRIBE_FAILED: 'UNSUBSCRIBE_FAILED',
  },

  // Client states
  CLIENT_STATE: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTING: 'DISCONNECTING',
    DISCONNECTED: 'DISCONNECTED',
    RECONNECTING: 'RECONNECTING',
  },

  // Video profiles
  VIDEO_PROFILE: {
    '120p': '120p',
    '180p': '180p',
    '240p': '240p',
    '360p': '360p',
    '480p': '480p',
    '720p': '720p',
    '1080p': '1080p',
  },
};

// Setup function to be called from setupTests
export const setupTRTCMocks = () => {
  // Mock the trtc-js-sdk module
  vi.mock('trtc-js-sdk', () => ({
    default: mockTRTC,
    TRTC: mockTRTC,
  }));
};

// Export for use in tests
export { mockTRTC as TRTC };
