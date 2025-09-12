import { StreamingCredentials } from '../../types/provider.interfaces';
import { StreamProviderType } from '../../types/streaming.types';

// Base credential templates
export const baseAgoraCredentials: StreamingCredentials = {
  apiKey: 'test-agora-api-key',
  channelName: 'test-channel',
  token: 'test-agora-token',
  uid: 'test-user-123',
  baseUrl: 'https://api.agora.io',
};

export const baseLiveKitCredentials: StreamingCredentials = {
  apiKey: 'test-livekit-api-key',
  channelName: 'test-room',
  token: 'test-livekit-token',
  uid: 'test-participant-123',
  baseUrl: 'wss://test.livekit.cloud',
  serverUrl: 'wss://test.livekit.cloud',
};

export const baseTRTCCredentials: StreamingCredentials = {
  apiKey: 'test-trtc-api-key',
  channelName: 'test-room-id',
  token: 'test-trtc-token',
  uid: 'test-user-123',
  baseUrl: 'https://trtc.cloud.tencent.com',
  sdkAppId: 1400000000,
  userSig: 'test-user-sig',
};

// Provider-specific credential factories
export const createAgoraCredentials = (overrides: Partial<StreamingCredentials> = {}): StreamingCredentials => ({
  ...baseAgoraCredentials,
  ...overrides,
});

export const createLiveKitCredentials = (overrides: Partial<StreamingCredentials> = {}): StreamingCredentials => ({
  ...baseLiveKitCredentials,
  ...overrides,
});

export const createTRTCCredentials = (overrides: Partial<StreamingCredentials> = {}): StreamingCredentials => ({
  ...baseTRTCCredentials,
  ...overrides,
});

// Generic credential factory
export const createCredentialsForProvider = (
  providerType: StreamProviderType,
  overrides: Partial<StreamingCredentials> = {},
): StreamingCredentials => {
  switch (providerType) {
    case 'agora':
      return createAgoraCredentials(overrides);
    case 'livekit':
      return createLiveKitCredentials(overrides);
    case 'trtc':
      return createTRTCCredentials(overrides);
    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }
};

// Common test scenarios
export const credentialScenarios = {
  // Valid credentials
  validAgora: createAgoraCredentials(),
  validLiveKit: createLiveKitCredentials(),
  validTRTC: createTRTCCredentials(),

  // Invalid credentials (missing required fields)
  invalidAgoraMissingToken: createAgoraCredentials({ token: undefined }),
  invalidAgoraMissingChannel: createAgoraCredentials({ channelName: undefined }),
  invalidAgoraMissingApiKey: createAgoraCredentials({ apiKey: undefined }),

  invalidLiveKitMissingToken: createLiveKitCredentials({ token: undefined }),
  invalidLiveKitMissingServerUrl: createLiveKitCredentials({ serverUrl: undefined }),
  invalidLiveKitMissingChannel: createLiveKitCredentials({ channelName: undefined }),

  invalidTRTCMissingUserSig: createTRTCCredentials({ userSig: undefined }),
  invalidTRTCMissingSdkAppId: createTRTCCredentials({ sdkAppId: undefined }),
  invalidTRTCMissingChannel: createTRTCCredentials({ channelName: undefined }),

  // Malformed credentials
  malformedAgoraInvalidUid: createAgoraCredentials({ uid: '' }),
  malformedLiveKitInvalidUrl: createLiveKitCredentials({ serverUrl: 'invalid-url' }),
  malformedTRTCInvalidSdkAppId: createTRTCCredentials({ sdkAppId: 'invalid' as any }),

  // Edge cases
  emptyCredentials: {} as StreamingCredentials,
  nullCredentials: null as any,
  undefinedCredentials: undefined as any,

  // Long values
  longChannelName: createAgoraCredentials({
    channelName: 'a'.repeat(256), // Very long channel name
  }),
  longToken: createAgoraCredentials({
    token: 'a'.repeat(2048), // Very long token
  }),

  // Special characters
  specialCharactersInChannel: createAgoraCredentials({
    channelName: 'test-channel-with-special-chars-!@#$%^&*()',
  }),
  unicodeInChannel: createAgoraCredentials({
    channelName: 'test-channel-unicode-测试-频道-🎥',
  }),

  // Different UID formats
  stringUid: createAgoraCredentials({ uid: 'user-string-123' }),
  numericUid: createAgoraCredentials({ uid: '123456789' }),
  longUid: createAgoraCredentials({ uid: '12345678901234567890' }),
};

// Credential validation helpers
export const isValidCredentialsForProvider = (
  credentials: StreamingCredentials,
  providerType: StreamProviderType,
): boolean => {
  if (!credentials) return false;

  const hasBasicFields = !!(credentials.channelName && credentials.uid);

  switch (providerType) {
    case 'agora':
      return hasBasicFields && !!(credentials.apiKey && credentials.token);

    case 'livekit':
      return hasBasicFields && !!(credentials.token && credentials.serverUrl);

    case 'trtc':
      return hasBasicFields && !!(credentials.sdkAppId && credentials.userSig);

    default:
      return false;
  }
};

// Test data generators
export const generateRandomCredentials = (providerType: StreamProviderType): StreamingCredentials => {
  const randomId = Math.random().toString(36).substr(2, 9);
  const randomChannel = `test-channel-${randomId}`;
  const randomUid = `test-user-${randomId}`;

  return createCredentialsForProvider(providerType, {
    channelName: randomChannel,
    uid: randomUid,
  });
};

export const generateCredentialsList = (providerType: StreamProviderType, count: number): StreamingCredentials[] => {
  return Array.from({ length: count }, () => generateRandomCredentials(providerType));
};

// Avatar-specific credentials
export const avatarCredentials = {
  basicAvatar: createAgoraCredentials({
    channelName: 'avatar-session-basic',
    uid: 'avatar-user-001',
    metadata: {
      avatarId: 'avatar-001',
      knowledgeId: 'kb-001',
      voice: 'en-US-standard-A',
    },
  }),

  advancedAvatar: createAgoraCredentials({
    channelName: 'avatar-session-advanced',
    uid: 'avatar-user-002',
    metadata: {
      avatarId: 'avatar-002',
      knowledgeId: 'kb-002',
      voice: 'en-US-standard-B',
      personality: 'friendly',
      context: 'customer-support',
    },
  }),

  multimodalAvatar: createAgoraCredentials({
    channelName: 'avatar-session-multimodal',
    uid: 'avatar-user-003',
    metadata: {
      avatarId: 'avatar-003',
      knowledgeId: 'kb-003',
      voice: 'en-US-neural-C',
      enableGestures: true,
      enableFacialExpressions: true,
      enableLipSync: true,
    },
  }),
};

// Development and testing convenience exports
export const devCredentials = {
  // Use these for manual testing - not for automated tests
  localDev: createAgoraCredentials({
    channelName: 'dev-test-channel',
    uid: 'dev-user',
    apiKey: 'dev-api-key',
    token: 'dev-token',
  }),
};

// Export commonly used credentials for easy access
export const testCredentials = credentialScenarios.validAgora;
export const testCredentialsLiveKit = credentialScenarios.validLiveKit;
export const testCredentialsTRTC = credentialScenarios.validTRTC;
