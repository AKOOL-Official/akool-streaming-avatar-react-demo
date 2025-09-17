// Main provider
export { AgoraStreamingProvider, isAgoraCredentials } from './AgoraStreamingProvider';
export type { AgoraProviderConfig, AgoraCredentials } from './AgoraStreamingProvider';

// Import for factory function
import { AgoraStreamingProvider, AgoraProviderConfig } from './AgoraStreamingProvider';
import { StreamingProvider } from '../../types/provider.interfaces';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { RTCClient } from './types';

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

// Factory function for provider creation
export function createProvider(_credentials: unknown): StreamingProvider {
  // Create Agora RTC client
  const client = AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8',
  }) as RTCClient;

  // Create provider config with the client
  const config: AgoraProviderConfig = {
    client,
    // session will be set later when connecting
  };

  return new AgoraStreamingProvider(config);
}
