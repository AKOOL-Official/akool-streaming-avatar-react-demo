// Main provider
export { AgoraStreamingProvider, isAgoraCredentials } from './AgoraStreamingProvider';
export type { AgoraProviderConfig, AgoraCredentials } from './AgoraStreamingProvider';

// Controllers
export { AgoraConnectionController } from './controllers/AgoraConnectionController';
export { AgoraAudioController } from './controllers/AgoraAudioController';
export { AgoraVideoController } from './controllers/AgoraVideoController';

// Strategies
export { AgoraAudioStrategy } from './strategies/AgoraAudioStrategy';
export { AgoraVideoStrategy } from './strategies/AgoraVideoStrategy';

// Type exports for external use
export type { AgoraConnectionConfig, ConnectionEventCallbacks } from './controllers/AgoraConnectionController';
// AudioControllerCallbacks and AudioConfig are now exported from streaming.types.ts
export type { VideoControllerCallbacks, VideoConfig } from './controllers/AgoraVideoController';

// Factory function for provider creation with dynamic import
export async function createProvider(_credentials: unknown) {
  // Dynamically import Agora SDK only when needed
  const AgoraRTC = await import('agora-rtc-sdk-ng');
  const agoraModule = await import('./AgoraStreamingProvider');

  // Create Agora RTC client
  const client = AgoraRTC.default.createClient({
    mode: 'rtc',
    codec: 'vp8',
  }) as any; // Cast to any to avoid type issues with sendStreamMessage

  // Create provider config with the client
  const config = {
    client,
    // session will be set later when connecting
  };

  return new agoraModule.AgoraStreamingProvider(config);
}
