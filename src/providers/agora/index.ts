// Main provider
export { AgoraStreamingProvider } from './AgoraStreamingProvider';
export type { AgoraProviderConfig } from './AgoraStreamingProvider';

// Import for factory function
import { AgoraStreamingProvider, AgoraProviderConfig } from './AgoraStreamingProvider';
import { StreamingProvider } from '../../types/provider.interfaces';

// Controllers
export { AgoraConnectionController } from './controllers/AgoraConnectionController';
export { AgoraEventController } from './controllers/AgoraEventController';
export { AgoraMessagingController } from './controllers/AgoraMessagingController';
export { AgoraAudioController } from './controllers/AgoraAudioController';
export { AgoraVideoController } from './controllers/AgoraVideoController';

// Strategies
export { AgoraAudioStrategy } from './strategies/AgoraAudioStrategy';
export { AgoraVideoStrategy } from './strategies/AgoraVideoStrategy';

// Type exports for external use
export type { AgoraConnectionConfig, ConnectionEventCallbacks } from './controllers/AgoraConnectionController';
export type { AgoraEventCallbacks } from './controllers/AgoraEventController';
export type { MessagingEventCallbacks } from './controllers/AgoraMessagingController';
export type { AudioControllerCallbacks, AudioConfig } from './controllers/AgoraAudioController';
export type { VideoControllerCallbacks, VideoConfig } from './controllers/AgoraVideoController';

// Factory function for provider creation
export function createProvider(credentials: unknown): StreamingProvider {
  return new AgoraStreamingProvider(credentials as AgoraProviderConfig);
}
